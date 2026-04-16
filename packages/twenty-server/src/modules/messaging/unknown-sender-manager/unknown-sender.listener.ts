import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UnknownSenderLeadCreatorService } from './unknown-sender-lead-creator.service';

export interface MessageImportedEvent {
  from: string;
  subject: string;
  body: string;
  messageId: string;
  threadId: string;
  receivedAt: Date;
  workspaceId: string;
  isFromKnownContact: boolean;
}

@Injectable()
export class UnknownSenderListener {
  private readonly logger = new Logger(UnknownSenderListener.name);

  constructor(
    private readonly leadCreatorService: UnknownSenderLeadCreatorService,
  ) {}

  @OnEvent('message.imported')
  async handleMessageImported(event: MessageImportedEvent) {
    try {
      // Only process if sender is unknown/not in contacts
      if (event.isFromKnownContact) {
        return;
      }

      this.logger.log(
        `Processing message from unknown sender: ${event.from}`,
      );

      await this.leadCreatorService.createLeadFromUnknownSender(
        {
          from: event.from,
          subject: event.subject,
          body: event.body,
          messageId: event.messageId,
          threadId: event.threadId,
          receivedAt: event.receivedAt,
        },
        event.workspaceId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle unknown sender message: ${error}`,
        error instanceof Error ? error.stack : '',
      );
    }
  }
}
