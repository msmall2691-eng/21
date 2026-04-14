import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

export type SendInvoiceEmailJobData = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  recipientEmail: string;
  subject: string;
};

@Injectable()
@Processor(MessageQueue.emailQueue)
export class SendInvoiceEmailJob {
  private readonly logger = new Logger(SendInvoiceEmailJob.name);

  @Process('send-invoice-email')
  async handleSendInvoiceEmail(job: Job<SendInvoiceEmailJobData>): Promise<void> {
    const { invoiceNumber, amount, recipientEmail, subject } = job.data;

    try {
      this.logger.log(
        `Sending invoice email: ${invoiceNumber} to ${recipientEmail}`,
      );

      // TODO: Implement actual email sending via SendGrid or Gmail API
      // For now, log that we would send it
      this.logger.log(
        `[TODO] Email invoice ${invoiceNumber} to ${recipientEmail}: Amount $${(amount / 100).toFixed(2)}`,
      );

      // In production, use:
      // - SendGrid API: sgMail.send({ to: recipientEmail, from: 'billing@mainecleaningco.com', subject, html })
      // - Gmail API: gmail.users.messages.send()
      // - Or configure nodemailer with SMTP

      this.logger.log(
        `Invoice ${invoiceNumber} email notification completed`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invoice email for ${invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
