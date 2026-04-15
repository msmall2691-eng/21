import { Injectable, Logger } from '@nestjs/common';
import { google, type calendar_v3 as calendarV3 } from 'googleapis';
import { v4 as uuid } from 'uuid';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type ConnectedAccountWorkspaceEntity } from 'src/modules/connected-account/standard-objects/connected-account.workspace-entity';
import { OAuth2ClientManagerService } from 'src/modules/connected-account/oauth2-client-manager/services/oauth2-client-manager.service';

// Business timezone for scheduled cleaning events.
// The Maine Cleaning Co. is in Maine -> Eastern Time.
const BUSINESS_TIME_ZONE = 'America/New_York';

// Fallback cleaning window (wall-clock in BUSINESS_TIME_ZONE) used only
// when a JobVisit has no explicit time-of-day set on scheduledDate.
const DEFAULT_START_HOUR = 10; // 10:00 AM local
const DEFAULT_DURATION_MINUTES = 120; // 2 hour block

/**
 * Build a "floating" ISO-ish datetime string (no Z, no offset) for a given
 * Date + wall-clock hour/minute. Google Calendar's events.insert treats
 * dateTime without an offset as local to the provided `timeZone` field,
 * so this produces an event that lands at the correct wall-clock time in
 * BUSINESS_TIME_ZONE regardless of the server's own timezone.
 */
const buildFloatingDateTime = (
  date: Date,
  hour: number,
  minute = 0,
): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  return `${year}-${month}-${day}T${hh}:${mm}:00`;
};

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
 * Build a real UTC Date representing `hour:minute` wall-clock on `date` in
 * BUSINESS_TIME_ZONE. Used when persisting to Twenty's DB as UTC ISO.
 */
const toBusinessTimeUTC = (
  date: Date,
  hour: number,
  minute = 0,
): Date => {
  const floating = buildFloatingDateTime(date, hour, minute);
  const candidate = new Date(`${floating}Z`);
  const offset = getTimeZoneOffsetMs(candidate, BUSINESS_TIME_ZONE);

  return new Date(candidate.getTime() - offset);
};

/**
 * Decide the event start + end times based on whether the caller gave us
 * a scheduledDate that already has time-of-day, or just a bare date.
 *
 * - If scheduledDate has a non-zero time component, use it as-is and
 *   apply `durationMinutes` (or DEFAULT_DURATION_MINUTES).
 * - If scheduledDate is midnight UTC (i.e. a "day only" value from iCal
 *   or from the UI date picker), fall back to 10 AM local + 2 hours.
 */
const resolveEventWindow = (
  scheduledDate: Date,
  durationMinutes: number | null,
): { startFloating: string; endFloating: string; startUTC: Date; endUTC: Date } => {
  const hasExplicitTime =
    scheduledDate.getUTCHours() !== 0 ||
    scheduledDate.getUTCMinutes() !== 0 ||
    scheduledDate.getUTCSeconds() !== 0;

  const duration =
    typeof durationMinutes === 'number' && durationMinutes > 0
      ? durationMinutes
      : DEFAULT_DURATION_MINUTES;

  if (hasExplicitTime) {
    // Interpret scheduledDate as a real UTC timestamp. Convert to
    // BUSINESS_TIME_ZONE wall clock for the floating representation.
    const offset = getTimeZoneOffsetMs(scheduledDate, BUSINESS_TIME_ZONE);
    const local = new Date(scheduledDate.getTime() + offset);
    const hour = local.getUTCHours();
    const minute = local.getUTCMinutes();

    const endMs = scheduledDate.getTime() + duration * 60 * 1000;
    const endDate = new Date(endMs);
    const endLocal = new Date(endDate.getTime() + offset);

    return {
      startFloating: buildFloatingDateTime(local, hour, minute),
      endFloating: buildFloatingDateTime(
        endLocal,
        endLocal.getUTCHours(),
        endLocal.getUTCMinutes(),
      ),
      startUTC: scheduledDate,
      endUTC: endDate,
    };
  }

  // No explicit time -> default window.
  const startUTC = toBusinessTimeUTC(scheduledDate, DEFAULT_START_HOUR);
  const endUTC = new Date(startUTC.getTime() + duration * 60 * 1000);

  const endHour = DEFAULT_START_HOUR + Math.floor(duration / 60);
  const endMin = duration % 60;

  return {
    startFloating: buildFloatingDateTime(scheduledDate, DEFAULT_START_HOUR),
    endFloating: buildFloatingDateTime(scheduledDate, endHour, endMin),
    startUTC,
    endUTC,
  };
};

