import { Module } from '@nestjs/common';

import { InvoiceService } from './services/invoice.service';
import { SendInvoiceEmailJob } from './jobs/send-invoice-email.job';
import { SendInvoiceSmsJob } from './jobs/send-invoice-sms.job';

// InvoiceNotificationService removed - uses MessageQueue.generalQueue which
// does not exist in Twenty v1.21 (causes MESSAGE_QUEUE_undefined crash)
// Re-add once the queue reference is fixed to use a valid MessageQueue enum value

@Module({
  providers: [
    InvoiceService,
    SendInvoiceEmailJob,
    SendInvoiceSmsJob,
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}
