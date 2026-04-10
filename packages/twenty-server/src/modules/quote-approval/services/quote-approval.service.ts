import { Injectable, Logger } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { StripeService } from './stripe.service';
import crypto from 'crypto';

@Injectable()
export class QuoteApprovalService {
  private readonly logger = new Logger(QuoteApprovalService.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Generate a unique approval token for quote approval link
   */
  generateApprovalToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Build approval link for quote
   */
  buildApprovalLink(token: string, baseUrl: string): string {
    return `${baseUrl}/api/quote-approval/${token}`;
  }

  /**
   * Build payment link for quote
   */
  buildPaymentLink(quoteId: string, baseUrl: string): string {
    return `${baseUrl}/api/quote-payment/${quoteId}`;
  }

  /**
   * Validate phone number in E.164 format
   */
  validatePhoneFormat(phone: string): boolean {
    return /^\+\d{10,15}$/.test(phone);
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
    return this.twilioService.sendPaymentSMS(phone, name, formattedAmount, paymentLink);
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
}
