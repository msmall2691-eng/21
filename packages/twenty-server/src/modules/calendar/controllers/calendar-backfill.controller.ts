import { Controller, Logger, Post, Query } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { JobVisitCalendarSyncService } from 'src/modules/calendar/services/job-visit-calendar-sync.service';

/**
 * One-shot backfill controller for rewriting existing JobVisit ->
 * Google Calendar events to the canonical format introduced in
 * fix(calendar) a25a269c (client name in title, street address in
 * middle slot, real scheduledDate time-of-day, duration honored).
 *
 * This is intentionally unauthenticated to match the existing
 * /webhooks/str-ical-sync pattern. Remove this controller once the
 * backfill has been run successfully.
 *
 * Usage:
 *   POST /webhooks/calendar-backfill           -> run for all active workspaces
 *   POST /webhooks/calendar-backfill?dryRun=1  -> preview only, no writes
 */
@Controller('webhooks/calendar-backfill')
export class CalendarBackfillController {
  private readonly logger = new Logger(CalendarBackfillController.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly jobVisitCalendarSyncService: JobVisitCalendarSyncService,
  ) {}

  @Post()
  async run(@Query('dryRun') dryRun?: string): Promise<{
    success: boolean;
    dryRun: boolean;
    perWorkspace: Array<{
      workspaceId: string;
      totalCandidates: number;
      rewritten: number;
      skipped: number;
      failed: number;
      preview: Array<{
        jobVisitId: string;
        newTitle: string;
        startsAt: string;
      }>;
    }>;
  }> {
    const isDryRun = dryRun === '1' || dryRun === 'true';

    this.logger.log(
      `Calendar backfill starting (${isDryRun ? 'DRY RUN' : 'LIVE'})`,
    );

    const activeWorkspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      },
    });

    const perWorkspace: Array<{
      workspaceId: string;
      totalCandidates: number;
      rewritten: number;
      skipped: number;
      failed: number;
      preview: Array<{
        jobVisitId: string;
        newTitle: string;
        startsAt: string;
      }>;
    }> = [];

    for (const workspace of activeWorkspaces) {
      const result = await this.runForWorkspace(workspace.id, isDryRun);
      perWorkspace.push(result);
    }

    return {
      success: true,
      dryRun: isDryRun,
      perWorkspace,
    };
  }

  private async runForWorkspace(
    workspaceId: string,
    isDryRun: boolean,
  ): Promise<{
    workspaceId: string;
    totalCandidates: number;
    rewritten: number;
    skipped: number;
    failed: number;
    preview: Array<{
      jobVisitId: string;
      newTitle: string;
      startsAt: string;
    }>;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    let totalCandidates = 0;
    let rewritten = 0;
    let skipped = 0;
    let failed = 0;
    const preview: Array<{
      jobVisitId: string;
      newTitle: string;
      startsAt: string;
    }> = [];

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workspaceMemberRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberWorkspaceEntity>(
            workspaceId,
            'workspaceMember',
          );

        const workspaceMember = await workspaceMemberRepository.findOne({
          where: {},
          order: { createdAt: 'ASC' },
        });

        if (!workspaceMember) {
          this.logger.warn(
            `No workspace member in ${workspaceId} - skipping backfill`,
          );
          return;
        }

        const jobVisitRepository =
          await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
            workspaceId,
            'jobVisit',
          );

        const calendarEventRepository =
          await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
            workspaceId,
            'calendarEvent',
          );

        const candidates = await jobVisitRepository.find({
          where: {
            calendarEventId: Not(IsNull()),
            scheduledDate: Not(IsNull()),
          },
          relations: ['property', 'property.person', 'property.company'],
          order: { scheduledDate: 'ASC' },
          take: 500,
        });

        totalCandidates = candidates.length;

        this.logger.log(
          `Workspace ${workspaceId}: ${totalCandidates} candidate JobVisits for backfill`,
        );

        for (const jobVisit of candidates) {
          try {
            if (!jobVisit.scheduledDate || !jobVisit.calendarEventId) {
              skipped++;
              continue;
            }

            const property = jobVisit.property as
              | PropertyWorkspaceEntity
              | null;

            const propertyName =
              property?.name || jobVisit.name || 'Cleaning visit';
            const propertyAddress = this.buildAddressString(property);
            const clientName = this.buildClientName(property);

            // Pull the existing CalendarEvent so we can hand the Google
            // event id (stored in iCalUid) to the update method.
            const existing = await calendarEventRepository.findOne({
              where: { id: jobVisit.calendarEventId },
            });

            if (!existing) {
              this.logger.warn(
                `CalendarEvent ${jobVisit.calendarEventId} missing for JobVisit ${jobVisit.id} - skipping`,
              );
              skipped++;
              continue;
            }

            const externalEventId =
              existing.iCalUid &&
              !existing.iCalUid.startsWith('jobvisit_')
                ? existing.iCalUid
                : null;

            // Preview what this will look like (uses service helper)
            const newTitle = this.jobVisitCalendarSyncService.buildEventTitle({
              propertyName,
              propertyAddress,
              clientName,
            });

            if (preview.length < 10) {
              preview.push({
                jobVisitId: jobVisit.id,
                newTitle,
                startsAt: jobVisit.scheduledDate,
              });
            }

            if (isDryRun) {
              rewritten++;
              continue;
            }

            await this.jobVisitCalendarSyncService.updateCalendarEventForJobVisit(
              {
                calendarEventId: jobVisit.calendarEventId,
                externalEventId,
                propertyName,
                propertyAddress,
                clientName,
                scheduledDate: new Date(jobVisit.scheduledDate),
                durationMinutes: jobVisit.duration ?? null,
                notes: jobVisit.notes ?? null,
                workspaceId,
                workspaceMemberId: workspaceMember.id,
              },
            );

            rewritten++;
          } catch (err) {
            failed++;
            this.logger.error(
              `Backfill failed for JobVisit ${jobVisit.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }

        this.logger.log(
          `Workspace ${workspaceId} backfill done: ${rewritten} rewritten, ${skipped} skipped, ${failed} failed`,
        );
      },
      authContext,
    );

    return {
      workspaceId,
      totalCandidates,
      rewritten,
      skipped,
      failed,
      preview,
    };
  }

  private buildAddressString(
    property: PropertyWorkspaceEntity | null,
  ): string | null {
    if (!property?.address) {
      return null;
    }

    const address = property.address;
    const parts = [
      address.addressStreet1,
      address.addressStreet2,
      address.addressCity,
      address.addressState,
      address.addressZipCode,
    ]
      .map((part) => (part ?? '').trim())
      .filter((part) => part.length > 0);

    return parts.length > 0 ? parts.join(', ') : null;
  }

  private buildClientName(
    property: PropertyWorkspaceEntity | null,
  ): string | null {
    if (!property) return null;

    const person = property.person as PersonWorkspaceEntity | null;
    if (person?.name) {
      const first = (person.name.firstName ?? '').trim();
      const last = (person.name.lastName ?? '').trim();
      const full = `${first} ${last}`.trim();
      if (full.length > 0) return full;
    }

    const company = property.company as CompanyWorkspaceEntity | null;
    if (company?.name && company.name.trim().length > 0) {
      return company.name.trim();
    }

    return null;
  }
}
