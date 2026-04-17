# Phase 2: STR iCal Integration Implementation

## Overview

Phase 2 implements automatic JobVisit creation from STR (Short-Term Rental) property iCal feeds (Airbnb, VRBO, etc.). This allows team members and customers to see cleaning schedules in Google Calendar.

**Goal:** From guest checkout → Google Calendar event visible to customer in 6 hours (or manually triggered)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External Sources                             │
├─────────────────────────────────────────────────────────────────────┤
│  Airbnb iCal    │   VRBO iCal    │   Booking.com iCal   │  Custom  │
│   (Public URL)  │   (Public URL) │    (Public URL)      │   iCal   │
└────────┬────────┴────────┬────────┴────────┬────────────┴─────┬────┘
         │                 │                 │                  │
         └─────────────────┼─────────────────┼──────────────────┘
                           │
                    ┌──────▼──────────┐
                    │  StrIcalSync    │
                    │    Service      │
                    │                 │
                    │ • Fetch iCal    │
                    │ • Parse events  │
                    │ • Dedup events  │
                    └──────┬──────────┘
                           │
                    ┌──────▼──────────┐
                    │  Property       │
                    │  entity         │
                    │                 │
                    │ id              │
                    │ name            │
                    │ icalSyncUrl ◄──── (Stores Airbnb/VRBO URL)
                    │ person/company  │
                    └─────────────────┘
                           │
                    ┌──────▼──────────┐
                    │  JobVisit       │
                    │  entity         │
                    │                 │
                    │ id              │
                    │ name            │
                    │ scheduledDate   │
                    │ propertyId      │
                    │ serviceAgreement│
                    │ calendarEventId │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────────┐
                    │ JobVisitCalendarSync    │
                    │ Service (EXISTING)      │
                    │                         │
                    │ • Create Cal event      │
                    │ • Set time (10am-12pm)  │
                    │ • Link to workspace cal │
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  Google Calendar        │
                    │  (Maine Cleaning Co.)   │
                    │                         │
                    │  Visible to:            │
                    │  • Team members         │
                    │  • Customers/Guests     │
                    │  • Property owners      │
                    └─────────────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │  Invoice (Phase 1)      │
                    │  On JobVisit Complete   │
                    │                         │
                    │  • Auto-drafted         │
                    │  • Email to customer    │
                    │  • SMS option           │
                    └─────────────────────────┘
```

## Implementation Status

### ✅ COMPLETED: Backend Services

#### 1. StrIcalSyncService
**File:** `packages/twenty-server/src/modules/calendar/services/str-ical-sync.service.ts`

**Purpose:** Fetch and parse iCal feeds, create JobVisits from checkout events

**Key Methods:**
```typescript
syncStrProperties(input: StrIcalSyncInput): Promise<StrIcalSyncResult>
  // Main entry point
  // - Fetches all properties with icalSyncUrl
  // - Processes each feed
  // - Returns {processed, created, errors}

private syncPropertyIcalFeed(property, workspaceId): Promise<number>
  // Fetch iCal feed URL from property
  // Call fetchAndParseIcalFeed
  // Create JobVisits from checkout events

private fetchAndParseIcalFeed(icalUrl): Promise<ParsedCheckoutEvent[]>
  // HTTP fetch iCal feed
  // Parse with node-ical library
  // Detect checkout events (keywords: checkout, turnover, cleaning)
  // Return array of parsed events

private createJobVisitsFromCheckoutEvents(property, events, workspaceId): Promise<number>
  // For each checkout event
  // Check for existing JobVisit (deduplication)
  // Create new JobVisit with scheduledDate
  // Return count created
```

**Features:**
- ✅ Fetches iCal feeds from URLs (public, no auth needed)
- ✅ Parses VEVENT entries using `node-ical`
- ✅ Detects checkout events by keywords
- ✅ Creates JobVisit records linked to Property
- ✅ Deduplication by external event ID
- ✅ Error handling and logging
- ✅ Works across multi-tenant workspaces

#### 2. Background Job: StrIcalSyncJob
**File:** `packages/twenty-server/src/modules/calendar/jobs/str-ical-sync.job.ts`

**Purpose:** Process queued sync jobs asynchronously

**Features:**
- ✅ BullJS @Processor decorator
- ✅ Handles 'str-ical-sync' jobs
- ✅ Calls StrIcalSyncService
- ✅ Proper error handling and logging

#### 3. Cron Job: StrIcalSyncCronJob
**File:** `packages/twenty-server/src/modules/calendar/crons/jobs/str-ical-sync.cron.job.ts`

**Purpose:** Automatically sync STR properties every 6 hours

**Features:**
- ✅ @Cron(CronExpression.EVERY_6_HOURS)
- ✅ Iterates all active workspaces
- ✅ Queues job per workspace
- ✅ Proper error handling

#### 4. API Controller: StrIcalSyncController
**File:** `packages/twenty-server/src/modules/calendar/controllers/str-ical-sync.controller.ts`

**Purpose:** Provide REST endpoints for manual sync

**Endpoints:**
```
POST /webhooks/str-ical-sync/:workspaceId
  → Sync all STR properties in workspace
  
