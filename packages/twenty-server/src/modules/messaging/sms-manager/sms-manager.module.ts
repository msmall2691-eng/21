import { Module } from '@nestjs/common';

import { SmsService } from './services/sms.service';
import { TwilioWebhookController } from './controllers/twilio-webhook.controller';

@Module({
  providers: [SmsService],
  controllers: [TwilioWebhookController],
  exports: [SmsService],
})
export class SmsManagerModule {}
