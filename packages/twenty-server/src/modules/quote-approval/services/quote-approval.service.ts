import { Injectable, Logger } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { StripeService } from './stripe.service';
import { PhoneService } from './phone.service';
import { ApprovalTokenService } from './approval-token.service';
import { InvoiceService, InvoiceData } from './invoice.service';

@Injectable()
export class QuoteApprovalService {
  private readonly logger = new Logger(QuoteApprovalService.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly stripeService: StripeService,
    private readonly phoneService: PhoneService,
    private readonly approvalTokenService: ApprovalTokenService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Generate a unique approval token for quote approval link
   */
  generateApprovalToken(): { token: string; expiresAt: Date } {
    return this.approvalTokenService.generateToken();
  }

  /**
   * Build approval link for quote
   */
  buildApprovalLink(token: string, baseUrl: string): string {
    return this.approvalTokenService.buildApprovalLink(token, baseUrl);
  }

  /**
   * Build payment link for quote
   */
  buildPaymentLink(quoteId: string, baseUrl: string): string {
    return this.approvalTokenService.buildPaymentLink(quoteId, baseUrl);
  }

  /**
   * Normalize phone to E.164 format
   */
  normalizePhone(phone: string | null | undefined): string | null {
    return this.phoneService.normalizeToE164(phone);
  }

  /**
   * Validate phone number in E.164 format
   */
  validatePhoneFormat(phone: string): boolean {
    return this.phoneService.isValidFormat(phone);
  }

  /**
   * Send approval SMS to customer
   */
  async sendApprovalSMS(
    phone: string,
    name: string,
    estimateMin: number,
    estimateMax: number,
    approvalLink: string,
  ): Promise<string | null> {
    if (!this.validatePhoneFormat(phone)) {
      this.logger.warn(`Invalid phone format: ${phone}`);
      return null;
    }

    const estimateRange = `$${estimateMin}-$${estimateMax}`;
    return this.twilioService.sendApprovalQuoteSMS(
      phone,
      name,
      estimateRange,
      approvalLink,
    );
  }

  /**
   * Send payment SMS to customer
   */
  async sendPaymentSMS(
    phone: string,
    name: string,
    amount: number,
    paymentLink: string,
  ): Promise<string | null> {
    if (!this.validatePhoneFormat(phone)) {
      this.logger.warn(`Invalid phone format: ${phone}`);
      return null;
    }

    const formattedAmount = this.stripeService.formatAmountForDisplay(amount);
    return this.twilioService.sendPaymentSMS(
      phone,
      name,
      formattedAmount,
      paymentLink,
    );
  }

  /**
   * Process incoming SMS approval
   */
  async processSMSApproval(
    from: string,
    messageBody: string,
  ): Promise<{
    isApproval: boolean;
    isRejection: boolean;
  }> {
    const isApproval = this.twilioService.isApprovalResponse(messageBody);
    const isRejection = this.twilioService.isRejectionResponse(messageBody);

    return {
      isApproval,
      isRejection,
    };
  }

  /**
   * Create Stripe checkout for quote
   */
  async createCheckoutSession(
    email: string,
    name: string | null,
    phone: string | null,
    quoteId: string,
    estimateMin: number,
    estimateMax: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{
    checkoutUrl: string | null;
    customerId: string | null;
    sessionId: string | null;
  }> {
    // Create or get Stripe customer
    const customerId = await this.stripeService.createOrGetCustomer(
      email,
      name,
      phone,
    );

    if (!customerId) {
      this.logger.warn(`Failed to create customer for ${email}`);
      return {
        checkoutUrl: null,
        customerId: null,
        sessionId: null,
      };
    }

    // Calculate average price in cents
    const avgPriceCents = Math.round(((estimateMin + estimateMax) / 2) * 100);

    // Extract quote ID from metadata if needed
    const description = `Quote estimation: $${estimateMin}-$${estimateMax}`;

    // Create checkout session
    const checkoutUrl = await this.stripeService.createCheckoutSession(
      customerId,
      quoteId,
      avgPriceCents,
      description,
      successUrl,
      cancelUrl,
    );

    return {
      checkoutUrl,
      customerId,
      sessionId: null, // Would be set after actual session creation
    };
  }

  /**
   * Generate invoice for quote
   */
  generateInvoiceData(
    quoteId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    customerAddress: string,
    serviceType: string,
    frequency: string,
    estimateMin: number,
    estimateMax: number,
    sqft?: number,
    bathrooms?: number,
    notes?: string,
  ): InvoiceData {
    return this.invoiceService.generateInvoiceData(
      quoteId,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      serviceType,
      frequency,
      estimateMin,
      estimateMax,
      sqft,
      bathrooms,
      notes,
    );
  }

  /**
   * Format invoice as text
   */
  formatInvoiceAsText(invoice: InvoiceData): string {
    return this.invoiceService.formatInvoiceAsText(invoice);
  }

  /**
   * Generate invoice SMS summary
   */
  generateInvoiceSMSSummary(invoice: InvoiceData): string {
    return this.invoiceService.generateInvoiceSMSSummary(invoice);
  }

  /**
   * Generate invoice email summary
   */
  generateInvoiceEmailSummary(invoice: InvoiceData, invoiceUrl?: string): string {
    return this.invoiceService.generateInvoiceEmailSummary(invoice, invoiceUrl);
  }
}
