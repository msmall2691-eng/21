import { Injectable, Logger } from '@nestjs/common';

import { google, type calendar_v3 as calendarV3 } from 'googleapis';
import { v4 as uuid } from 'uuid';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type CalendarChannelEventAssociationWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-channel-event-association.workspace-entity';
import { type ConnectedAccountWorkspaceEntity } from 'src/modules/connected-account/standard-objects/connected-account.workspace-entity';
import { OAuth2ClientManagerService } from 'src/modules/connected-account/oauth2-client-manager/services/oauth2-client-manager.service';

/**
 * Service to sync JobVisit records (Airbnb turnovers) to Google Calendar.
 *
 * When a JobVisit is created (from iCal sync), this service creates a corresponding
 * Google Calendar event so Megan's calendar shows:
 * - Guest checkout dates
 * - Cleaning schedules
 * - All in one unified view
 *
 * Integration with iCal sync:
 * - iCal sync creates JobVisit records every 6 hours
 * - JobVisitCreated event triggers this service
 * - Google Calendar updated with turnover event
 */
@Injectable()
export class JobVisitCalendarSyncService {
  private readonly logger = new Logger(JobVisitCalendarSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly oAuth2ClientManagerService: OAuth2ClientManagerService,
  ) {}

  /**
   * Create a Google Calendar event for a turnover cleaning.
   * Called when a JobVisit is created from iCal sync.
   *
   * Event details:
   * - Title: "Cleaning: [Property Name]"
   * - Start: checkout date at 10:00 AM
   * - End: checkout date at 12:00 PM (2-hour block)
   * - Location: property address
   * - Description: guest notes, iCal UID, etc.
   * - Color: different from regular calendar (mark as "Cleaning")
   */
  async createCalendarEventForJobVisit(input: {
    jobVisitId: string;
    propertyName: string;
    propertyAddress: string | null;
    checkoutDate: Date;
    guestNote: string | null;
    icalUid: string | null;
    workspaceId: string;
    workspaceMemberId: string; // Megan's workspace member ID
  }): Promise<{
    calendarEventId: string;
    eventLink: string;
  }> {
    try {
      // Get Megan's Google Calendar connected account
      const connectedAccount = await this.getGoogleCalendarConnectedAccount(
        input.workspaceId,
        input.workspaceMemberId,
      );

      if (!connectedAccount) {
        this.logger.warn(
          `No Google Calendar connected account found for workspace member ${input.workspaceMemberId}`,
        );
        return this.createPlaceholderEvent(input.jobVisitId);
      }

      // Create event in Google Calendar
      const googleCalendarEvent = await this.createGoogleCalendarEvent(
        connectedAccount,
        input,
      );

      // Save event to Twenty database
      const calendarEvent = await this.saveCalendarEvent(
        input.workspaceId,
        input.workspaceMemberId,
        googleCalendarEvent,
        input,
      );

      this.logger.debug(
        `Created calendar event ${calendarEvent.id} for JobVisit ${input.jobVisitId}`,
      );

      return {
        calendarEventId: calendarEvent.id,
        eventLink: `https://calendar.google.com/calendar/u/0/r/eventedit/${googleCalendarEvent.id}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create calendar event for JobVisit ${input.jobVisitId}: ${error}`,
      );
      // Return placeholder on error to avoid breaking the iCal sync flow
      return this.createPlaceholderEvent(input.jobVisitId);
    }
  }

