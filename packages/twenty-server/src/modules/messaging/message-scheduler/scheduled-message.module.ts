import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduledMessageService } from 'src/modules/messaging/message-scheduler/scheduled-message.service';
import { ScheduledMessageProcessor } from 'src/modules/messaging/message-scheduler/scheduled-message.processor';
import { SendEmailModule } from 'src/modules/messaging/message-outbound-manager/send-email.module';
import { ConnectedAccountMetadataService } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { EmailComposerService } from 'src/engine/core-modules/tool/tools/email-tool/email-composer.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scheduled-messages',
    }),
    SendEmailModule,
  ],
  providers: [
    ScheduledMessageService,
    ScheduledMessageProcessor,
    ConnectedAccountMetadataService,
    EmailComposerService,
  ],
  exports: [ScheduledMessageService],
})
export class ScheduledMessageModule {}
