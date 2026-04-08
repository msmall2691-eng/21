import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  CalendarEventWithCleaningsDTO,
  CalendarWithCleaningsResponseDTO,
  type CalendarEventWithCleaningsType,
} from 'src/engine/core-modules/calendar/dtos/calendar-with-cleanings.dto';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';
import { type StaffMemberWorkspaceEntity } from 'src/modules/staff-member/standard-objects/staff-member.workspace-entity';

interface GetCalendarWithCleaningsArgs {
  workspaceId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  propertyIds?: string[];
}

@Injectable()
export class CalendarWithCleaningsService {
  private readonly logger = new Logger(CalendarWithCleaningsService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async getCalendarWithCleanings(
    args: GetCalendarWithCleaningsArgs,
  ): Promise<CalendarWithCleaningsResponseDTO> {
    const { workspaceId, startDate, endDate, propertyIds } = args;

    try {
      const authContext = buildSystemAuthContext();

      // Get calendar events
      const calendarEventRepository =
        await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
          workspaceId,
          'calendarEvent',
          authContext,
        );

      const calendarEvents = await calendarEventRepository.find({
        where: {
          startsAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        relations: [],
      });

      // Get cleaning jobs (job visits with scheduling context)
      const jobVisitRepository =
        await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
          workspaceId,
          'jobVisit',
          authContext,
        );

      const cleaningJobsQuery = jobVisitRepository.createQueryBuilder('jobVisit')
        .leftJoinAndSelect('jobVisit.property', 'property')
        .leftJoinAndSelect('jobVisit.staffMember', 'staffMember')
        .where('jobVisit.scheduledDate >= :startDate', { startDate: new Date(startDate) })
        .andWhere('jobVisit.scheduledDate <= :endDate', { endDate: new Date(endDate) });

      if (propertyIds && propertyIds.length > 0) {
        cleaningJobsQuery.andWhere('jobVisit.propertyId IN (:...propertyIds)', { propertyIds });
      }

      const cleaningJobs = await cleaningJobsQuery.getMany();

      // Convert to unified format
      const calendarEvents_mapped: CalendarEventWithCleaningsType[] =
        calendarEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location,
          description: event.description,
          isCanceled: event.isCanceled,
          isFullDay: event.isFullDay,
          type: 'CALENDAR_EVENT' as const,
        }));

      const cleaningJobs_mapped: CalendarEventWithCleaningsType[] = cleaningJobs.map(
        (job) => ({
          id: job.id,
          title: job.name || `Cleaning: ${job.property?.name || 'Unknown Property'}`,
          startsAt: job.scheduledDate,
          endsAt: job.scheduledDate, // Cleaning jobs are point-in-time
          location: job.property?.address || null,
          description: job.notes || null,
          isCanceled: false,
          isFullDay: false,
          type: 'CLEANING_JOB' as const,
          cleaningId: job.id,
          propertyId: job.propertyId,
          propertyName: job.property?.name,
          propertyAddress: job.property?.address,
          guestNote: job.notes,
          assignedStaffName: job.staffMember
            ? `${job.staffMember.firstName || ''} ${job.staffMember.lastName || ''}`.trim()
            : null,
          status: job.status,
          serviceAgreementId: job.serviceAgreementId,
        }),
      );

      // Combine and sort by start date
      const allEvents = [...calendarEvents_mapped, ...cleaningJobs_mapped].sort(
        (a, b) => {
          const dateA = new Date(a.startsAt || 0).getTime();
          const dateB = new Date(b.startsAt || 0).getTime();
          return dateA - dateB;
        },
      );

      const dtos: CalendarEventWithCleaningsDTO[] = allEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        description: event.description,
        isCanceled: event.isCanceled,
        isFullDay: event.isFullDay,
        type: event.type,
        cleaningId: event.cleaningId,
        propertyId: event.propertyId,
        propertyName: event.propertyName,
        propertyAddress: event.propertyAddress,
        guestNote: event.guestNote,
        assignedStaffName: event.assignedStaffName,
        status: event.status,
        serviceAgreementId: event.serviceAgreementId,
      }));

      return {
        events: dtos,
        totalCount: dtos.length,
        startDate,
        endDate,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching calendar with cleanings for workspace ${workspaceId}`,
        error,
      );
      throw error;
    }
  }
}