  /**
   * Update a calendar event when JobVisit details change (e.g., reschedule).
   */
  async updateCalendarEventForJobVisit(input: {
    calendarEventId: string;
    checkoutDate: Date;
    guestNote: string | null;
    workspaceId: string;
  }): Promise<void> {
    try {
      const authContext = buildSystemAuthContext(input.workspaceId);

      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
        const calendarEventRepository =
          await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
            input.workspaceId,
            'calendarEvent',
          );

        const event = await calendarEventRepository.findOne({
          where: { id: input.calendarEventId },
        });

        if (!event) {
          this.logger.warn(
            `Calendar event ${input.calendarEventId} not found for update`,
          );
          return;
        }

        const startTime = new Date(input.checkoutDate);
        startTime.setHours(10, 0, 0, 0);

        const endTime = new Date(input.checkoutDate);
        endTime.setHours(12, 0, 0, 0);

        await calendarEventRepository.update(input.calendarEventId, {
          startsAt: startTime.toISOString(),
          endsAt: endTime.toISOString(),
          description: this.buildEventDescription({
            propertyAddress: null,
            guestNote: input.guestNote,
            icalUid: event.iCalUid,
          }),
        });

        this.logger.debug(`Updated calendar event ${input.calendarEventId}`);
      }, authContext);
    } catch (error) {
      this.logger.error(
        `Failed to update calendar event ${input.calendarEventId}: ${error}`,
      );
    }
  }

  /**
   * Delete a calendar event when JobVisit is cancelled/deleted.
   */
  async deleteCalendarEventForJobVisit(
    calendarEventId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      const authContext = buildSystemAuthContext(workspaceId);

      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
        const calendarEventRepository =
          await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
            workspaceId,
            'calendarEvent',
          );

        await calendarEventRepository.delete(calendarEventId);
        this.logger.debug(`Deleted calendar event ${calendarEventId}`);
      }, authContext);
    } catch (error) {
      this.logger.error(
        `Failed to delete calendar event ${calendarEventId}: ${error}`,
      );
    }
  }

  /**
   * Get Megan's Google Calendar connected account.
   */
  private async getGoogleCalendarConnectedAccount(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<ConnectedAccountWorkspaceEntity | null> {
    try {
      const authContext = buildSystemAuthContext(workspaceId);

      return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const connectedAccountRepository =
            await this.globalWorkspaceOrmManager.getRepository<ConnectedAccountWorkspaceEntity>(
              workspaceId,
              'connectedAccount',
            );

          const googleAccount = await connectedAccountRepository.findOne({
            where: {
              accountOwnerId: workspaceMemberId,
              provider: 'google',
            },
          });

          return googleAccount ?? null;
        },
        authContext,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get Google Calendar connected account: ${error}`,
      );
      return null;
    }
  }

  /**
   * Create event in Google Calendar via API.
   */
  private async createGoogleCalendarEvent(
    connectedAccount: any,
    input: {
      jobVisitId: string;
      propertyName: string;
      propertyAddress: string | null;
      checkoutDate: Date;
      guestNote: string | null;
      icalUid: string | null;
    },
  ): Promise<calendarV3.Schema$Event> {
    const oAuth2Client =
      await this.oAuth2ClientManagerService.getGoogleOAuth2Client(
        connectedAccount,
      );

    const googleCalendarClient = google.calendar({
      version: 'v3',
      auth: oAuth2Client,
    });

    const startTime = new Date(input.checkoutDate);
    startTime.setHours(10, 0, 0, 0);

    const endTime = new Date(input.checkoutDate);
    endTime.setHours(12, 0, 0, 0);

    const event: calendarV3.Schema$Event = {
      summary: this.buildEventTitle(input.propertyName, input.checkoutDate),
      description: this.buildEventDescription({
        propertyAddress: input.propertyAddress,
        guestNote: input.guestNote,
        icalUid: input.icalUid,
      }),
      location: input.propertyAddress || undefined,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Denver', // TODO: Make configurable
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Denver', // TODO: Make configurable
      },
      transparency: 'opaque', // Mark as busy
    };

    const response = await googleCalendarClient.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    if (!response.data.id) {
      throw new Error('Failed to create Google Calendar event: no event ID returned');
    }

    return response.data;
  }

  /**
   * Save calendar event to Twenty database.
   */
  private async saveCalendarEvent(
    workspaceId: string,
    workspaceMemberId: string,
    googleCalendarEvent: calendarV3.Schema$Event,
    input: {
      jobVisitId: string;
      propertyName: string;
      propertyAddress: string | null;
      checkoutDate: Date;
      guestNote: string | null;
      icalUid: string | null;
    },
  ): Promise<CalendarEventWorkspaceEntity> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const calendarEventRepository =
          await this.globalWorkspaceOrmManager.getRepository<CalendarEventWorkspaceEntity>(
            workspaceId,
            'calendarEvent',
          );

        const startTime = new Date(input.checkoutDate);
        startTime.setHours(10, 0, 0, 0);

        const endTime = new Date(input.checkoutDate);
        endTime.setHours(12, 0, 0, 0);

        const eventId = uuid();
        const newEvent = {
          id: eventId,
          title: this.buildEventTitle(input.propertyName, input.checkoutDate),
          description: this.buildEventDescription({
            propertyAddress: input.propertyAddress,
            guestNote: input.guestNote,
            icalUid: input.icalUid,
          }),
          location: input.propertyAddress || null,
          startsAt: startTime.toISOString(),
          endsAt: endTime.toISOString(),
          isFullDay: false,
          isCanceled: false,
          conferenceSolution: null,
          conferenceLink: {
            primaryLinkLabel: null,
            primaryLinkUrl: null,
            secondaryLinks: [],
          },
          iCalUid: googleCalendarEvent.id || `jobvisit_${input.jobVisitId}`,
          externalCreatedAt: new Date().toISOString(),
          externalUpdatedAt: new Date().toISOString(),
        };

        await calendarEventRepository.insert([newEvent]);

        return newEvent as CalendarEventWorkspaceEntity;
      },
      authContext,
    );
  }

  /**
   * Create placeholder event when Google Calendar integration is unavailable.
   */
  private createPlaceholderEvent(jobVisitId: string): {
    calendarEventId: string;
    eventLink: string;
  } {
    return {
      calendarEventId: `cal_${jobVisitId}`,
      eventLink: `https://calendar.google.com/calendar/u/0/r/eventedit/${jobVisitId}`,
    };
  }

  /**
   * Build event title from property and date.
   */
  buildEventTitle(propertyName: string, checkoutDate: Date): string {
    const date = checkoutDate.toISOString().split('T')[0];
    return `🧹 Cleaning: ${propertyName} (${date})`;
  }

  /**
   * Build event description with guest notes and metadata.
   */
  buildEventDescription(input: {
    propertyAddress: string | null;
    guestNote: string | null;
    icalUid: string | null;
  }): string {
    const lines: string[] = ['Airbnb Turnover Cleaning'];

    if (input.propertyAddress) {
      lines.push(`📍 Location: ${input.propertyAddress}`);
    }

    if (input.guestNote) {
      lines.push(`👤 Guest: ${input.guestNote}`);
    }

    lines.push(`\n🔗 Auto-scheduled from Airbnb iCal`);

    if (input.icalUid) {
      lines.push(`📋 iCal UID: ${input.icalUid}`);
    }

    return lines.join('\n');
  }
}