/**
 * Service to sync JobVisit records to Google Calendar.
 *
 * Canonical event format (April 2026 redesign):
 *   Title:       "Cleaning — {address or property name} — {client name}"
 *   Description: Multi-line block with client, property, notes.
 *
 * When a JobVisit is created or rescheduled, this service creates or
 * updates a Google Calendar event so Megan's calendar shows every job.
 */
@Injectable()
export class JobVisitCalendarSyncService {
  private readonly logger = new Logger(JobVisitCalendarSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly oAuth2ClientManagerService: OAuth2ClientManagerService,
  ) {}

  /**
   * Create a Google Calendar event for a JobVisit.
   */
  async createCalendarEventForJobVisit(input: {
    jobVisitId: string;
    propertyName: string;
    propertyAddress: string | null;
    clientName: string | null;
    scheduledDate: Date;
    durationMinutes: number | null;
    notes: string | null;
    icalUid: string | null;
    workspaceId: string;
    workspaceMemberId: string;
  }): Promise<{
    calendarEventId: string;
    externalEventId: string;
    eventLink: string;
  } | null> {
    const connectedAccount = await this.getGoogleCalendarConnectedAccount(
      input.workspaceId,
      input.workspaceMemberId,
    );

    if (!connectedAccount) {
      this.logger.warn(
        `No Google Calendar connected account found for workspace member ${input.workspaceMemberId} - JobVisit ${input.jobVisitId} will be retried next cycle`,
      );

      return null;
    }

    try {
      const googleCalendarEvent = await this.createGoogleCalendarEvent(
        connectedAccount,
        input,
      );

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
        externalEventId: googleCalendarEvent.id ?? '',
        eventLink: `https://calendar.google.com/calendar/u/0/r/eventedit/${googleCalendarEvent.id}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create calendar event for JobVisit ${input.jobVisitId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Update an existing calendar event when JobVisit details change.
   * Used both by Twenty-side edits AND by the backfill script.
   */
  async updateCalendarEventForJobVisit(input: {
    calendarEventId: string;
    externalEventId: string | null;
    propertyName: string;
    propertyAddress: string | null;
    clientName: string | null;
    scheduledDate: Date;
    durationMinutes: number | null;
    notes: string | null;
    workspaceId: string;
    workspaceMemberId: string;
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

        const window = resolveEventWindow(
          input.scheduledDate,
          input.durationMinutes,
        );

        const title = this.buildEventTitle({
          propertyName: input.propertyName,
          propertyAddress: input.propertyAddress,
          clientName: input.clientName,
        });
        const description = this.buildEventDescription({
          propertyAddress: input.propertyAddress,
          clientName: input.clientName,
          notes: input.notes,
          icalUid: event.iCalUid,
        });

        // Update Twenty's copy
        await calendarEventRepository.update(input.calendarEventId, {
          title,
          description,
          startsAt: window.startUTC.toISOString(),
          endsAt: window.endUTC.toISOString(),
          location: input.propertyAddress || null,
        });

        // Update Google's copy if we have the external id
        const externalId =
          input.externalEventId || this.extractExternalIdFromICalUid(event.iCalUid);

        if (externalId) {
          const connectedAccount =
            await this.getGoogleCalendarConnectedAccount(
              input.workspaceId,
              input.workspaceMemberId,
            );

          if (connectedAccount) {
            const oAuth2Client =
              await this.oAuth2ClientManagerService.getGoogleOAuth2Client(
                connectedAccount,
              );
            const gcal = google.calendar({ version: 'v3', auth: oAuth2Client });

            try {
              await gcal.events.patch({
                calendarId: 'primary',
                eventId: externalId,
                requestBody: {
                  summary: title,
                  description,
                  location: input.propertyAddress || undefined,
                  start: {
                    dateTime: window.startFloating,
                    timeZone: BUSINESS_TIME_ZONE,
                  },
                  end: {
                    dateTime: window.endFloating,
                    timeZone: BUSINESS_TIME_ZONE,
                  },
                },
              });
            } catch (gcalError) {
              this.logger.warn(
                `Failed to update Google event ${externalId}: ${
                  gcalError instanceof Error
                    ? gcalError.message
                    : String(gcalError)
                }`,
              );
            }
          }
        }

        this.logger.debug(`Updated calendar event ${input.calendarEventId}`);
      }, authContext);
    } catch (error) {
      this.logger.error(
        `Failed to update calendar event ${input.calendarEventId}: ${error}`,
      );
    }
  }

  /**
   * Delete a calendar event when JobVisit is cancelled.
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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

  private async createGoogleCalendarEvent(
    connectedAccount: ConnectedAccountWorkspaceEntity,
    input: {
      jobVisitId: string;
      propertyName: string;
      propertyAddress: string | null;
      clientName: string | null;
      scheduledDate: Date;
      durationMinutes: number | null;
      notes: string | null;
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

    const window = resolveEventWindow(
      input.scheduledDate,
      input.durationMinutes,
    );

    const event: calendarV3.Schema$Event = {
      summary: this.buildEventTitle({
        propertyName: input.propertyName,
        propertyAddress: input.propertyAddress,
        clientName: input.clientName,
      }),
      description: this.buildEventDescription({
        propertyAddress: input.propertyAddress,
        clientName: input.clientName,
        notes: input.notes,
        icalUid: input.icalUid,
      }),
      location: input.propertyAddress || undefined,
      start: {
        dateTime: window.startFloating,
        timeZone: BUSINESS_TIME_ZONE,
      },
      end: {
        dateTime: window.endFloating,
        timeZone: BUSINESS_TIME_ZONE,
      },
      transparency: 'opaque',
      // Stable extended property lets reverse-sync find the JobVisit.
      extendedProperties: {
        private: {
          twentyJobVisitId: input.jobVisitId,
        },
      },
    };

    const response = await googleCalendarClient.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    if (!response.data.id) {
      throw new Error(
        'Failed to create Google Calendar event: no event ID returned',
      );
    }

    return response.data;
  }

  private async saveCalendarEvent(
    workspaceId: string,
    workspaceMemberId: string,
    googleCalendarEvent: calendarV3.Schema$Event,
    input: {
      jobVisitId: string;
      propertyName: string;
      propertyAddress: string | null;
      clientName: string | null;
      scheduledDate: Date;
      durationMinutes: number | null;
      notes: string | null;
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

        const window = resolveEventWindow(
          input.scheduledDate,
          input.durationMinutes,
        );

        const eventId = uuid();
        const newEvent = {
          id: eventId,
          title: this.buildEventTitle({
            propertyName: input.propertyName,
            propertyAddress: input.propertyAddress,
            clientName: input.clientName,
          }),
          description: this.buildEventDescription({
            propertyAddress: input.propertyAddress,
            clientName: input.clientName,
            notes: input.notes,
            icalUid: input.icalUid,
          }),
          location: input.propertyAddress || null,
          startsAt: window.startUTC.toISOString(),
          endsAt: window.endUTC.toISOString(),
          isFullDay: false,
          isCanceled: false,
          conferenceSolution: null,
          conferenceLink: {
            primaryLinkLabel: null,
            primaryLinkUrl: null,
            secondaryLinks: [],
          },
          // Store the Google event id so we can do reverse-sync lookups.
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

  private extractExternalIdFromICalUid(iCalUid: string | null): string | null {
    if (!iCalUid) return null;
    if (iCalUid.startsWith('jobvisit_')) return null;

    return iCalUid;
  }

  // ---------------------------------------------------------------------------
  // Canonical formatters — both GCal and Twenty DB go through these.
  // ---------------------------------------------------------------------------

  buildEventTitle(input: {
    propertyName: string;
    propertyAddress: string | null;
    clientName: string | null;
  }): string {
    // Prefer street address for the middle slot; fall back to property name.
    const location = this.shortAddress(input.propertyAddress) || input.propertyName;
    const client = input.clientName?.trim() || input.propertyName;

    return `Cleaning — ${location} — ${client}`;
  }

  buildEventDescription(input: {
    propertyAddress: string | null;
    clientName: string | null;
    notes: string | null;
    icalUid: string | null;
  }): string {
    const lines: string[] = [];

    if (input.clientName) {
      lines.push(`Client: ${input.clientName}`);
    }

    if (input.propertyAddress) {
      lines.push(`Address: ${input.propertyAddress}`);
    }

    if (input.notes?.trim()) {
      lines.push('');
      lines.push(`Notes: ${input.notes.trim()}`);
    }

    if (input.icalUid) {
      lines.push('');
      lines.push(`(Synced from Airbnb iCal)`);
    }

    return lines.join('\n');
  }

  /**
   * Pull the street portion off a full address so titles stay short.
   * e.g. "17 Oakmont Dr, Falmouth, ME 04105, USA" -> "17 Oakmont Dr"
   */
  private shortAddress(fullAddress: string | null): string | null {
    if (!fullAddress) return null;

    const first = fullAddress.split(',')[0]?.trim();

    return first || null;
  }
}
