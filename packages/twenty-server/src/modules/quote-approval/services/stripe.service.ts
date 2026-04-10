import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  private readonly secretKey = process.env.STRIPE_SECRET_KEY;
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  constructor() {
    if (this.secretKey) {
      this.client = new Stripe(this.secretKey, {
        apiVersion: '2026-03-25.dahlia',
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey && this.webhookSecret);
  }

  async createOrGetCustomer(
    email: string,
    name?: string | null,
    phone?: string | null,
  ): Promise<string | null> {
    if (!this.client) {
      this.logger.warn('Stripe not configured');
      return null;
    }

    try {
      const customers = await this.client.customers.list({
        email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        return customers.data[0].id;
      }

      const customer = await this.client.customers.create({
        email,
        name: name || undefined,
        phone: phone || undefined,
        metadata: {
          createdAt: new Date().toISOString(),
        },
      });

      this.logger.log(`Created customer: ${customer.id}`);
      return customer.id;
    } catch (error) {
      this.logger.error(`Failed to create/get customer: ${email}`, error);
      return null;
    }
  }

  async createCheckoutSession(
    customerId: string,
    quoteId: string,
    amount: number,
    description: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string | null> {
    if (!this.client) {
      this.logger.warn('Stripe not configured');
      return null;
    }

    // Enforce minimum amount ($0.50 = 50 cents)
    if (amount < 50) {
      this.logger.warn(`Amount too low: ${amount} cents`);
      return null;
    }

    try {
      const session = await this.client.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Quote Services',
                description,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: quoteId,
        metadata: {
          quoteId,
          description,
        },
      });

      this.logger.log(`Created checkout session: ${session.id}`);
      return session.url;
    } catch (error) {
      this.logger.error('Failed to create checkout session', error);
      return null;
    }
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    if (!this.client) {
      this.logger.warn('Stripe not configured');
      return null;
    }

    try {
      return await this.client.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      this.logger.error(`Failed to retrieve session: ${sessionId}`, error);
      return null;
    }
  }

  verifyWebhookSignature(
    body: string | Buffer,
    signature: string,
  ): Stripe.Event | null {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured');
      return null;
    }

    try {
      const event = this.client.webhooks.constructEvent(
        body,
        signature,
        this.webhookSecret,
      );
      return event;
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      return null;
    }
  }

  formatAmountForDisplay(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
