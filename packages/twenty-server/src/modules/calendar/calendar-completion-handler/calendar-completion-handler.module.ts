import { Module } from '@nestjs/common';

import { GoogleCalendarCompletionController } from '../controllers/google-calendar-completion.controller';
import { GoogleCalendarCompletionHandlerService } from '../services/google-calendar-completion-handler.service';
import { InvoiceModule } from 'src/modules/invoice/invoice.module';

@Module({
  imports: [InvoiceModule],
  controllers: [GoogleCalendarCompletionController],
  providers: [GoogleCalendarCompletionHandlerService],
  exports: [GoogleCalendarCompletionHandlerService],
})
export class CalendarCompletionHandlerModule {}
