import { Module } from '@nestjs/common';
import { IntakeWebhookController } from './controllers/intake-webhook.controller';
import { IntakeService } from './services/intake.service';
import { QuoteService } from './services/quote.service';
import { PricingService } from './services/pricing.service';
import { QuoteNumberService } from './services/quote-number.service';

@Module({
  imports: [],
  controllers: [IntakeWebhookController],
  providers: [
    IntakeService,
    QuoteService,
    PricingService,
    QuoteNumberService,
  ],
  exports: [
    IntakeService,
    QuoteService,
    PricingService,
    QuoteNumberService,
  ],
})
export class QuoteModule {}
