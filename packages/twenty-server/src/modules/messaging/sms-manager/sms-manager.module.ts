import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { SmsService } from './services/sms.service';
import { TwilioWebhookController } from './controllers/twilio-webhook.controller';
import { SmsConversationResolver } from './resolvers/sms-conversation.resolver';
import { SmsMessageResolver } from './resolvers/sms-message.resolver';

@Module({
  // JwtAuthGuard (used by SmsConversationResolver / SmsMessageResolver via
  // @UseGuards) needs AccessTokenService + WorkspaceCacheStorageService.
  // Without these imports, Nest DI fails on boot with:
  //   "Nest can't resolve dependencies of the JwtAuthGuard
  //    (?, WorkspaceCacheStorageService). ... SmsManagerModule module."
  imports: [TokenModule, WorkspaceCacheStorageModule],
  providers: [SmsService, SmsConversationResolver, SmsMessageResolver],
  controllers: [TwilioWebhookController],
  exports: [SmsService],
})
export class SmsManagerModule {}
