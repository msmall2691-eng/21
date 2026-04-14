import { Injectable, Logger } from '@nestjs/common';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';
import { type InvoiceWorkspaceEntity } from 'src/modules/invoice/standard-objects/invoice.workspace-entity';
import { InvoiceService } from 'src/modules/invoice/services/invoice.service';
import { InvoiceNotificationService } from 'src/modules/invoice/services/invoice-notification.service';

export type GoogleCalendarEventCompletionCheckInput = {
  workspaceId: string;
  googleCalendarEventId?: string;
};

@Injectable()
export class GoogleCalendarCompletionHandlerService {
  private readonly logger = new Logger(
    GoogleCalendarCompletionHandlerService.name,
  );

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly invoiceService: InvoiceService,
    private readonly invoiceNotificationService: InvoiceNotificationService,
  ) {}

  async checkAndGenerateInvoicesForCompletedJobs(
    input: GoogleCalendarEventCompletionCheckInput,
  ): Promise<{ generatedCount: number; errors: string[] }> {
    const authContext = buildSystemAuthContext(input.workspaceId);
    const errors: string[] = [];
    let generatedCount = 0;

    try {
      // Fetch all JobVisits that are completed but haven't been invoiced yet
      const jobVisitRepository =
        await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
          input.workspaceId,
          'jobVisit',
        );

      // Build query for completed JobVisits
      const query = jobVisitRepository
        .createQueryBuilder('job_visit')
        .where('job_visit.completedDate IS NOT NULL');

      // If specific Google Calendar event ID is provided, filter by it
      if (input.googleCalendarEventId) {
        query.andWhere(
          'job_visit.calendarEventId = :calendarEventId',
          { calendarEventId: input.googleCalendarEventId },
        );
      }

      const completedJobVisits = await query.getMany();

      this.logger.log(
        `Found ${completedJobVisits.length} completed JobVisits to process`,
      );

      // Process each completed JobVisit
      for (const jobVisit of completedJobVisits) {
        try {
          await this.processCompletedJobVisit(jobVisit, input.workspaceId);
          generatedCount++;
        } catch (error) {
          const errorMsg = `Failed to process JobVisit ${jobVisit.id}: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      return { generatedCount, errors };
    } catch (error) {
      const errorMsg = `Failed to check for completed jobs: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);
      return { generatedCount, errors };
    }
  }

  private async processCompletedJobVisit(
    jobVisit: JobVisitWorkspaceEntity,
    workspaceId: string,
  ): Promise<void> {
    // Get the Google Calendar event ID from the calendar event association
    let googleCalendarEventId: string | undefined;
    if (jobVisit.calendarEventId) {
      const associationRepository =
        await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          'calendarChannelEventAssociation',
        );

      const association = await associationRepository.findOne({
        where: { calendarEventId: jobVisit.calendarEventId },
      });

      if (association && (association as any).eventExternalId) {
        googleCalendarEventId = (association as any).eventExternalId;
      }
    }

    // Check if an invoice already exists for this Google Calendar event
    const invoiceRepository =
      await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
        workspaceId,
        'invoice',
      );

    if (googleCalendarEventId) {
      const existingInvoice = await invoiceRepository.findOne({
        where: {
          googleCalendarEventId,
        },
      });

      if (existingInvoice) {
        this.logger.debug(
          `Invoice already exists for Google Calendar event ${googleCalendarEventId}. Skipping.`,
        );
        return;
      }
    }

    // Generate invoice from the completed JobVisit
    const invoice = await this.invoiceService.createInvoiceFromJobVisit({
      jobVisitId: jobVisit.id,
      workspaceId,
      googleCalendarEventId,
    });

    this.logger.log(
      `Generated invoice ${invoice.invoiceNumber} for completed JobVisit ${jobVisit.id}`,
    );

    // Queue email notification (for now, just send it immediately)
    try {
      await this.invoiceNotificationService.sendInvoiceNotification({
        invoiceId: invoice.id,
        workspaceId,
        method: 'email',
      });
    } catch (notificationError) {
      this.logger.warn(
        `Failed to send invoice notification for ${invoice.invoiceNumber}: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
      );
      // Don't throw - invoice was created successfully, just notification failed
    }
  }
}
