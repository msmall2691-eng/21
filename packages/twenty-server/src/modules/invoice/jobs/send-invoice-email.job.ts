import { Injectable, Logger } from '@nestjs/common';

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
export class SendInvoiceEmailJob {
  private readonly logger = new Logger(SendInvoiceEmailJob.name);

  async handleSendInvoiceEmail(data: SendInvoiceEmailJobData): Promise<void> {
    const { invoiceNumber, amount, recipientEmail } = data;

    try {
      this.logger.log(
        `Sending invoice email: ${invoiceNumber} to ${recipientEmail}`,
      );

      // TODO: Implement actual email sending via SendGrid or Gmail API
      // For now, log that we would send it
      this.logger.log(
        `[TODO] Email invoice ${invoiceNumber} to ${recipientEmail}: Amount ${(amount / 100).toFixed(2)}`,
      );

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
