import { Module } from '@nestjs/common';

import { CalendarBlocklistManagerModule } from 'src/modules/calendar/blocklist-manager/calendar-blocklist-manager.module';
import { CalendarEventCleanerModule } from 'src/modules/calendar/calendar-event-cleaner/calendar-event-cleaner.module';
import { CalendarEventImportManagerModule } from 'src/modules/calendar/calendar-event-import-manager/calendar-event-import-manager.module';
import { CalendarEventParticipantManagerModule } from 'src/modules/calendar/calendar-event-participant-manager/calendar-event-participant-manager.module';
import { CalendarCommonModule } from 'src/modules/calendar/common/calendar-common.module';
import { CalendarCompletionHandlerModule } from 'src/modules/calendar/calendar-completion-handler/calendar-completion-handler.module';
import { StrIcalSyncModule } from 'src/modules/calendar/str-ical-sync/str-ical-sync.module';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';

/**
 * Core calendar module wiring up common calendar sub-modules (imports,
 * blocklist, cleaner, participant manager, etc.).
 *
 * NOTE: JobVisit -> Google Calendar sync lives in CalendarJobsModule
 * (see calendar-jobs.module.ts). It used to be duplicated here as a
 * provider/export, which caused NestJS to resolve its dependencies from
 * this module as well and blew up at boot when OAuth2ClientManagerModule
 * wasn't imported. Keeping it in exactly one place (CalendarJobsModule)
 * avoids that class of bug.
 */
@Module({
  imports: [
    CalendarBlocklistManagerModule,
    CalendarEventCleanerModule,
    CalendarEventImportManagerModule,
    CalendarEventParticipantManagerModule,
    CalendarCommonModule,
    CalendarCompletionHandlerModule,
    StrIcalSyncModule,
    ConnectedAccountModule,
  ],
  providers: [],
  exports: [],
})
export class CalendarModule {}
