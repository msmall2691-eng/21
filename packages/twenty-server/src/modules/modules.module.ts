import { Module } from '@nestjs/common';

import { CalendarModule } from 'src/modules/calendar/calendar.module';
import { CalendarJobsModule } from 'src/modules/calendar/calendar-jobs.module';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';
import { FavoriteFolderModule } from 'src/modules/favorite-folder/favorite-folder.module';
import { FavoriteModule } from 'src/modules/favorite/favorite.module';
import { InvoiceModule } from 'src/modules/invoice/invoice.module';
import { LeadCaptureFromEmailModule } from 'src/modules/lead-capture-from-email/lead-capture-from-email.module';
import { MessagingModule } from 'src/modules/messaging/messaging.module';
import { QuoteApprovalModule } from 'src/modules/quote-approval/quote-approval.module';
import { QuoteModule } from 'src/modules/quote/quote.module';
import { WorkflowModule } from 'src/modules/workflow/workflow.module';
import { WorkspaceMemberModule } from 'src/modules/workspace-member/workspace-member.module';

@Module({
  imports: [
    MessagingModule,
    CalendarModule,
    CalendarJobsModule,
    ConnectedAccountModule,
    InvoiceModule,
    LeadCaptureFromEmailModule,
    QuoteApprovalModule,
    QuoteModule,
    WorkflowModule,
    FavoriteFolderModule,
    FavoriteModule,
    WorkspaceMemberModule,
  ],
  providers: [],
  exports: [],
})
export class ModulesModule {}
