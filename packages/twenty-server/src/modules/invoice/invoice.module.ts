import { Module } from '@nestjs/common';

import { InvoiceService } from './services/invoice.service';
import { InvoiceNotificationService } from './services/invoice-notification.service';
import { SendInvoiceEmailJob } from './jobs/send-invoice-email.job';
import { SendInvoiceSmsJob } from './jobs/send-invoice-sms.job';

@Module({
  providers: [
    InvoiceService,
    InvoiceNotificationService,
    SendInvoiceEmailJob,
    SendInvoiceSmsJob,
  ],
  exports: [InvoiceService, InvoiceNotificationService],
})
export class InvoiceModule {}
