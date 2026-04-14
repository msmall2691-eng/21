import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

export type SendInvoiceSmsJobData = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  recipientPhone: string;
  message: string;
};

@Injectable()
@Processor(MessageQueue.emailQueue)
export class SendInvoiceSmsJob {
  private readonly logger = new Logger(SendInvoiceSmsJob.name);

  @Process('send-invoice-sms')
  async handleSendInvoiceSms(job: Job<SendInvoiceSmsJobData>): Promise<void> {
    const { invoiceNumber, recipientPhone, message } = job.data;

    try {
      this.logger.log(
        `Sending invoice SMS: ${invoiceNumber} to ${recipientPhone}`,
      );

      // TODO: Implement actual SMS sending via Twilio
      // For now, log that we would send it
      this.logger.log(
        `[TODO] SMS invoice ${invoiceNumber} to ${recipientPhone}: "${message}"`,
      );

      // In production, use:
      // const twilio = require('twilio')(accountSid, authToken);
      // await twilio.messages.create({
      //   body: message,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: recipientPhone
      // });

      this.logger.log(
        `Invoice ${invoiceNumber} SMS notification completed`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invoice SMS for ${invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
