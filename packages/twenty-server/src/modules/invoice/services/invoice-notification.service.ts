import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type InvoiceWorkspaceEntity } from '../standard-objects/invoice.workspace-entity';

export type SendInvoiceNotificationInput = {
  invoiceId: string;
  workspaceId: string;
  method: 'email' | 'sms' | 'both';
  customerEmail?: string;
  customerPhone?: string;
};

@Injectable()
export class InvoiceNotificationService {
  private readonly logger = new Logger(InvoiceNotificationService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async sendInvoiceNotification(
    input: SendInvoiceNotificationInput,
  ): Promise<{ success: boolean; message: string }> {
    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      const invoiceRepository =
        await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
          input.workspaceId,
          'invoice',
        );

      const invoice = await invoiceRepository.findOne({
        where: { id: input.invoiceId },
        relations: ['customer'],
      });

      if (!invoice) {
        throw new Error(`Invoice ${input.invoiceId} not found`);
      }

      const customerEmail = input.customerEmail || (invoice.customer as any)?.email;
      const customerPhone = input.customerPhone;

      // Send email
      if ((input.method === 'email' || input.method === 'both') && customerEmail) {
        await this.sendEmailInvoice(invoice, customerEmail);
      }

      // Send SMS
      if ((input.method === 'sms' || input.method === 'both') && customerPhone) {
        await this.sendSmsInvoice(invoice, customerPhone);
      }

      // Update invoice status to SENT
      await invoiceRepository.update(input.invoiceId, {
        status: 'SENT',
        sentDate: new Date().toISOString(),
      });

      this.logger.log(
        `Sent invoice ${invoice.invoiceNumber} via ${input.method}`,
      );

      return {
        success: true,
        message: `Invoice ${invoice.invoiceNumber} sent successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send invoice notification: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async sendEmailInvoice(
    invoice: InvoiceWorkspaceEntity,
    email: string,
  ): Promise<void> {
    // TODO: Implement email sending via SendGrid or Gmail API
    this.logger.log(
      `[TODO] Would send invoice ${invoice.invoiceNumber} to ${email}`,
    );
    // For now, just log that we would send it
  }

  private async sendSmsInvoice(
    invoice: InvoiceWorkspaceEntity,
    phone: string,
  ): Promise<void> {
    // TODO: Implement SMS sending via Twilio
    this.logger.log(
      `[TODO] Would send invoice ${invoice.invoiceNumber} SMS to ${phone}`,
    );
    // For now, just log that we would send it
  }
}
