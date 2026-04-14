import { Injectable, Logger } from '@nestjs/common';

import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';
import { type WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { JobVisitCalendarSyncService } from 'src/modules/calendar/services/job-visit-calendar-sync.service';

export const SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN = '0 */30 * * * *'; // Every 30 minutes

export type SyncJobVisitsToCalendarJobData = {
  workspaceId: string;
};

/**
 * Cron job that triggers periodic syncing of JobVisits to Google Calendar.
 *
 * Pattern: Every 30 minutes
 * Enqueues sync jobs for each active workspace.
 */
@Processor({
  queueName: MessageQueue.cronQueue,
})
export class SyncJobVisitsToCalendarCronJob {
  private readonly logger = new Logger(SyncJobVisitsToCalendarCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectMessageQueue(MessageQueue.calendarQueue)
    private readonly messageQueueService: MessageQueueService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(SyncJobVisitsToCalendarCronJob.name)
  @SentryCronMonitor(
    SyncJobVisitsToCalendarCronJob.name,
    SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const activeWorkspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      },
    });

    for (const workspace of activeWorkspaces) {
      try {
        await this.messageQueueService.add<SyncJobVisitsToCalendarJobData>(
          SyncJobVisitsToCalendarJob.name,
          {
            workspaceId: workspace.id,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to enqueue sync job for workspace ${workspace.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.exceptionHandlerService.captureExceptions([error], {
          workspace: { id: workspace.id },
        });
      }
    }
  }
}

/**
 * Actual job that syncs JobVisits to Google Calendar.
 * Runs once per workspace per cron cycle.
 *
 * Finds JobVisits that have a scheduledDate but no calendarEventId yet,
 * creates a Google Calendar event for each (via JobVisitCalendarSyncService),
 * and writes the resulting calendarEventId back to the JobVisit.
 */
@Processor({
  queueName: MessageQueue.calendarQueue,
})
export class SyncJobVisitsToCalendarJob {
  private readonly logger = new Logger(SyncJobVisitsToCalendarJob.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly jobVisitCalendarSyncService: JobVisitCalendarSyncService,
  ) {}

  @Process(SyncJobVisitsToCalendarJob.name)
  async handle(data: SyncJobVisitsToCalendarJobData): Promise<void> {
    const { workspaceId } = data;

    try {
      this.logger.debug(
        `Syncing JobVisits to calendar for workspace ${workspaceId}`,
      );

      const authContext = buildSystemAuthContext(workspaceId);

      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          // Pick the first workspace member as the calendar owner.
          // For single-user setups (e.g. Megan @ The Maine Cleaning Co.)
          // this resolves to her account. For multi-user, the JobVisit's
          // staffMember could be preferred in the future.
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
              `No workspace member found in workspace ${workspaceId} - skipping calendar sync`,
            );
            return;
          }

          const jobVisitRepository =
            await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
              workspaceId,
              'jobVisit',
            );

          // Find JobVisits that are scheduled but not yet on the calendar.
          const unsyncedJobVisits = await jobVisitRepository.find({
            where: {
              calendarEventId: IsNull(),
              scheduledDate: Not(IsNull()),
            },
            relations: ['property'],
            take: 100, // cap per-cycle to avoid quota spikes
          });

          if (unsyncedJobVisits.length === 0) {
            this.logger.debug(
              `No unsynced job visits in workspace ${workspaceId}`,
            );
            return;
          }

          this.logger.log(
            `Syncing ${unsyncedJobVisits.length} job visit(s) to Google Calendar for workspace ${workspaceId}`,
          );

          let successCount = 0;
          let failureCount = 0;

          for (const jobVisit of unsyncedJobVisits) {
            try {
              if (!jobVisit.scheduledDate) {
                continue;
              }

              const property = jobVisit.property as
                | PropertyWorkspaceEntity
                | null;

              const propertyName =
                property?.name || jobVisit.name || 'Cleaning visit';

              const propertyAddress = this.buildAddressString(property);

              const { calendarEventId } =
                await this.jobVisitCalendarSyncService.createCalendarEventForJobVisit(
                  {
                    jobVisitId: jobVisit.id,
                    propertyName,
                    propertyAddress,
                    checkoutDate: new Date(jobVisit.scheduledDate),
                    guestNote: jobVisit.notes,
                    icalUid: null,
                    workspaceId,
                    workspaceMemberId: workspaceMember.id,
                  },
                );

              await jobVisitRepository.update(jobVisit.id, {
                calendarEventId,
              });

              successCount++;
            } catch (jobVisitError) {
              failureCount++;
              this.logger.error(
                `Failed to sync job visit ${jobVisit.id}: ${
                  jobVisitError instanceof Error
                    ? jobVisitError.message
                    : String(jobVisitError)
                }`,
              );
              // Swallow per-visit errors so one bad record doesn't
              // block the rest of the batch.
            }
          }

          this.logger.log(
            `JobVisit -> Calendar sync complete for workspace ${workspaceId}: ${successCount} synced, ${failureCount} failed`,
          );
        },
        authContext,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync job visits for workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Build a single-line address string from a Property's AddressMetadata.
   * Returns null if no address components are available.
   */
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
}
