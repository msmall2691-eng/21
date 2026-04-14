import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SyncJobVisitsToCalendarCronJob, SyncJobVisitsToCalendarJob } from 'src/modules/calendar/jobs/sync-job-visits-to-calendar.job';
import { JobVisitCalendarSyncService } from 'src/modules/calendar/services/job-visit-calendar-sync.service';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity], 'core'),
    ConnectedAccountModule,
  ],
  providers: [
    SyncJobVisitsToCalendarCronJob,
    SyncJobVisitsToCalendarJob,
    JobVisitCalendarSyncService,
    ExceptionHandlerService,
  ],
  exports: [JobVisitCalendarSyncService],
})
export class CalendarJobsModule {}
