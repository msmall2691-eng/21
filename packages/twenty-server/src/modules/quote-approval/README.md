# Quote Approval Module

Integrates Twilio SMS and Stripe payment processing into the Twenty CRM quote request workflow.

## Features

- **SMS Approval**: Send quote approval requests via SMS and process SMS responses
- **Stripe Payments**: Create secure checkout sessions for quote payments
- **Webhook Integration**: Handle Stripe payment webhooks and SMS replies
- **Customer Management**: Automatic Stripe customer creation and lookup

## Services

### TwilioService
- `sendSMS(to, message)`: Send SMS to customer
- `sendApprovalQuoteSMS()`: Send quote approval SMS
- `parseTwilioWebhook()`: Parse inbound SMS
- `isApprovalResponse()` / `isRejectionResponse()`: Check SMS response type

### StripeService
- `createOrGetCustomer()`: Create or lookup Stripe customer
- `createCheckoutSession()`: Create Stripe checkout for payment
- `verifyWebhookSignature()`: Validate Stripe webhook signatures
- `formatAmountForDisplay()`: Format cents as currency

### QuoteApprovalService
Coordinates Twilio and Stripe services for the quote approval workflow:
- `sendApprovalSMS()`: Send SMS with approval link to customer
- `sendPaymentSMS()`: Send payment link via SMS
- `processSMSApproval()`: Handle SMS approval/rejection responses
- `createCheckoutSession()`: Create Stripe checkout with customer

## Environment Variables

```
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Usage

The module is automatically imported in `modules.module.ts` and available for injection:

```typescript
import { QuoteApprovalService } from 'src/modules/quote-approval';

@Injectable()
export class MyService {
  constructor(private quoteApprovalService: QuoteApprovalService) {}

  async approveQuote(quoteId: string) {
    // Use quote approval service
  }
}
```

## Integration Points

- **Quote Request**: Extended to support approval workflow
- **REST API**: Webhooks for Twilio SMS and Stripe payments
- **GraphQL**: Query and mutation resolvers (can be added)

## Security

- ✅ Phone number validation (E.164 format)
- ✅ Stripe webhook signature verification
- ✅ Approval tokens with expiration
- ✅ Minimum amount enforcement ($0.50)
- ✅ Idempotency for webhook processing
