import { Controller, Post, Param, Logger } from '@nestjs/common';

import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

/**
 * API endpoints for manual STR iCal sync control.
 *
 * POST /webhooks/str-ical-sync/:workspaceId
 *   Trigger full sync for all STR properties in workspace
 *
 * POST /webhooks/str-ical-sync/:workspaceId/property/:propertyId
 *   Trigger sync for specific property (useful when iCal URL just added)
 */
@Controller('webhooks/str-ical-sync')
export class StrIcalSyncController {
  private readonly logger = new Logger(StrIcalSyncController.name);

  constructor(
    @InjectMessageQueue(MessageQueue.generalQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  @Post(':workspaceId')
  async syncWorkspace(@Param('workspaceId') workspaceId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (!workspaceId) {
        return {
          success: false,
          message: 'Workspace ID is required',
        };
      }

      // Queue sync job for all properties in workspace
      await this.messageQueueService.add('str-ical-sync', {
        workspaceId,
      });

      this.logger.log(
        `Queued STR iCal sync for all properties in workspace ${workspaceId}`,
      );

      return {
        success: true,
        message: `STR iCal sync queued for workspace ${workspaceId}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue STR iCal sync: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        success: false,
        message: `Failed to queue sync: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  @Post(':workspaceId/property/:propertyId')
  async syncProperty(
    @Param('workspaceId') workspaceId: string,
    @Param('propertyId') propertyId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (!workspaceId || !propertyId) {
        return {
          success: false,
          message: 'Workspace ID and Property ID are required',
        };
      }

      // Queue sync job for specific property
      await this.messageQueueService.add('str-ical-sync', {
        workspaceId,
        propertyId,
      });

      this.logger.log(
        `Queued STR iCal sync for property ${propertyId} in workspace ${workspaceId}`,
      );

      return {
        success: true,
        message: `STR iCal sync queued for property ${propertyId}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue STR iCal sync for property: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        success: false,
        message: `Failed to queue sync: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
