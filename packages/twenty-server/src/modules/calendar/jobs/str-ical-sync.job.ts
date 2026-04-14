import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { StrIcalSyncService } from 'src/modules/calendar/services/str-ical-sync.service';

export type StrIcalSyncJobData = {
  workspaceId: string;
  propertyId?: string;
};

/**
 * Background job to sync STR (Short-Term Rental) iCal feeds.
 *
 * Runs periodically (every 6 hours) to fetch iCal feeds from STR properties
 * and create JobVisits for checkout dates.
 *
 * Triggered by:
 * - Scheduled cron job (StrIcalSyncCronJob)
 * - Manual sync via API endpoint
 * - Property iCal feed URL updates
 */
@Injectable()
@Processor(MessageQueue.calendarQueue)
export class StrIcalSyncJob {
  private readonly logger = new Logger(StrIcalSyncJob.name);

  constructor(private readonly strIcalSyncService: StrIcalSyncService) {}

  @Process('str-ical-sync')
  async handleStrIcalSync(job: Job<StrIcalSyncJobData>): Promise<void> {
    const { workspaceId, propertyId } = job.data;

    try {
      this.logger.log(
        `Starting STR iCal sync for workspace ${workspaceId}${propertyId ? ` (property: ${propertyId})` : ''}`,
      );

      const result = await this.strIcalSyncService.syncStrProperties({
        workspaceId,
        propertyId,
      });

      this.logger.log(
        `STR iCal sync completed: processed=${result.processed}, created=${result.created}, errors=${result.errors.length}`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`Sync errors: ${result.errors.join('; ')}`);
      }
    } catch (error) {
      this.logger.error(
        `STR iCal sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
