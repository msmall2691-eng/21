import { Injectable, Logger } from '@nestjs/common';

export type SendInvoiceSmsJobData = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  recipientPhone: string;
  message: string;
};

@Injectable()
export class SendInvoiceSmsJob {
  private readonly logger = new Logger(SendInvoiceSmsJob.name);

  async handleSendInvoiceSms(data: SendInvoiceSmsJobData): Promise<void> {
    const { invoiceNumber, recipientPhone, message } = data;

    try {
      this.logger.log(
        `Sending invoice SMS: ${invoiceNumber} to ${recipientPhone}`,
      );

      // TODO: Implement actual SMS sending via Twilio
      // For now, log that we would send it
      this.logger.log(
        `[TODO] SMS invoice ${invoiceNumber} to ${recipientPhone}: "${message}"`,
      );

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
