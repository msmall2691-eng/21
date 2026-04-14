import { Module } from '@nestjs/common';

import { SmsService } from './services/sms.service';
import { TwilioWebhookController } from './controllers/twilio-webhook.controller';
import { SmsConversationResolver } from './resolvers/sms-conversation.resolver';
import { SmsMessageResolver } from './resolvers/sms-message.resolver';

@Module({
  providers: [SmsService, SmsConversationResolver, SmsMessageResolver],
  controllers: [TwilioWebhookController],
  exports: [SmsService],
})
export class SmsManagerModule {}
