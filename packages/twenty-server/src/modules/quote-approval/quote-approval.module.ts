import { Module } from '@nestjs/common';
import { TwilioService } from './services/twilio.service';
import { StripeService } from './services/stripe.service';
import { PhoneService } from './services/phone.service';
import { ApprovalTokenService } from './services/approval-token.service';
import { InvoiceService } from './services/invoice.service';
import { QuoteApprovalService } from './services/quote-approval.service';
import { QuoteApprovalController } from './controllers/quote-approval.controller';

@Module({
  imports: [],
  controllers: [QuoteApprovalController],
  providers: [
    TwilioService,
    StripeService,
    PhoneService,
    ApprovalTokenService,
    InvoiceService,
    QuoteApprovalService,
  ],
  exports: [
    TwilioService,
    StripeService,
    PhoneService,
    ApprovalTokenService,
    InvoiceService,
    QuoteApprovalService,
  ],
})
export class QuoteApprovalModule {}
