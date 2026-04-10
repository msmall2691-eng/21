import { Module } from '@nestjs/common';
import { TwilioService } from './services/twilio.service';
import { StripeService } from './services/stripe.service';
import { QuoteApprovalService } from './services/quote-approval.service';

@Module({
  imports: [],
  providers: [TwilioService, StripeService, QuoteApprovalService],
  exports: [TwilioService, StripeService, QuoteApprovalService],
})
export class QuoteApprovalModule {}
