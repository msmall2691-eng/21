import { Module } from '@nestjs/common';

import { MessagingBlocklistManagerModule } from 'src/modules/messaging/blocklist-manager/messaging-blocklist-manager.module';
import { MessagingMessageCleanerModule } from 'src/modules/messaging/message-cleaner/messaging-message-cleaner.module';
import { MessagingImportManagerModule } from 'src/modules/messaging/message-import-manager/messaging-import-manager.module';
import { MessageParticipantManagerModule } from 'src/modules/messaging/message-participant-manager/message-participant-manager.module';
import { MessagingMonitoringModule } from 'src/modules/messaging/monitoring/messaging-monitoring.module';

// SmsManagerModule removed - has broken imports to non-existent engine paths
// (src/engine/decorators/auth/auth-context.decorator does not exist in Twenty v1.21)
// Re-add once SMS feature imports are fixed

@Module({
  imports: [
    MessagingImportManagerModule,
    MessagingMessageCleanerModule,
    MessageParticipantManagerModule,
    MessagingBlocklistManagerModule,
    MessagingMonitoringModule,
  ],
  providers: [],
  exports: [MessagingImportManagerModule],
})
export class MessagingModule {}