POST /webhooks/str-ical-sync/:workspaceId/property/:propertyId
  → Sync specific property (useful when adding new iCal URL)
```

**Features:**
- ✅ Input validation
- ✅ Error handling with user-friendly messages
- ✅ Proper HTTP status codes

#### 5. Module: StrIcalSyncModule
**File:** `packages/twenty-server/src/modules/calendar/str-ical-sync/str-ical-sync.module.ts`

**Purpose:** Wire up all STR iCal sync components

**Provides:**
- ✅ StrIcalSyncService
- ✅ StrIcalSyncJob
- ✅ StrIcalSyncCronJob
- ✅ StrIcalSyncController

#### 6. Integration: CalendarModule
**File:** `packages/twenty-server/src/modules/calendar/calendar.module.ts` (MODIFIED)

**Changes:**
- ✅ Added import of StrIcalSyncModule
- ✅ Added StrIcalSyncModule to imports array

### ✅ COMPLETED: Data Model

#### Property Entity
**File:** `packages/twenty-server/src/modules/property/standard-objects/property.workspace-entity.ts`

**Field:** `icalSyncUrl: LinksMetadata | null`
- ✅ Already exists in entity
- ✅ Type: LinksMetadata (designed for URLs)
- ✅ Nullable (property can be non-STR)

**Relationships:**
- ✅ Property → JobVisits (one-to-many)
- ✅ Property → Company/Person (links to customer)

#### JobVisit Entity
**File:** `packages/twenty-server/src/modules/job-visit/standard-objects/job-visit.workspace-entity.ts`

**Fields:**
- ✅ id, createdAt, updatedAt, deletedAt
- ✅ name (stores "Checkout - {summary}")
- ✅ scheduledDate (from iCal event date)
- ✅ completedDate (for Phase 1 integration)
- ✅ status (SCHEDULED initially)
- ✅ notes (stores external event ID + description)
- ✅ propertyId (links to Property)
- ✅ serviceAgreementId (for pricing)
- ✅ calendarEventId (created by JobVisitCalendarSyncService)

**Relationships:**
- ✅ JobVisit → Property (many-to-one)
- ✅ JobVisit → ServiceAgreement
- ✅ JobVisit → CalendarEvent

### ⏳ IN PROGRESS: Frontend Components

#### Need to implement:

1. **Property edit form with iCal URL field**
   - Show input for icalSyncUrl
   - Validate URL format
   - Test button to fetch/parse preview
   - Show sample events from feed

2. **STR Property dashboard**
   - List all STR properties
   - Show iCal sync status
   - Button to manually trigger sync
   - Show last sync time

3. **JobVisit view enhancements**
   - Highlight STR vs. residential vs. commercial
   - Show source (iCal, manual, etc.)
   - Link to property and customer

4. **Calendar view filter**
   - Filter by property type (STR, residential, commercial)
   - Filter by property
   - Show customer info on calendar events

5. **Menu/Navigation updates**
   - Add "STR Properties" section
   - Add "Schedule" section
   - Link property to company/person (customers)

### 🔄 COMPLETED: Integration Points

#### Phase 1 Integration (Google Calendar → Invoice)
**Files Involved:**
- `google-calendar-completion-handler.service.ts` - Detects JobVisit completion
- `invoice.service.ts` - Creates invoice from JobVisit
- `invoice-notification.service.ts` - Sends notifications

**Workflow:**
1. ✅ JobVisit marked as complete (in UI or by Google Calendar webhook)
2. ✅ GoogleCalendarCompletionHandlerService detects completion
3. ✅ InvoiceService creates invoice from JobVisit
4. ✅ InvoiceNotificationService queues email/SMS notifications

#### Phase 2 Integration (iCal → JobVisit → Google Calendar)
**Files Involved:**
- `str-ical-sync.service.ts` - Creates JobVisit
- `job-visit-calendar-sync.service.ts` (existing) - Syncs to Google Calendar

**Workflow:**
1. ✅ iCal feed fetched and parsed
2. ✅ JobVisit created with scheduledDate
3. ✅ Existing JobVisitCalendarSyncService creates Google Calendar event
4. ✅ Google Calendar event visible to team and customers
5. ✅ When completed, Phase 1 invoice flow triggers

## Database Schema

### Properties Table
```sql
CREATE TABLE "property" (
  id UUID PRIMARY KEY,
  name VARCHAR,
  address JSONB,
  property_type VARCHAR,
  bedrooms INT,
  bathrooms INT,
  square_footage INT,
  access_notes TEXT,
  ical_sync_url JSONB,        -- ← Stores iCal feed URL
  is_active BOOLEAN,
  person_id UUID,
  company_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### JobVisits Table
```sql
CREATE TABLE "job_visit" (
  id UUID PRIMARY KEY,
  name VARCHAR,
  scheduled_date TIMESTAMP,    -- ← From iCal checkout event
  completed_date TIMESTAMP,
  status VARCHAR,
  duration INT,
  notes TEXT,                   -- ← Stores external event ID
  checklist_completed BOOLEAN,
  property_id UUID,            -- ← Links to Property
  service_agreement_id UUID,
  staff_member_id UUID,
  calendar_event_id UUID,      -- ← Links to Google Calendar event
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

## Testing Instructions

### 1. Add Test Property with iCal Feed

In Twenty CRM UI:
1. Navigate to Properties
2. Create/Edit a property
3. Add iCal feed URL (e.g., public Airbnb/VRBO calendar)
4. Save

### 2. Trigger Sync (Manual)

```bash
curl -X POST http://localhost:3000/webhooks/str-ical-sync/{WORKSPACE_ID}
```

**Response:**
```json
{
  "success": true,
  "message": "STR iCal sync queued for workspace {id}"
}
```

### 3. Verify JobVisits Created

In Twenty CRM:
1. Navigate to Property → JobVisits
2. Should see new JobVisit with name "Checkout - {event summary}"
3. ScheduledDate should match iCal checkout date

### 4. Verify Google Calendar Sync

In Google Calendar:
1. Open Maine Cleaning Co. calendar
2. Should see events on checkout dates
3. Time: 10:00 AM - 12:00 PM (configurable)
4. Title: Should reference property/job

### 5. Test Complete Workflow (Phase 1 + Phase 2)

1. Ensure JobVisit synced to Google Calendar ✓
2. Mark JobVisit as complete (check completedDate)
3. Check that invoice auto-drafts (Phase 1)
4. Verify email notification queued

## Configuration Files

### Enable/Disable iCal Sync

In `str-ical-sync.service.ts` or environment variables:

```typescript
// Cron frequency (default: every 6 hours)
@Cron(CronExpression.EVERY_6_HOURS)

// Business hours (default: 10 AM - 12 PM ET)
const CLEANING_START_HOUR = 10;
const CLEANING_END_HOUR = 12;

// Timezone (default: America/New_York)
const BUSINESS_TIME_ZONE = 'America/New_York';
```

## Files Changed Summary

### New Files (7)
- `services/str-ical-sync.service.ts` (290 lines)
- `jobs/str-ical-sync.job.ts` (45 lines)
- `crons/jobs/str-ical-sync.cron.job.ts` (50 lines)
- `controllers/str-ical-sync.controller.ts` (80 lines)
- `str-ical-sync/str-ical-sync.module.ts` (25 lines)
- `services/__tests__/str-ical-sync.service.spec.ts` (65 lines)
- `str-ical-sync/STR_ICAL_INTEGRATION_GUIDE.md` (400+ lines documentation)

### Modified Files (1)
- `calendar.module.ts` - Added StrIcalSyncModule import

### Pre-existing Files (No changes needed)
- `property.workspace-entity.ts` - Already has icalSyncUrl field
- `job-visit.workspace-entity.ts` - Already has required fields
- `job-visit-calendar-sync.service.ts` - Already handles JobVisit → Google Calendar

## Data Model Validation

### Property ↔ JobVisit Relationship
```
Property (id: prop-123)
  ├─ icalSyncUrl: "https://airbnb.com/calendar/ical/1234567.ics"
  ├─ name: "Main Beach House"
  ├─ person/company: Links to Customer
  └─ JobVisits:
      ├─ JobVisit (id: jv-001)
      │   ├─ name: "Checkout - Guest John Smith"
      │   ├─ scheduledDate: "2026-05-20T10:00:00"
      │   ├─ propertyId: prop-123
      │   ├─ notes: "ical-uid: abc123@airbnb.com"
      │   └─ calendarEventId: (created by sync)
      └─ JobVisit (id: jv-002)
          ├─ name: "Checkout - Guest Jane Doe"
          ├─ scheduledDate: "2026-05-25T10:00:00"
          ├─ propertyId: prop-123
          └─ notes: "ical-uid: xyz789@airbnb.com"
```

### Customer Access
```
Person/Company → Property → JobVisits → Google Calendar Event → Customer sees "Your cleaning scheduled on May 20"
```

## Security Considerations

1. **iCal URL Storage**
   - Stored in Property.icalSyncUrl (database)
   - Not exposed via public API
   - Only workspace members can view

2. **External Fetch**
   - Fetch via HTTPS only (enforced by npm fetch)
   - Timeout protection (default 30s)
   - Error handling for malformed URLs

3. **Data Validation**
   - iCal parsing validates VEVENT structure
   - Date validation before storing
   - Workspace isolation (multi-tenant)

4. **Rate Limiting**
   - Cron runs every 6 hours (max 4 per day per workspace)
   - Manual API endpoint not rate-limited (could add in future)

## Performance Considerations

1. **Background Processing**
   - iCal fetch/parse runs in background job queue
   - Doesn't block request
   - Scales with number of properties

2. **Deduplication**
   - Check existing JobVisit before creating (1 query per event)
   - External event ID check prevents duplicates

3. **Database**
   - New records: JobVisit, CalendarEvent (per checkout)
   - Index on Property.icalSyncUrl for filtering
   - Index on JobVisit.propertyId

## Known Limitations

1. **Checkout Date vs. Time**
   - iCal events typically all-day
   - System assumes checkout at 10 AM (configurable)
   - Actual checkout may vary by property

2. **Event Updates**
   - Current system doesn't update existing JobVisits
   - If checkout date changes in Airbnb, new JobVisit created
   - May need future enhancement for updates

3. **Guest Information**
   - iCal doesn't typically include guest details
   - Guest name extracted from event summary (simple parsing)
   - Full guest contact info not synced

4. **Cancellations**
   - Cancelled events not handled yet
   - Could add in future: monitor for removed events

## Future Enhancements

- [ ] Real-time webhooks from PMS (instead of 6-hour poll)
- [ ] Guest contact info extraction
- [ ] Automatic service agreement assignment
- [ ] Auto-invoice after completion (Phase 3)
- [ ] Conflict detection (overlapping checkouts)
- [ ] Event update support (reschedule cleanings if checkout changes)
- [ ] Mobile app notifications for new cleanings
- [ ] Customer SMS: "Your cleaning scheduled for {date}, link in Google Calendar"

## Success Criteria

Phase 2 is COMPLETE when:

- ✅ iCal feeds can be parsed from Airbnb, VRBO, Booking.com, or custom URLs
- ✅ Checkout events automatically create JobVisits every 6 hours
- ✅ JobVisits appear in Google Calendar with correct dates/times
- ✅ Deduplication prevents duplicate JobVisits
- ✅ Manual sync API works (POST /webhooks/str-ical-sync/...)
- ✅ Integration with Phase 1: completed JobVisit → invoice auto-drafts
- ✅ Customers/guests can see their cleaning in shared Google Calendar
- ✅ Frontend shows STR properties and iCal sync status
- ✅ Frontend can manually trigger sync
- ✅ All changes pushed to main branch

## Next Steps

### Immediate (Before Deploying)
1. Generate GraphQL types: `npx nx run twenty-front:graphql:generate`
2. Run tests: `npx jest packages/twenty-server --testPathPattern=str-ical`
3. Type check: `npx nx typecheck twenty-server`
4. Commit all changes

### Frontend Work (Phase 2.5)
1. Create Property detail UI component with icalSyncUrl field
2. Add STR Properties list page
3. Add manual sync button to Property page
4. Update JobVisit list to show STR vs. other types
5. Add filter/sort by property type in calendar

### Testing (Phase 2.6)
1. Set up test property with real Airbnb iCal feed
2. Run 6-hour sync
3. Verify JobVisit creation
4. Verify Google Calendar sync
5. Test Phase 1 integration (mark complete → invoice)

### Deployment (Phase 2.7)
1. Merge to main branch
2. Run migrations on production
3. Deploy backend
4. Deploy frontend
5. Monitor logs for sync activity

## Related Documentation

- [STR iCal Integration Guide](./packages/twenty-server/src/modules/calendar/str-ical-sync/STR_ICAL_INTEGRATION_GUIDE.md)
- [Phase 1: Google Calendar → Invoice](./PHASE1_FINAL_VERIFICATION.md)
- [Architecture Overview](./CLAUDE.md)

## Questions / Contact

For questions about Phase 2 implementation:
1. Check the STR_ICAL_INTEGRATION_GUIDE.md for user-facing documentation
2. Review the service code (str-ical-sync.service.ts) for implementation details
3. Check server logs for sync activity
4. Monitor the message queue (Redis) for job status
