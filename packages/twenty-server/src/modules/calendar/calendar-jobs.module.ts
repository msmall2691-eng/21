import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { SyncJobVisitsToCalendarCronCommand } from 'src/modules/calendar/commands/sync-job-visits-to-calendar.cron.command';
import {
  SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN,
  SyncJobVisitsToCalendarCronJob,
  SyncJobVisitsToCalendarJob,
} from 'src/modules/calendar/jobs/sync-job-visits-to-calendar.job';
import { JobVisitCalendarSyncService } from 'src/modules/calendar/services/job-visit-calendar-sync.service';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { OAuth2ClientManagerModule } from 'src/modules/connected-account/oauth2-client-manager/oauth2-client-manager.module';

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
export class CalendarJobsModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(CalendarJobsModule.name);

  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.messageQueueService.addCron<undefined>({
        jobName: SyncJobVisitsToCalendarCronJob.name,
        data: undefined,
        options: {
          repeat: {
            pattern: SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN,
          },
        },
      });
      this.logger.log(
        `Registered cron ${SyncJobVisitsToCalendarCronJob.name} with pattern "${SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN}"`,
      );

      // Kick one run immediately so we don't wait up to 30 minutes for the first tick.
      await this.messageQueueService.add<undefined>(
        SyncJobVisitsToCalendarCronJob.name,
        undefined,
      );
      this.logger.log(
        `Enqueued immediate bootstrap run of ${SyncJobVisitsToCalendarCronJob.name}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to register ${SyncJobVisitsToCalendarCronJob.name} cron on bootstrap`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
