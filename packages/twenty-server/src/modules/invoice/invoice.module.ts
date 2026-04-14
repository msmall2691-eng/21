import { Module } from '@nestjs/common';

import { InvoiceService } from './services/invoice.service';
import { InvoiceNotificationService } from './services/invoice-notification.service';

@Module({
  providers: [InvoiceService, InvoiceNotificationService],
  exports: [InvoiceService, InvoiceNotificationService],
})
export class InvoiceModule {}
