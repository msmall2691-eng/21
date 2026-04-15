import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { SmsService } from 'src/modules/messaging/sms-manager/services/sms.service';

export type SendInvoiceSmsJobData = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  recipientPhone: string;
  message: string;
  workspaceId: string;
  personId?: string;
};

@Injectable()
@Processor(MessageQueue.smsQueue)
export class SendInvoiceSmsJob {
  private readonly logger = new Logger(SendInvoiceSmsJob.name);

  constructor(private readonly smsService: SmsService) {}

  @Process('send-invoice-sms')
  async handleSendInvoiceSms(job: Job<SendInvoiceSmsJobData>): Promise<void> {
    const { invoiceNumber, recipientPhone, message, workspaceId, personId } = job.data;

    try {
      if (!workspaceId) {
        throw new Error('workspaceId is required');
      }

      // Send SMS via Twilio through SmsService
      await this.smsService.sendSms({
        phoneNumber: recipientPhone,
        personId: personId || 'system',
        body: message,
        workspaceId,
      });

      this.logger.log(
        `Invoice SMS sent: ${invoiceNumber} to ${recipientPhone}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invoice SMS for ${invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
