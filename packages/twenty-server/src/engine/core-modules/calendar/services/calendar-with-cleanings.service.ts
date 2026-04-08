import { Injectable, Logger } from '@nestjs/common';

import { type FullNameMetadata } from 'twenty-shared/types';
import { Any } from 'typeorm';

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

  private formatAddressMetadata(address: any | null | undefined): string | null {
    if (!address) return null;
    const parts = [
      address.addressStreet1,
      address.addressCity,
      address.addressState,
      address.addressCountry,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  async getCalendarWithCleanings(
    args: GetCalendarWithCleaningsArgs,
  ): Promise<CalendarWithCleaningsResponseDTO> {
    const { workspaceId, startDate, endDate, propertyIds } = args;

    try {
      const authContext = buildSystemAuthContext(workspaceId);

      return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);

          // Get calendar events
          const calendarEventRepository =
            await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
              workspaceId,
              'calendarEvent',
            );

          const calendarEvents = await calendarEventRepository.find({
            where: {},
          });

          // Filter calendar events by date range in memory (since TypeORM operators may vary)
          const filteredCalendarEvents = calendarEvents.filter(
            (event) =>
              event.startsAt &&
              new Date(event.startsAt) >= startDateObj &&
              new Date(event.startsAt) <= endDateObj,
          );

          // Get cleaning jobs (job visits with scheduling context)
          const jobVisitRepository =
            await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
              workspaceId,
              'jobVisit',
            );

          const cleaningJobsQuery = jobVisitRepository.find({
            relations: {
              property: true,
              staffMember: true,
            },
          });

          const cleaningJobs = await cleaningJobsQuery;

          // Filter by date range and property IDs in memory
          const filteredCleaningJobs = cleaningJobs.filter((job) => {
            if (!job.scheduledDate) return false;
            const jobDate = new Date(job.scheduledDate);
            const isInDateRange = jobDate >= startDateObj && jobDate <= endDateObj;
            const isInProperties =
              !propertyIds ||
              propertyIds.length === 0 ||
              (job.propertyId ? propertyIds.includes(job.propertyId) : false);
            return isInDateRange && isInProperties;
          });

          // Convert to unified format
          const calendarEvents_mapped: CalendarEventWithCleaningsType[] =
            filteredCalendarEvents.map((event) => ({
              id: event.id,
              title: event.title,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              location: event.location || null,
              description: event.description,
              isCanceled: event.isCanceled,
              isFullDay: event.isFullDay,
              type: 'CALENDAR_EVENT' as const,
            }));

          const cleaningJobs_mapped: CalendarEventWithCleaningsType[] = filteredCleaningJobs.map(
            (job) => {
              const staffName = job.staffMember?.name
                ? `${(job.staffMember.name as FullNameMetadata)?.firstName || ''} ${(job.staffMember.name as FullNameMetadata)?.lastName || ''}`.trim()
                : null;

              const propertyAddressStr = this.formatAddressMetadata(job.property?.address);

              return {
                id: job.id,
                title: job.name || `Cleaning: ${job.property?.name || 'Unknown Property'}`,
                startsAt: job.scheduledDate,
                endsAt: job.scheduledDate,
                location: propertyAddressStr,
                description: job.notes || null,
                isCanceled: false,
                isFullDay: false,
                type: 'CLEANING_JOB' as const,
                cleaningId: job.id,
                propertyId: job.propertyId || null,
                propertyName: job.property?.name || null,
                propertyAddress: job.property?.address || null,
                guestNote: job.notes || null,
                assignedStaffName: staffName,
                status: job.status || null,
                serviceAgreementId: job.serviceAgreementId || null,
              };
            },
          );

          // Combine and sort by start date
          const allEvents = [...calendarEvents_mapped, ...cleaningJobs_mapped].sort((a, b) => {
            const dateA = new Date(a.startsAt || 0).getTime();
            const dateB = new Date(b.startsAt || 0).getTime();
            return dateA - dateB;
          });

          const dtos: CalendarEventWithCleaningsDTO[] = allEvents.map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            location: typeof event.location === 'string' ? event.location : this.formatAddressMetadata(event.location),
            description: event.description,
            isCanceled: event.isCanceled,
            isFullDay: event.isFullDay,
            type: event.type,
            cleaningId: event.cleaningId,
            propertyId: event.propertyId,
            propertyName: event.propertyName,
            propertyAddress: event.propertyAddress ? this.formatAddressMetadata(event.propertyAddress) : null,
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
        },
        authContext,
      );
    } catch (error) {
      this.logger.error(
        `Error fetching calendar with cleanings for workspace ${workspaceId}`,
        error,
      );
      throw error;
    }
  }
}
