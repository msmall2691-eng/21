import {
  Controller,
  Post,
  Body,
  Req,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { QuoteApprovalService } from '../services/quote-approval.service';
import { TwilioService } from '../services/twilio.service';
import { StripeService } from '../services/stripe.service';
import { CreatePaymentCheckoutDto } from '../dtos/create-payment-checkout.dto';
import { TwilioWebhookDto } from '../dtos/twilio-webhook.dto';

@Controller('api/quote-approval')
export class QuoteApprovalController {
  private readonly logger = new Logger(QuoteApprovalController.name);

  constructor(
    private readonly quoteApprovalService: QuoteApprovalService,
    private readonly twilioService: TwilioService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Handle Twilio SMS webhooks
   * Processes inbound SMS replies (YES/NO for approval)
   */
  @Post('/webhook/twilio')
  async handleTwilioWebhook(@Body() body: TwilioWebhookDto) {
    try {
      this.logger.debug('Received Twilio webhook', { from: body.From });

      // Parse webhook
      const message = this.twilioService.parseTwilioWebhook(
        body as Record<string, string | string[]>,
      );

      if (!message) {
        this.logger.warn('Invalid Twilio webhook payload');
        return { success: false, error: 'Invalid payload' };
      }

      // Process approval/rejection
      const approval = await this.quoteApprovalService.processSMSApproval(
        message.from,
        message.body,
      );

      if (approval.isApproval) {
        this.logger.log(`SMS approval received from ${message.from}`);
        return { success: true, approved: true };
      }

      if (approval.isRejection) {
        this.logger.log(`SMS rejection received from ${message.from}`);
        return { success: true, rejected: true };
      }

      // Not an approval/rejection response
      return { success: true, processed: false };
    } catch (error) {
      this.logger.error('Error processing Twilio webhook', error);
      throw new HttpException(
        'Error processing webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create Stripe checkout session for quote payment
   */
  @Post('/checkout')
  async createCheckout(@Body() dto: CreatePaymentCheckoutDto) {
    try {
      this.logger.debug(`Creating checkout for quote ${dto.quoteId}`);

      // Normalize phone if provided
      let normalizedPhone = null;
      if (dto.phone) {
        normalizedPhone = this.quoteApprovalService.normalizePhone(dto.phone);
        if (!normalizedPhone) {
          throw new HttpException(
            'Invalid phone format',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Validate amounts
      if (dto.estimateMin <= 0 || dto.estimateMax <= 0) {
        throw new HttpException(
          'Invalid estimate amounts',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Create checkout session
      const result = await this.quoteApprovalService.createCheckoutSession(
        dto.email,
        dto.name || null,
        normalizedPhone,
        dto.quoteId,
        dto.estimateMin,
        dto.estimateMax,
        dto.successUrl,
        dto.cancelUrl,
      );

      if (!result.checkoutUrl) {
        throw new HttpException(
          'Failed to create checkout session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`Checkout created for quote ${dto.quoteId}`);

      return {
        success: true,
        checkoutUrl: result.checkoutUrl,
        customerId: result.customerId,
        quoteId: dto.quoteId,
      };
    } catch (error) {
      this.logger.error('Error creating checkout', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error creating checkout',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle Stripe webhook
   * Processes payment completion, refunds, etc
   */
  @Post('/webhook/stripe')
  async handleStripeWebhook(@Req() request: Request) {
    try {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        throw new HttpException(
          'Missing stripe-signature header',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get raw body for signature verification
      const rawBody = (request as any).rawBody || request.body;

      // Verify webhook signature
      const event = this.stripeService.verifyWebhookSignature(
        rawBody,
        signature,
      );

      if (!event) {
        throw new HttpException(
          'Invalid signature',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Processing Stripe event: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed':
          this.logger.log('Payment completed');
          return { success: true, processed: true };

        case 'charge.refunded':
          this.logger.log('Payment refunded');
          return { success: true, processed: true };

        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
          return { success: true, processed: false };
      }
    } catch (error) {
      this.logger.error('Error processing Stripe webhook', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error processing webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Approve quote via token
   * GET /api/quote-approval/approve/:token
   */
  @Post('/approve/:token')
  async approveQuoteByToken(@Req() request: Request) {
    try {
      const token = request.params.token as string;

      if (!token) {
        throw new HttpException(
          'Token is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Approving quote with token: ${token.substring(0, 8)}...`);

      return {
        success: true,
        message: 'Quote approved successfully',
        nextStep: 'payment',
      };
    } catch (error) {
      this.logger.error('Error approving quote', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error approving quote',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Send approval SMS
   * POST /api/quote-approval/send-sms
   */
  @Post('/send-sms')
  async sendApprovalSMS(
    @Body()
    body: {
      quoteId: string;
      phone: string;
      name: string;
      estimateMin: number;
      estimateMax: number;
      baseUrl: string;
    },
  ) {
    try {
      this.logger.debug(`Sending approval SMS for quote ${body.quoteId}`);

      // Normalize phone
      const normalizedPhone = this.quoteApprovalService.normalizePhone(
        body.phone,
      );

      if (!normalizedPhone) {
        throw new HttpException(
          'Invalid phone number',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Generate approval link
      const { token } = this.quoteApprovalService.generateApprovalToken();
      const approvalLink = this.quoteApprovalService.buildApprovalLink(
        token,
        body.baseUrl,
      );

      // Send SMS
      const messageSid = await this.quoteApprovalService.sendApprovalSMS(
        normalizedPhone,
        body.name,
        body.estimateMin,
        body.estimateMax,
        approvalLink,
      );

      if (!messageSid) {
        throw new HttpException(
          'Failed to send SMS',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`SMS sent for quote ${body.quoteId}: ${messageSid}`);

      return {
        success: true,
        messageSid,
        quoteId: body.quoteId,
        token,
      };
    } catch (error) {
      this.logger.error('Error sending SMS', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error sending SMS',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
