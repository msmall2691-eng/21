import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { EmailDriverFactory } from 'src/engine/core-modules/email/email-driver.factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

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

  constructor(
    private readonly emailDriverFactory: EmailDriverFactory,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  @Process('send-invoice-email')
  async handleSendInvoiceEmail(job: Job<SendInvoiceEmailJobData>): Promise<void> {
    const { invoiceNumber, amount, recipientEmail, subject, dueDate } = job.data;

    try {
      const emailDriver = this.emailDriverFactory.getDriver();
      const fromEmail = this.twentyConfigService.get('EMAIL_FROM_ADDRESS') || 'noreply@mainecleaningco.com';

      const htmlBody = this.buildEmailHtml(invoiceNumber, amount, dueDate);

      await emailDriver.send({
        to: recipientEmail,
        from: fromEmail,
        subject,
        html: htmlBody,
        text: `Invoice ${invoiceNumber}\n\nAmount Due: $${(amount / 100).toFixed(2)}\nDue Date: ${dueDate}`,
      });

      this.logger.log(
        `Invoice email sent: ${invoiceNumber} to ${recipientEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invoice email for ${invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private buildEmailHtml(invoiceNumber: string, amount: number, dueDate: string): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Invoice ${invoiceNumber}</h2>
          <p>Thank you for your business!</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Amount Due:</strong> $${(amount / 100).toFixed(2)}</p>
            <p style="margin: 10px 0;"><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <p>Please make payment as soon as possible. If you have any questions, please contact us.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">Maine Cleaning Co.</p>
        </body>
      </html>
    `;
  }
}
