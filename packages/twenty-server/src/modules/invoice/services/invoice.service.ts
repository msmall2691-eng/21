import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type InvoiceWorkspaceEntity } from '../standard-objects/invoice.workspace-entity';
import { type QuoteWorkspaceEntity } from 'src/modules/quote/standard-objects/quote.workspace-entity';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';

export type CreateInvoiceFromQuoteInput = {
  quoteId: string;
  workspaceId: string;
};

export type CreateInvoiceFromJobVisitInput = {
  jobVisitId: string;
  workspaceId: string;
  googleCalendarEventId?: string;
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

  async createInvoiceFromJobVisit(
    input: CreateInvoiceFromJobVisitInput,
  ): Promise<InvoiceWorkspaceEntity> {
    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      // Fetch the JobVisit
      const jobVisitRepository =
        await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
          input.workspaceId,
          'jobVisit',
        );

      const jobVisit = await jobVisitRepository.findOne({
        where: { id: input.jobVisitId },
        relations: ['property', 'serviceAgreement'],
      });

      if (!jobVisit) {
        throw new Error(`JobVisit ${input.jobVisitId} not found`);
      }

      if (!jobVisit.property) {
        throw new Error(
          `JobVisit ${input.jobVisitId} has no associated property`,
        );
      }

      // Get customer info from property
      const propertyRepository =
        await this.globalWorkspaceOrmManager.getRepository(
          input.workspaceId,
          'property',
        );

      const property = await propertyRepository.findOne({
        where: { id: jobVisit.propertyId },
        relations: ['person', 'company'],
      });

      if (!property) {
        throw new Error(`Property ${jobVisit.propertyId} not found`);
      }

      // Determine the amount from ServiceAgreement or use default
      let amount = 15000; // Default: $150.00 in cents
      if (jobVisit.serviceAgreement) {
        // Use the price from service agreement if available
        const price = jobVisit.serviceAgreement.price as any;
        if (price && price.amountMicros) {
          amount = Math.round(price.amountMicros / 10000); // Convert micros to cents
        }
      }

      // Create invoice from JobVisit
      const invoiceRepository =
        await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
          input.workspaceId,
          'invoice',
        );

      const invoiceNumber = `INV-${new Date().getFullYear()}-${uuid().substring(0, 6).toUpperCase()}`;

      const invoice = await invoiceRepository.create({
        invoiceNumber,
        status: 'DRAFT',
        amount,
        amountPaid: 0,
        currency: 'USD',
        issueDate: new Date().toISOString(),
        dueDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 days from now
        customerId: property.personId,
        companyId: property.companyId,
        serviceAgreementId: jobVisit.serviceAgreementId,
        description: `Invoice for service: ${jobVisit.name || 'Job Visit'}`,
        googleCalendarEventId: input.googleCalendarEventId || null,
        isRecurring: false,
      });

      this.logger.log(
        `Created invoice ${invoiceNumber} from JobVisit ${input.jobVisitId}`,
      );

      return invoice;
    } catch (error) {
      this.logger.error(
        `Failed to create invoice from JobVisit ${input.jobVisitId}: ${error instanceof Error ? error.message : String(error)}`,
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
