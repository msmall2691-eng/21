import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  Param,
} from '@nestjs/common';

import { GoogleCalendarCompletionHandlerService } from '../services/google-calendar-completion-handler.service';

@Controller('webhooks/google-calendar/completion')
export class GoogleCalendarCompletionController {
  private readonly logger = new Logger(GoogleCalendarCompletionController.name);

  constructor(
    private readonly completionHandlerService: GoogleCalendarCompletionHandlerService,
  ) {}

  @Post(':workspaceId')
  async handleCalendarCompletion(
    @Param('workspaceId') workspaceId: string,
    @Body() payload: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate payload
      if (!workspaceId) {
        throw new BadRequestException('Missing workspaceId parameter');
      }

      this.logger.log(
        `Received Google Calendar completion webhook for workspace ${workspaceId}`,
      );

      // Extract Google Calendar event ID if provided
      const googleCalendarEventId = payload?.eventId || payload?.externalId;

      // Check for completed jobs and generate invoices
      const result =
        await this.completionHandlerService.checkAndGenerateInvoicesForCompletedJobs(
          {
            workspaceId,
            googleCalendarEventId,
          },
        );

      this.logger.log(
        `Processed completion webhook: generated ${result.generatedCount} invoices with ${result.errors.length} errors`,
      );

      return {
        success: result.errors.length === 0,
        message: `Generated ${result.generatedCount} invoices. Errors: ${result.errors.length}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process Google Calendar completion webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
