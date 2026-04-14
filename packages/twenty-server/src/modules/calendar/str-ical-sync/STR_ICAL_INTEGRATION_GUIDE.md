# STR iCal Integration Guide

## Overview

The STR (Short-Term Rental) iCal Integration allows you to automatically pull guest checkout dates from Airbnb, VRBO, Booking.com, and other PMS (Property Management Systems) and create JobVisits for cleanings in Twenty CRM. These JobVisits automatically sync to Google Calendar, allowing your team to see all cleanings in one unified calendar view.

## Architecture

```
PMS iCal Feed (Airbnb, VRBO, etc.)
         ↓
[StrIcalSyncService] - Fetches and parses iCal
         ↓
[Property] has icalSyncUrl field
         ↓
[JobVisit] created for each checkout
         ↓
[JobVisitCalendarSyncService] (existing) - Syncs to Google Calendar
         ↓
Google Calendar (shared with customers)
```

## Setup Instructions

### 1. Add iCal Feed URL to Property

In the Twenty CRM UI, navigate to a Property and add the iCal feed URL in the `icalSyncUrl` field:

**Airbnb:**
- Go to Airbnb hosting dashboard
- Calendar → Share → iCal URL
- Format: `https://www.airbnb.com/calendar/ical/{listing_id}.ics`

**VRBO/HomeAway:**
- Property → Calendar settings
- Find "Embed & share calendar" section
- Copy the iCal URL

**Booking.com:**
- Property Tools → Channel Manager
- Calendar → Copy iCal URL

**Generic iCal Feed:**
- Any public `.ics` feed URL works

### 2. Automatic Sync (Cron)

The system automatically syncs iCal feeds every **6 hours** via the `StrIcalSyncCronJob`. 

**First sync** happens immediately on server startup, then repeats every 6 hours.

### 3. Manual Sync (Optional)

Trigger a manual sync via API:

```bash
# Sync all STR properties in workspace
POST /webhooks/str-ical-sync/{workspaceId}

# Sync specific property (useful when adding new iCal URL)
POST /webhooks/str-ical-sync/{workspaceId}/property/{propertyId}
```

## How It Works

### Event Detection

The system looks for checkout events in iCal feeds by detecting:
- Summary contains: "checkout", "turnover", "cleaning", "guest out"
- Description contains: "checkout", "turnover"

Example iCal events that will be detected:
```
SUMMARY:Guest checkout
SUMMARY:Turnover cleaning
SUMMARY:Checkout - John Smith
```

### JobVisit Creation

For each detected checkout event, a JobVisit is created:
- **Name:** `Checkout - {event summary}`
- **ScheduledDate:** The checkout date from iCal (usually 11 AM local time for Airbnb)
- **Status:** SCHEDULED
- **Property:** Linked to the Property with the iCal feed
- **Notes:** Contains the original iCal event ID and description

### Deduplication

To prevent duplicate JobVisits:
- The external iCal event ID is stored in the JobVisit name
- Before creating, the system checks if a JobVisit already exists for this event ID
- Updates to checkout dates are not handled (consider them as new cleanings)

### Calendar Sync

Once a JobVisit is created, the existing `JobVisitCalendarSyncService` automatically:
1. Creates a Google Calendar event in the workspace calendar
2. Sets the event time to 10:00 AM - 12:00 PM (configurable in `job-visit-calendar-sync.service.ts`)
3. Event is visible to all team members and customers with calendar access

## Configuration

### Checkout Time Window

Edit `src/modules/calendar/services/job-visit-calendar-sync.service.ts`:

```typescript
const CLEANING_START_HOUR = 10;  // 10:00 AM
const CLEANING_END_HOUR = 12;    // 12:00 PM
```

### Sync Frequency

Edit `src/modules/calendar/crons/jobs/str-ical-sync.cron.job.ts`:

```typescript
@Cron(CronExpression.EVERY_6_HOURS)  // Change frequency here
async syncAllStrProperties(): Promise<void>
```

### Business Timezone

Edit `src/modules/calendar/services/job-visit-calendar-sync.service.ts`:

```typescript
const BUSINESS_TIME_ZONE = 'America/New_York';  // Change timezone
```

## Workflow: From Checkout to Invoice

### Phase 1: JobVisit Creation (This)
```
iCal Feed → JobVisit created → Google Calendar event
```

### Phase 1 (Already Done): Invoice on Completion
```
JobVisit marked complete (in UI or calendar) → Invoice auto-drafted → Email/SMS to customer
```

