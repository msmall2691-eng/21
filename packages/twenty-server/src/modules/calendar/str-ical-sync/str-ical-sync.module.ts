import { Module } from '@nestjs/common';

import { StrIcalSyncService } from 'src/modules/calendar/services/str-ical-sync.service';
import { StrIcalSyncJob } from 'src/modules/calendar/jobs/str-ical-sync.job';

/**
 * Module for STR (Short-Term Rental) iCal synchronization.
 *
 * Provides:
 * - StrIcalSyncService: Core logic for fetching and parsing iCal feeds
 * - StrIcalSyncJob: Background job processor
 *
 * TEMPORARILY REMOVED (dependency resolution issues):
 * - StrIcalSyncCronJob: needs WorkspaceService + calendarQueue
 * - StrIcalSyncController: uses non-existent MessageQueue.generalQueue
 *
 * These can be re-added once proper dependency wiring is in place.
 *
 * Integration:
 * - Reads Property.icalSyncUrl (Airbnb, VRBO, etc.)
 * - Creates JobVisits for checkout events
 * - JobVisitCalendarSyncService automatically syncs to Google Calendar
 */
@Module({
  providers: [StrIcalSyncService, StrIcalSyncJob],
  exports: [StrIcalSyncService],
})
export class StrIcalSyncModule {}
