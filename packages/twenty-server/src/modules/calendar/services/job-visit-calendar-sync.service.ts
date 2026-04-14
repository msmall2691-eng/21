import { Injectable, Logger } from '@nestjs/common';

import { google, type calendar_v3 as calendarV3 } from 'googleapis';
import { v4 as uuid } from 'uuid';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type CalendarChannelEventAssociationWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-channel-event-association.workspace-entity';
import { type ConnectedAccountWorkspaceEntity } from 'src/modules/connected-account/standard-objects/connected-account.workspace-entity';
import { OAuth2ClientManagerService } from 'src/modules/connected-account/oauth2-client-manager/services/oauth2-client-manager.service';

// Business timezone for scheduled cleaning events.
// The Maine Cleaning Co. is in Maine -> Eastern Time.
// If expanding to other regions, move this onto a per-workspace setting.
const BUSINESS_TIME_ZONE = 'America/New_York';

// Cleaning window (wall-clock in BUSINESS_TIME_ZONE).
const CLEANING_START_HOUR = 10; // 10:00 AM local
const CLEANING_END_HOUR = 12; // 12:00 PM local

/**
 * Build a "floating" ISO-ish datetime string (no Z, no offset) for a given
 * calendar day + hour. Google Calendar's events.insert treats dateTime
 * without an offset as local to the provided `timeZone` field, so this
 * produces an event that lands at the correct wall-clock time in
 * BUSINESS_TIME_ZONE regardless of the server's own timezone.
 */
const buildFloatingDateTime = (date: Date, hour: number): string => {
  // Use UTC components as the "day" anchor — scheduledDate from iCal
  // comes in as a UTC midnight so getUTC* gives us the intended calendar day.
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:00:00`;
};

/**
 * Return the offset (in milliseconds) for `instant` as seen in `timeZone`.
 * Positive when tz is ahead of UTC, negative when behind. Handles DST.
 */
const getTimeZoneOffsetMs = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(instant);
  const offsetStr =
    parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = offsetStr.match(/GMT([+-]?\d+)(?::(\d+))?/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const sign = hours === 0 ? 1 : Math.sign(hours);
  return (hours * 60 + sign * minutes) * 60 * 1000;
};

/**
 * Build a real UTC Date representing `hour:00` wall-clock on `date` in
 * BUSINESS_TIME_ZONE. Used when we need to persist the event to Twenty's
 * DB as a proper UTC ISO string.
 */
const toBusinessTimeUTC = (date: Date, hour: number): Date => {
  const floating = buildFloatingDateTime(date, hour);
  const candidate = new Date(`${floating}Z`);
  const offset = getTimeZoneOffsetMs(candidate, BUSINESS_TIME_ZONE);
  return new Date(candidate.getTime() - offset);
};

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

        const startTime = toBusinessTimeUTC(
          input.checkoutDate,
          CLEANING_START_HOUR,
        );
        const endTime = toBusinessTimeUTC(
          input.checkoutDate,
          CLEANING_END_HOUR,
        );

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

    const startDateTime = buildFloatingDateTime(
      input.checkoutDate,
      CLEANING_START_HOUR,
    );
    const endDateTime = buildFloatingDateTime(
      input.checkoutDate,
      CLEANING_END_HOUR,
    );

    const event: calendarV3.Schema$Event = {
      summary: this.buildEventTitle(input.propertyName, input.checkoutDate),
      description: this.buildEventDescription({
        propertyAddress: input.propertyAddress,
        guestNote: input.guestNote,
        icalUid: input.icalUid,
      }),
      location: input.propertyAddress || undefined,
      start: {
        dateTime: startDateTime,
        timeZone: BUSINESS_TIME_ZONE,
      },
      end: {
        dateTime: endDateTime,
        timeZone: BUSINESS_TIME_ZONE,
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

        const startTime = toBusinessTimeUTC(
          input.checkoutDate,
          CLEANING_START_HOUR,
        );
        const endTime = toBusinessTimeUTC(
          input.checkoutDate,
          CLEANING_END_HOUR,
        );

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
