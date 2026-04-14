import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SyncJobVisitsToCalendarCronJob, SyncJobVisitsToCalendarJob } from 'src/modules/calendar/jobs/sync-job-visits-to-calendar.job';
import { JobVisitCalendarSyncService } from 'src/modules/calendar/services/job-visit-calendar-sync.service';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity]),
    ConnectedAccountModule,
  ],
  providers: [
    SyncJobVisitsToCalendarCronJob,
    SyncJobVisitsToCalendarJob,
    JobVisitCalendarSyncService,
  ],
  exports: [JobVisitCalendarSyncService],
})
export class CalendarJobsModule {}
