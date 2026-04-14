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
    // Check if an invoice already exists for this JobVisit
    const invoiceRepository =
      await this.globalWorkspaceOrmManager.getRepository<InvoiceWorkspaceEntity>(
        workspaceId,
        'invoice',
      );

    const existingInvoice = await invoiceRepository.findOne({
      where: {
        googleCalendarEventId: jobVisit.id,
      },
    });

    if (existingInvoice) {
      this.logger.debug(
        `Invoice already exists for JobVisit ${jobVisit.id}. Skipping.`,
      );
      return;
    }

    // Get the calendar event to extract Google Calendar ID
    let googleCalendarEventId: string | undefined;
    if (jobVisit.calendarEventId) {
      const calendarEventRepository =
        await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          'calendarEvent',
        );

      const calendarEvent = await calendarEventRepository.findOne({
        where: { id: jobVisit.calendarEventId },
      });

      if (calendarEvent && (calendarEvent as any).externalId) {
        googleCalendarEventId = (calendarEvent as any).externalId;
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
