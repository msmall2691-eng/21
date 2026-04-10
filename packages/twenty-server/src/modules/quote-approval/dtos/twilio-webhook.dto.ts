export class TwilioWebhookDto {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  AccountSid?: string;
  SmsMessageSid?: string;
  NumMedia?: string;
}
