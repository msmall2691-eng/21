import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type InvoiceWorkspaceEntity } from '../standard-objects/invoice.workspace-entity';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

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
    @InjectMessageQueue(MessageQueue.generalQueue)
    private readonly messageQueueService: MessageQueueService,
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
    try {
      // Queue email job for async processing
      await this.messageQueueService.add('send-invoice-email', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        recipientEmail: email,
        subject: `Invoice ${invoice.invoiceNumber} from Maine Cleaning Co`,
      });

      this.logger.log(
        `Queued email notification for invoice ${invoice.invoiceNumber} to ${email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue email notification: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async sendSmsInvoice(
    invoice: InvoiceWorkspaceEntity,
    phone: string,
  ): Promise<void> {
    try {
      // Queue SMS job for async processing via Twilio
      await this.messageQueueService.add('send-invoice-sms', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        recipientPhone: phone,
        message: `Invoice ${invoice.invoiceNumber} from Maine Cleaning Co: $${(invoice.amount / 100).toFixed(2)} due ${new Date(invoice.dueDate).toLocaleDateString()}`,
      });

      this.logger.log(
        `Queued SMS notification for invoice ${invoice.invoiceNumber} to ${phone}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue SMS notification: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
