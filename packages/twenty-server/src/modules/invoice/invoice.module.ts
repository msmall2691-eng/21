import { Module } from '@nestjs/common';

import { SmsManagerModule } from 'src/modules/messaging/sms-manager/sms-manager.module';

import { InvoiceService } from './services/invoice.service';
import { InvoiceNotificationService } from './services/invoice-notification.service';
import { SendInvoiceEmailJob } from './jobs/send-invoice-email.job';
import { SendInvoiceSmsJob } from './jobs/send-invoice-sms.job';

@Module({
  imports: [SmsManagerModule],
  providers: [
    InvoiceService,
    InvoiceNotificationService,
    SendInvoiceEmailJob,
    SendInvoiceSmsJob,
  ],
  exports: [InvoiceService, InvoiceNotificationService],
})
export class InvoiceModule {}
