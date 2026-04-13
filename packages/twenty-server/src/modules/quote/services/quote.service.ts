import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuoteCreatedEvent } from '../events/quote-created.event';
import { QuoteNumberService } from './quote-number.service';
import { PricingService } from './pricing.service';
import { IntakePayload } from '../dtos/intake-payload.dto';
import { QuoteLineItem, ServiceType, FrequencyType } from '../standard-objects/quote.workspace-entity';
import { PricingConfigData } from '../standard-objects/pricing-config.workspace-entity';

export interface CreateQuoteInput {
  personId: string;
  opportunityId: string;
  companyId?: string;
  payload: IntakePayload;
  pricingConfig: PricingConfigData;
  source: string;
  workspaceId: string;
  externalFormId?: string;
}

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private quoteNumberService: QuoteNumberService,
    private pricingService: PricingService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new Quote in DRAFT status from an intake request.
   */
  async createFromIntake(input: CreateQuoteInput) {
    const {
      personId,
      opportunityId,
      companyId,
      payload,
      pricingConfig,
      source,
      workspaceId,
      externalFormId,
    } = input;

    // Generate quote number
    const quoteNumber = await this.quoteNumberService.generateQuoteNumber(
      workspaceId,
    );

    // Build line items from pricing config
    const lineItems = this.pricingService.buildDefaultLineItems(
      payload,
      pricingConfig,
    );

    // Calculate totals
    const totals = this.pricingService.computeTotals(lineItems);

    // Build customer notes (include estimateShown if provided and different)
    let customerNotes = '';
    if (payload.notes) {
      customerNotes = payload.notes;
    }
    if (payload.estimateShown && Math.abs(payload.estimateShown - totals.total) > 0.01) {
      customerNotes += (customerNotes ? '\n\n' : '') +
        `Your website estimate was $${payload.estimateShown.toFixed(2)}. ` +
        `Below is your formal quote.`;
    }

    // Generate approval token (used by Spec 02)
    const approvalToken = this.generateApprovalToken();

    // Calculate expiration
    const expiresAt = new Date();
    const expirationDays = parseInt(process.env.QUOTE_EXPIRATION_DAYS || '30', 10);
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Store raw payload for audit
    const intakeRawPayload = {
      ...payload,
      processedAt: new Date().toISOString(),
    };

    // Prepare quote data (we'll return this to be inserted by the caller)
    const quoteData = {
      quoteNumber,
      status: 'DRAFT' as const,
      personId,
      opportunityId,
      companyId: companyId || null,
      serviceAddress: payload.address || null,
      serviceType: payload.serviceType as ServiceType,
      frequency: (payload.frequency as FrequencyType) || 'ONE_TIME',
      squareFeet: payload.squareFeet || null,
      bedrooms: payload.bedrooms || null,
      bathrooms: payload.bathrooms || null,
      estimatedHours: null,
      lineItems,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      currency: 'USD',
      customerNotes: customerNotes || null,
      internalNotes: null,
      intakeRawPayload,
      intakeSource: source,
      externalFormId: externalFormId || null,
      expiresAt,
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
      approvalToken,
    };

    // Emit event for async actions (email notification to Megan, etc.)
    this.eventEmitter.emit(
      'quote.created',
      new QuoteCreatedEvent(
        '', // quoteId will be set by caller after insert
        personId,
        opportunityId,
        quoteNumber,
        totals.total,
        workspaceId,
        source,
      ),
    );

    return quoteData;
  }

  /**
   * Recompute quote totals after line items are edited.
   */
  recomputeQuoteTotals(lineItems: QuoteLineItem[]) {
    return this.pricingService.computeTotals(lineItems);
  }

  /**
   * Generate a secure approval token (used by Spec 02).
   */
  private generateApprovalToken(): string {
    return require('crypto').randomUUID();
  }
}
