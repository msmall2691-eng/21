import { Module } from '@nestjs/common';

import { StrIcalSyncService } from 'src/modules/calendar/services/str-ical-sync.service';
import { StrIcalSyncJob } from 'src/modules/calendar/jobs/str-ical-sync.job';
import { StrIcalSyncCronJob } from 'src/modules/calendar/crons/jobs/str-ical-sync.cron.job';
import { StrIcalSyncController } from 'src/modules/calendar/controllers/str-ical-sync.controller';

/**
 * Module for STR (Short-Term Rental) iCal synchronization.
 *
 * Provides:
 * - StrIcalSyncService: Core logic for fetching and parsing iCal feeds
 * - StrIcalSyncJob: Background job processor
 * - StrIcalSyncCronJob: Periodic sync (every 6 hours)
 * - StrIcalSyncController: Manual sync endpoints
 *
 * Integration:
 * - Reads Property.icalSyncUrl (Airbnb, VRBO, etc.)
 * - Creates JobVisits for checkout events
 * - JobVisitCalendarSyncService automatically syncs to Google Calendar
 * - Customers can view cleanings in shared Google Calendar
 */
@Module({
  controllers: [StrIcalSyncController],
  providers: [StrIcalSyncService, StrIcalSyncJob, StrIcalSyncCronJob],
  exports: [StrIcalSyncService],
})
export class StrIcalSyncModule {}
