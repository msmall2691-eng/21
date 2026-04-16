import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Injectable } from '@nestjs/common';
import { SendEmailService } from 'src/modules/messaging/message-outbound-manager/services/send-email.service';
import { ConnectedAccountMetadataService } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { EmailComposerService } from 'src/engine/core-modules/tool/tools/email-tool/email-composer.service';
import { ScheduledMessageJob } from './scheduled-message.service';

@Injectable()
@Processor('scheduled-messages')
export class ScheduledMessageProcessor {
  private readonly logger = new Logger(ScheduledMessageProcessor.name);

  constructor(
    private readonly sendEmailService: SendEmailService,
    private readonly connectedAccountMetadataService: ConnectedAccountMetadataService,
    private readonly emailComposerService: EmailComposerService,
  ) {}

  @Process('send-scheduled-email')
  async handleScheduledEmail(job: Job<ScheduledMessageJob>) {
    try {
      const {
        sendEmailInput,
        workspaceId,
        connectedAccountId,
      } = job.data;

      this.logger.log(
        `Processing scheduled email job ${job.id}`,
        { to: sendEmailInput.to, subject: sendEmailInput.subject },
      );

      const connectedAccount =
        await this.connectedAccountMetadataService.getConnectedAccount(
          connectedAccountId,
          workspaceId,
        );

      if (!connectedAccount) {
        throw new Error(
          `Connected account ${connectedAccountId} not found`,
        );
      }

      const result = await this.emailComposerService.composeEmail(
        {
          recipients: {
            to: sendEmailInput.to,
            cc: sendEmailInput.cc ?? '',
            bcc: sendEmailInput.bcc ?? '',
          },
          subject: sendEmailInput.subject,
          body: sendEmailInput.body,
          connectedAccountId,
          files: [],
          inReplyTo: sendEmailInput.inReplyTo,
        },
        { workspaceId },
      );

      if (!result.success) {
        throw new Error(
          result.output.error ??
            result.output.message ??
            'Failed to compose email',
        );
      }

      const { data } = result;

      const sendResult = await this.sendEmailService.sendComposedEmail(data);

      await this.sendEmailService.persistSentMessage(
        sendResult,
        data,
        workspaceId,
      );

      this.logger.log(
        `Scheduled email sent successfully`,
        { jobId: job.id, to: sendEmailInput.to },
      );
    } catch (error) {
      this.logger.error(
        `Failed to process scheduled email: ${error}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }
}
