import { Injectable, Logger } from '@nestjs/common';

import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { SentryCronMonitor } from 'src/engine/core-modules/cron/sentry-cron-monitor.decorator';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

export const SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN = '0 */30 * * * *'; // Every 30 minutes

export type SyncJobVisitsToCalendarJobData = {
  workspaceId: string;
};

/**
 * Cron job that triggers periodic syncing of JobVisits to Google Calendar.
 *
 * Pattern: Every 30 minutes
 * Enqueues sync jobs for each active workspace.
 */
@Processor({
  queueName: MessageQueue.cronQueue,
})
export class SyncJobVisitsToCalendarCronJob {
  private readonly logger = new Logger(SyncJobVisitsToCalendarCronJob.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectMessageQueue(MessageQueue.generalQueue)
    private readonly messageQueueService: MessageQueueService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @Process(SyncJobVisitsToCalendarCronJob.name)
  @SentryCronMonitor(
    SyncJobVisitsToCalendarCronJob.name,
    SYNC_JOB_VISITS_TO_CALENDAR_CRON_PATTERN,
  )
  async handle(): Promise<void> {
    const activeWorkspaces = await this.workspaceRepository.find({
      where: {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      },
    });

    for (const workspace of activeWorkspaces) {
      try {
        await this.messageQueueService.add<SyncJobVisitsToCalendarJobData>(
          SyncJobVisitsToCalendarJob.name,
          {
            workspaceId: workspace.id,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to enqueue sync job for workspace ${workspace.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.exceptionHandlerService.captureExceptions([error], {
          workspace: { id: workspace.id },
        });
      }
    }
  }
}

/**
 * Actual job that syncs JobVisits to Google Calendar.
 * Runs once per workspace per cron cycle.
 */
@Injectable()
export class SyncJobVisitsToCalendarJob {
  private readonly logger = new Logger(SyncJobVisitsToCalendarJob.name);

  constructor() {}

  static name = 'SyncJobVisitsToCalendarJob';

  @Process(SyncJobVisitsToCalendarJob.name)
  async handle(data: SyncJobVisitsToCalendarJobData): Promise<void> {
    try {
      this.logger.debug(
        `Syncing JobVisits to calendar for workspace ${data.workspaceId}`,
      );

      // TODO: Implement actual sync logic
      // This is a placeholder for now. The actual implementation would:
      // 1. Query JobVisits without calendar events
      // 2. Create CalendarEvent records via JobVisitCalendarSyncService
      // 3. Update JobVisit with calendarEventId
    } catch (error) {
      this.logger.error(
        `Failed to sync job visits for workspace ${data.workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
