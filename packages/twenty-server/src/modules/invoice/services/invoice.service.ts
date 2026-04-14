import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type InvoiceWorkspaceEntity } from '../standard-objects/invoice.workspace-entity';
import { type QuoteWorkspaceEntity } from 'src/modules/quote/standard-objects/quote.workspace-entity';

export type CreateInvoiceFromQuoteInput = {
  quoteId: string;
  workspaceId: string;
};

export type RecordPaymentInput = {
  invoiceId: string;
  amountPaid: number;
  paymentMethod: string;
  workspaceId: string;
  notes?: string;
};

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async createInvoiceFromQuote(
    input: CreateInvoiceFromQuoteInput,
  ): Promise<InvoiceWorkspaceEntity> {
    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      // Fetch the quote
      const quoteRepository =
        await this.globalWorkspaceOrmManager.getRepository<QuoteWorkspaceEntity>(
          input.workspaceId,
          'quote',
        );

      const quote = await quoteRepository.findOne({
        where: { id: input.quoteId },
        relations: ['person', 'company'],
      });

      if (!quote) {
        throw new Error(`Quote ${input.quoteId} not found`);
      }

      // Create invoice from quote
      const invoiceRepository =
        await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
          input.workspaceId,
          'invoice',
        );

      // Generate invoice number (could be enhanced with formatting)
      const invoiceNumber = `INV-${new Date().getFullYear()}-${uuid().substring(0, 6).toUpperCase()}`;

      const invoice = await invoiceRepository.create({
        invoiceNumber,
        status: 'DRAFT',
        amount: quote.totalAmount || 0,
        amountPaid: 0,
        currency: quote.currency || 'USD',
        issueDate: new Date().toISOString(),
        dueDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 days from now
        quoteId: input.quoteId,
        customerId: quote.personId,
        companyId: quote.companyId,
        description: `Invoice for quote: ${quote.title || quote.id}`,
        isRecurring: false,
      });

      this.logger.log(
        `Created invoice ${invoiceNumber} from quote ${input.quoteId}`,
      );

      return invoice;
    } catch (error) {
      this.logger.error(
        `Failed to create invoice from quote ${input.quoteId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async recordPayment(input: RecordPaymentInput): Promise<InvoiceWorkspaceEntity> {
    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      const invoiceRepository =
        await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
          input.workspaceId,
          'invoice',
        );

      const invoice = await invoiceRepository.findOne({
        where: { id: input.invoiceId },
      });

      if (!invoice) {
        throw new Error(`Invoice ${input.invoiceId} not found`);
      }

      const newAmountPaid = (invoice.amountPaid || 0) + input.amountPaid;
      const isFullyPaid = newAmountPaid >= (invoice.amount || 0);

      // Update invoice
      const updatedInvoice = await invoiceRepository.update(input.invoiceId, {
        amountPaid: newAmountPaid,
        status: isFullyPaid ? 'PAID' : 'PARTIAL',
        paidDate: isFullyPaid ? new Date().toISOString() : invoice.paidDate,
        paymentMethod: input.paymentMethod as any,
        paymentNotes: input.notes || null,
      });

      this.logger.log(
        `Recorded payment of ${input.amountPaid} on invoice ${input.invoiceId}. Status: ${isFullyPaid ? 'PAID' : 'PARTIAL'}`,
      );

      return updatedInvoice;
    } catch (error) {
      this.logger.error(
        `Failed to record payment on invoice ${input.invoiceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async sendInvoice(invoiceId: string, workspaceId: string): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    try {
      const invoiceRepository =
        await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
          workspaceId,
          'invoice',
        );

      await invoiceRepository.update(invoiceId, {
        status: 'SENT',
        sentDate: new Date().toISOString(),
      });

      this.logger.log(`Sent invoice ${invoiceId}`);
      // TODO: Implement actual email sending
    } catch (error) {
      this.logger.error(
        `Failed to send invoice ${invoiceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async markOverdue(invoiceId: string, workspaceId: string): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    try {
      const invoiceRepository =
        await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
          workspaceId,
          'invoice',
        );

      const invoice = await invoiceRepository.findOne({
        where: { id: invoiceId },
      });

      if (invoice && invoice.status !== 'PAID') {
        await invoiceRepository.update(invoiceId, {
          status: 'OVERDUE',
        });
        this.logger.log(`Marked invoice ${invoiceId} as overdue`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark invoice as overdue: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
