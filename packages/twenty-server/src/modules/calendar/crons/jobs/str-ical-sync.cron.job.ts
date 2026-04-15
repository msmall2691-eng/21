import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';

/**
 * Cron job to periodically sync STR (Short-Term Rental) iCal feeds.
 *
 * Runs every 6 hours to:
 * 1. Fetch iCal feeds from all STR properties
 * 2. Parse checkout events
 * 3. Create corresponding JobVisits
 * 4. JobVisits automatically sync to Google Calendar
 *
 * This keeps the CRM in sync with external PMS (Airbnb, VRBO, etc.)
 * and ensures customers see their cleaning schedules in Google Calendar.
 */
@Injectable()
export class StrIcalSyncCronJob {
  private readonly logger = new Logger(StrIcalSyncCronJob.name);

  constructor(
    private readonly workspaceService: WorkspaceService,
    @InjectMessageQueue(MessageQueue.calendarQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async syncAllStrProperties(): Promise<void> {
    try {
      this.logger.log('Starting STR iCal sync cron job');

      // Get all active workspaces
