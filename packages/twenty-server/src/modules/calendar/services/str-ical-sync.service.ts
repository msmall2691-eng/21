import { Injectable, Logger } from '@nestjs/common';
import * as ical from 'node-ical';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';

export type StrIcalSyncInput = {
  workspaceId: string;
  propertyId?: string; // If provided, sync only this property
};

export type StrIcalSyncResult = {
  processed: number;
  created: number;
  errors: string[];
};

/**
 * Service to sync iCal feeds from STR (Short-Term Rental) properties.
 *
 * Fetches iCal feeds (Airbnb, VRBO, etc.) and creates JobVisits on checkout dates.
 * Integrates with Google Calendar via existing JobVisitCalendarSyncService.
 *
 * How it works:
 * 1. Fetch iCal feed URL from Property.icalSyncUrl
 * 2. Parse VEVENT entries for checkout/turnover dates
 * 3. Create JobVisit records for each checkout
 * 4. JobVisitCalendarSyncService automatically syncs to Google Calendar
 * 5. Client sees all cleanings in Google Calendar and can share with customers
 */
@Injectable()
export class StrIcalSyncService {
  private readonly logger = new Logger(StrIcalSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async syncStrProperties(input: StrIcalSyncInput): Promise<StrIcalSyncResult> {
    const authContext = buildSystemAuthContext(input.workspaceId);
    const result: StrIcalSyncResult = {
      processed: 0,
      created: 0,
      errors: [],
    };

    try {
      const propertyRepository =
        await this.globalWorkspaceOrmManager.getRepository<PropertyWorkspaceEntity>(
          input.workspaceId,
          'property',
        );

      // Build query for properties with iCal feed URLs
      let query = propertyRepository.createQueryBuilder('property');

      if (input.propertyId) {
        query = query.where('property.id = :propertyId', {
          propertyId: input.propertyId,
        });
      } else {
        // Only sync STR properties that have an iCal feed URL
        query = query.where('property.icalSyncUrl IS NOT NULL');
      }

      const properties = await query.getMany();

      this.logger.log(
        `Found ${properties.length} STR properties with iCal feeds to sync`,
      );

      for (const property of properties) {
        result.processed++;

        try {
          const jobVisitsCreated = await this.syncPropertyIcalFeed(
            property,
            input.workspaceId,
          );
          result.created += jobVisitsCreated;
        } catch (error) {
          const errorMsg = `Failed to sync iCal for property ${property.id}: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      this.logger.log(
        `STR iCal sync complete: processed=${result.processed}, created=${result.created}, errors=${result.errors.length}`,
      );

      return result;
    } catch (error) {
      const errorMsg = `Failed to sync STR properties: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  private async syncPropertyIcalFeed(
    property: PropertyWorkspaceEntity,
    workspaceId: string,
  ): Promise<number> {
    if (!property.icalSyncUrl) {
      this.logger.warn(
        `Property ${property.id} has no iCal URL - skipping`,
      );
      return 0;
    }

    // Fetch and parse iCal feed
    const events = await this.fetchAndParseIcalFeed(property.icalSyncUrl);

    if (!events || events.length === 0) {
      this.logger.debug(
        `No events found in iCal feed for property ${property.id}`,
      );
      return 0;
    }

    // Convert checkout events to JobVisits
    const jobVisitsCreated = await this.createJobVisitsFromCheckoutEvents(
      property,
      events,
      workspaceId,
    );

    this.logger.log(
      `Created ${jobVisitsCreated} JobVisits from iCal feed for property ${property.id}`,
    );

    return jobVisitsCreated;
  }

  private async fetchAndParseIcalFeed(
    icalUrl: string,
  ): Promise<ParsedCheckoutEvent[]> {
    try {
      // Fetch the iCal feed
      const response = await fetch(icalUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch iCal feed: ${response.status} ${response.statusText}`,
        );
      }

      const icsData = await response.text();

      // Parse iCal data
      const parsed = ical.parseICS(icsData);

      // Extract checkout events
      const checkoutEvents: ParsedCheckoutEvent[] = [];

      for (const key of Object.keys(parsed)) {
        const event = parsed[key];

        // Skip non-VEVENT entries
        if (event.type !== 'VEVENT') {
          continue;
        }

        // Detect checkout/turnover events
        // Look for keywords in summary or description
        const summary = (event.summary || '').toLowerCase();
        const description = (event.description || '').toLowerCase();

        const isCheckout =
          summary.includes('checkout') ||
          summary.includes('turnover') ||
          summary.includes('cleaning') ||
          summary.includes('guest out') ||
          description.includes('checkout') ||
          description.includes('turnover');

        if (isCheckout) {
          // Extract the date - for all-day events, dtstart.toJSDate() gives UTC midnight
          const scheduledDate = event.dtstart
            ? (event.dtstart as any).toJSDate?.() || event.dtstart
            : null;

          if (scheduledDate) {
            checkoutEvents.push({
              summary: event.summary || 'Checkout',
              description: event.description || '',
              scheduledDate: new Date(scheduledDate),
              externalEventId: event.uid,
            });
          }
        }
      }

      return checkoutEvents;
    } catch (error) {
      this.logger.error(
        `Error fetching iCal feed from ${icalUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async createJobVisitsFromCheckoutEvents(
    property: PropertyWorkspaceEntity,
    checkoutEvents: ParsedCheckoutEvent[],
    workspaceId: string,
  ): Promise<number> {
    const jobVisitRepository =
      await this.globalWorkspaceOrmManager.getRepository<JobVisitWorkspaceEntity>(
        workspaceId,
        'jobVisit',
      );

    let created = 0;

    for (const event of checkoutEvents) {
      try {
        // Check if JobVisit already exists for this checkout event
        const existing = await jobVisitRepository.findOne({
          where: {
            propertyId: property.id,
            name: event.externalEventId, // Use external event ID as unique identifier
          },
        });

        if (existing) {
          this.logger.debug(
            `JobVisit already exists for external event ${event.externalEventId}`,
          );
          continue;
        }

        // Create new JobVisit for this checkout
        const jobVisit = await jobVisitRepository.create({
          name: `Checkout - ${event.summary}`,
          scheduledDate: event.scheduledDate.toISOString(),
          status: 'SCHEDULED',
          notes: `STR checkout event: ${event.externalEventId}\n${event.description}`,
          propertyId: property.id,
          checklistCompleted: false,
        });

        this.logger.log(
          `Created JobVisit ${jobVisit.id} for property ${property.id} on ${event.scheduledDate.toISOString()}`,
        );

        created++;
      } catch (error) {
        this.logger.error(
          `Failed to create JobVisit from checkout event ${event.externalEventId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with next event
      }
    }

    return created;
  }
}

type ParsedCheckoutEvent = {
  summary: string;
  description: string;
  scheduledDate: Date;
  externalEventId: string;
};
