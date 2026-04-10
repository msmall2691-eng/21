import { Injectable, Logger } from '@nestjs/common';
import * as twilio from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
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

  async sendSMS(to: string, message: string): Promise<string | null> {
    if (!this.isConfigured() || !this.client) {
      this.logger.warn('Twilio not configured');
      return null;
    }

    try {
      this.logger.debug(`Sending SMS to ${to}`);
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to,
      });

      this.logger.log(`SMS sent successfully: ${result.sid}`);
      return result.sid;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}:`, error);
      return null;
    }
  }

  async sendApprovalQuoteSMS(
    phone: string,
    name: string,
    estimateRange: string,
    approvalLink: string,
  ): Promise<string | null> {
    const message = `Hi ${name}! 👋 Your quote is ${estimateRange}. Click to approve: ${approvalLink} (expires 24h). Reply YES to approve! 🎉`;
    return this.sendSMS(phone, message);
  }

  async sendPaymentSMS(
    phone: string,
    name: string,
    amount: string,
    paymentLink: string,
  ): Promise<string | null> {
    const message = `Hi ${name}! 💳 Your invoice for ${amount} is ready. Pay here: ${paymentLink}. Thank you!`;
    return this.sendSMS(phone, message);
  }

  async sendConfirmationSMS(
    phone: string,
    name: string,
  ): Promise<string | null> {
    const message = `Hi ${name}! ✅ Payment received! We'll be in touch with scheduling details. Thank you!`;
    return this.sendSMS(phone, message);
  }

  parseTwilioWebhook(body: Record<string, string | string[]>): {
    from: string;
    to: string;
    body: string;
    messageSid: string;
  } | null {
    const from = Array.isArray(body.From) ? body.From[0] : body.From;
    const to = Array.isArray(body.To) ? body.To[0] : body.To;
    const message = Array.isArray(body.Body) ? body.Body[0] : body.Body;
    const messageSid = Array.isArray(body.MessageSid)
      ? body.MessageSid[0]
      : body.MessageSid;

    if (!from || !to || !message || !messageSid) {
      return null;
    }

    return {
      from,
      to,
      body: message,
      messageSid,
    };
  }

  isApprovalResponse(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return /^(yes|yeah|yep|approve|confirmed|confirm|ok|okay|1|true)$/.test(
      normalized,
    );
  }

  isRejectionResponse(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return /^(no|nope|reject|rejected|0|false)$/.test(normalized);
  }
}