### Complete Customer Experience
```
1. Guest books on Airbnb for May 15-18
2. Checkout event appears in iCal feed
3. iCal sync creates JobVisit for May 18
4. JobVisit syncs to Google Calendar (shared with customer)
5. Customer sees "Cleaning scheduled May 18, 10 AM-12 PM" in Calendar
6. Team member marks job complete
7. Invoice auto-drafts → Sent to customer via email/SMS
```

## Troubleshooting

### JobVisits not creating

1. **Check if iCal URL is valid:**
   - Open the iCal URL in browser, should download `.ics` file
   - Verify the URL in Property.icalSyncUrl field

2. **Check if iCal contains checkout events:**
   - Download the iCal file manually
   - Look for VEVENT entries with "checkout" or similar in SUMMARY field

3. **Check job queue:**
   - Verify Redis is running: `redis-cli ping` → should return `PONG`
   - Check message queue logs in server output

4. **Manual test:**
   - Call `POST /webhooks/str-ical-sync/{workspaceId}` manually
   - Check server logs for errors

### Events have wrong time

- Verify BUSINESS_TIME_ZONE in `job-visit-calendar-sync.service.ts` matches your timezone
- iCal all-day events default to checkout at 10 AM in the configured timezone

### Duplicates created

- This shouldn't happen (deduplication is built-in)
- If it does, check that external event IDs are consistent in iCal feed
- May occur if PMS changes event IDs on sync

## Testing

### Add Test iCal Feed

Create a simple `.ics` file for testing:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-checkout-001@example.com
DTSTART;VALUE=DATE:20260520
SUMMARY:Guest checkout
DESCRIPTION:Test checkout event
END:VEVENT
END:VCALENDAR
```

Upload to a public URL and add to Property.icalSyncUrl.

### Manual Sync API Call

```bash
curl -X POST http://localhost:3000/webhooks/str-ical-sync/YOUR_WORKSPACE_ID
```

Response:
```json
{
  "success": true,
  "message": "STR iCal sync queued for workspace YOUR_WORKSPACE_ID"
}
```

## Future Enhancements

- [ ] Turnovers without guest names (generic checkout events)
- [ ] Support for guest name extraction from iCal event title
- [ ] Automatic service agreement assignment based on property
- [ ] Auto-invoice generation (Phase 3)
- [ ] SMS/email notifications for new cleanings
- [ ] Webhook from PMS for real-time sync (instead of 6-hour polling)
- [ ] Conflict detection (overlapping checkouts)
- [ ] Guest contact info extraction from iCal

## API Reference

### Queue Manual Sync (All Properties)

```
POST /webhooks/str-ical-sync/:workspaceId
```

**Response:**
```json
{
  "success": true,
  "message": "STR iCal sync queued for workspace {id}"
}
```

### Queue Manual Sync (Specific Property)

```
POST /webhooks/str-ical-sync/:workspaceId/property/:propertyId
```

**Response:**
```json
{
  "success": true,
  "message": "STR iCal sync queued for property {id}"
}
```

## Files Changed

### New Files
- `services/str-ical-sync.service.ts` - Core sync logic
- `jobs/str-ical-sync.job.ts` - Background job processor
- `crons/jobs/str-ical-sync.cron.job.ts` - Scheduled cron
- `controllers/str-ical-sync.controller.ts` - API endpoints
- `str-ical-sync/str-ical-sync.module.ts` - Module definition

### Modified Files
- `calendar.module.ts` - Added StrIcalSyncModule import
- `property.workspace-entity.ts` - Already has `icalSyncUrl` field (pre-existing)

## Success Criteria

Phase 2 is complete when:
- ✅ iCal feeds can be parsed from any PMS
- ✅ Checkout events automatically create JobVisits (every 6 hours)
- ✅ JobVisits appear in Google Calendar with correct dates/times
- ✅ Customers can see their cleanings in shared Google Calendar
- ✅ Manual sync API works for immediate feedback
- ✅ Deduplication prevents double-booking
- ✅ Integration with existing Phase 1 (invoice on completion)

## Related

- **Phase 1:** Google Calendar → Invoice on JobVisit completion
  - File: `google-calendar-completion-handler.service.ts`
  - File: `invoice.service.ts`

- **Existing:** JobVisit → Google Calendar sync
  - File: `job-visit-calendar-sync.service.ts`
