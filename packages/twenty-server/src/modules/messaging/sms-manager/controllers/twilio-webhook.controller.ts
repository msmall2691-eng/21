import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  Param,
} from '@nestjs/common';

import { SmsService } from '../services/sms.service';

@Controller('webhooks/twilio/sms')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly smsService: SmsService) {}

  @Post(':workspaceId')
  async handleIncomingSms(
    @Param('workspaceId') workspaceId: string,
    @Body() payload: any,
  ): Promise<{ success: boolean }> {
    try {
      // Validate Twilio webhook payload
      if (!payload.From || !payload.To || !payload.Body || !payload.MessageSid) {
        throw new BadRequestException(
          'Missing required fields: From, To, Body, MessageSid',
        );
      }

      // Log inbound SMS
      this.logger.log(
        `Inbound SMS from ${payload.From} to ${payload.To}: "${payload.Body.substring(0, 50)}..."`,
      );

      // Process the SMS
      await this.smsService.receiveSms({
        fromPhoneNumber: payload.From,
        toPhoneNumber: payload.To,
        body: payload.Body,
        twilioSid: payload.MessageSid,
        workspaceId,
      });

      // Return Twilio response
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to process incoming SMS: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
