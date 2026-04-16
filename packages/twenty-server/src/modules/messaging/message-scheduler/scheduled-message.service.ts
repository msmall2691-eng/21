import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SendEmailInput } from 'src/modules/messaging/message-outbound-manager/dtos/send-email.input';

export interface ScheduledMessageJob {
  sendEmailInput: SendEmailInput;
  userWorkspaceId: string;
  workspaceId: string;
  connectedAccountId: string;
}

@Injectable()
export class ScheduledMessageService {
  private readonly logger = new Logger(ScheduledMessageService.name);

  constructor(
    @InjectQueue('scheduled-messages') private scheduledMessagesQueue: Queue,
  ) {}

  async scheduleEmail(
    sendEmailInput: SendEmailInput,
    userWorkspaceId: string,
    workspaceId: string,
    connectedAccountId: string,
    sendAt: Date,
  ): Promise<void> {
    const delay = sendAt.getTime() - Date.now();

    if (delay < 0) {
      this.logger.warn(
        'Scheduled time is in the past, sending immediately',
        { sendAt },
      );
      // Send immediately if time is in the past
      return;
    }

    try {
      await this.scheduledMessagesQueue.add(
        'send-scheduled-email',
        {
          sendEmailInput,
          userWorkspaceId,
          workspaceId,
          connectedAccountId,
        } as ScheduledMessageJob,
        {
          delay,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(`Email scheduled to send at ${sendAt.toISOString()}`, {
        to: sendEmailInput.to,
        subject: sendEmailInput.subject,
      });
    } catch (error) {
      this.logger.error(
        `Failed to schedule email: ${error}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  async getScheduledMessages(
    workspaceId: string,
  ): Promise<Array<{ id: string; data: ScheduledMessageJob; delay: number }>> {
    const jobs = await this.scheduledMessagesQueue.getDelayed();

    return jobs
      .filter((job) => job.data.workspaceId === workspaceId)
      .map((job) => ({
        id: job.id?.toString() || '',
        data: job.data as ScheduledMessageJob,
        delay: job.delay || 0,
      }));
  }

  async cancelScheduledMessage(jobId: string): Promise<void> {
    const job = await this.scheduledMessagesQueue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    this.logger.log(`Scheduled message ${jobId} cancelled`);
  }
}
