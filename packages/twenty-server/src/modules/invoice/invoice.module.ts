import { Module } from '@nestjs/common';

import { InvoiceService } from './services/invoice.service';

@Module({
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
