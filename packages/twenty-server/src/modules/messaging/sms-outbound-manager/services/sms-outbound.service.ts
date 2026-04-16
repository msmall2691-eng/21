import { Injectable, Logger } from '@nestjs/common';
import * as twilio from 'twilio';

export interface SendSMSInput {
  to: string;
  body: string;
  inReplyTo?: string;
}

@Injectable()
export class SmsOutboundService {
  private readonly logger = new Logger(SmsOutboundService.name);
  private client: ReturnType<typeof twilio.default> | null = null;

  private readonly accountSid = process.env.TWILIO_ACCOUNT_SID;
  private readonly authToken = process.env.TWILIO_AUTH_TOKEN;
  private readonly fromNumber = process.env.TWILIO_PHONE_NUMBER;

  constructor() {
    if (this.isConfigured()) {
      this.client = twilio.default(this.accountSid, this.authToken);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  async sendSMS(input: SendSMSInput): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    if (!this.isConfigured() || !this.client) {
      const error = 'SMS service not configured';
      this.logger.warn(error);
      return { success: false, error };
    }

    try {
      this.logger.log(`Sending SMS to ${input.to}`);

      const result = await this.client.messages.create({
        body: input.body,
        from: this.fromNumber,
        to: input.to,
      });

      this.logger.log(`SMS sent successfully: ${result.sid} to ${input.to}`);

      return {
        success: true,
        messageSid: result.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send SMS to ${input.to}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async scheduleSMS(
    input: SendSMSInput,
    sendAt: Date,
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    // Placeholder for scheduling SMS
    // In production, use BullMQ like email scheduling
    const delay = sendAt.getTime() - Date.now();

    if (delay < 0) {
      this.logger.warn('Scheduled time is in the past, sending immediately');
      return this.sendSMS(input);
    }

    // Would queue with SMS scheduler job
    this.logger.log(`SMS scheduled for ${sendAt.toISOString()} to ${input.to}`);

    return {
      success: true,
      jobId: `sms-scheduled-${Date.now()}`,
    };
  }
}
