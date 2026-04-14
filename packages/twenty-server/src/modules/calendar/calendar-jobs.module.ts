import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SyncJobVisitsToCalendarCronCommand } from 'src/modules/calendar/commands/sync-job-visits-to-calendar.cron.command';
import { SyncJobVisitsToCalendarCronJob, SyncJobVisitsToCalendarJob } from 'src/modules/calendar/jobs/sync-job-visits-to-calendar.job';
import { JobVisitCalendarSyncService } from 'src/modules/calendar/services/job-visit-calendar-sync.service';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { OAuth2ClientManagerModule } from 'src/modules/connected-account/oauth2-client-manager/oauth2-client-manager.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity]),
    ConnectedAccountModule,
    OAuth2ClientManagerModule,
  ],
  providers: [
    SyncJobVisitsToCalendarCronJob,
    SyncJobVisitsToCalendarJob,
    JobVisitCalendarSyncService,
    SyncJobVisitsToCalendarCronCommand,
  ],
  exports: [JobVisitCalendarSyncService],
})
export class CalendarJobsModule {}
