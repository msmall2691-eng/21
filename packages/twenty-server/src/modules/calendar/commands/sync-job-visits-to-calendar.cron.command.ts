import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN,
  SyncJobVisitsToCalendarCronJob,
} from 'src/modules/calendar/jobs/sync-job-visits-to-calendar.job';

@Command({
  name: 'cron:calendar:sync-job-visits',
  description:
    'Registers a cron job to periodically sync JobVisits to Google Calendar',
})
export class SyncJobVisitsToCalendarCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.messageQueueService.addCron<undefined>({
      jobName: SyncJobVisitsToCalendarCronJob.name,
      data: undefined,
      options: {
        repeat: {
          pattern: SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN,
        },
      },
    });
  }
}
