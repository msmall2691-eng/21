import { Module } from '@nestjs/common';
import { SmsOutboundService } from './services/sms-outbound.service';
import { SendSmsResolver } from './resolvers/send-sms.resolver';

@Module({
  providers: [SmsOutboundService, SendSmsResolver],
  exports: [SmsOutboundService],
})
export class SmsOutboundModule {}
