# Calendar & STR Cleaning Schedule Implementation Guide

## Overview
This guide covers adding Google Calendar integration with STR cleaning schedules to the Twenty CRM navigation and creating a unified calendar/cleaning dashboard.

## Architecture

```
Google Calendar → Calendar Sync → Calendar Events
     ↓
   Twenty DB

Airbnb iCal → iCal Sync (6-hour polling) → Turnover Visits
     ↓
   Twenty DB

Combined View → Calendar + Cleanings Display → Staff Dashboard
```

## Components to Implement

### 1. Calendar in Main Navigation

**File**: `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/constants/standard-command-menu-item.constant.ts`

**Add to STANDARD_COMMAND_MENU_ITEMS**:
```typescript
goToCalendar: {
  universalIdentifier: 'calendar-nav-item-uuid', // Generate new UUID
  label: 'Go to Calendar',
  icon: 'IconCalendarEvent',
  isPinned: true,
  position: 10, // Place near top navigation
  shortLabel: 'Calendar',
  availabilityType: CommandMenuItemAvailabilityType.GLOBAL,
  conditionalAvailabilityExpression: null,
  availabilityObjectMetadataUniversalIdentifier: null,
  frontComponentUniversalIdentifier: null,
  engineComponentKey: EngineComponentKey.NAVIGATION,
  hotKeys: ['G', 'C'], // Keyboard shortcut: G then C
  payload: { path: '/calendar' },
},
```

### 2. Calendar View Component

**File**: `packages/twenty-front/src/modules/calendar/pages/calendar-view/CalendarView.tsx`

Create a new calendar view component that combines:
- Google Calendar events (from `calendarEvent` table)
- STR cleaning visits (from `visit` table where `serviceType = "TURNOVER"`)

```typescript
// Key features:
// - Monthly/Weekly/Daily calendar views
// - Filter by property
// - Color-code events vs cleanings
// - Show guest notes and cleaning staff
// - Drag-to-reschedule cleanings
// - Create new cleanings from calendar
```

### 3. Cleaning Schedule Dashboard

**File**: `packages/twenty-front/src/modules/cleaning-schedule/pages/CleaningScheduleDashboard.tsx`

Display upcoming cleaning jobs with:
- Date and property name
- Guest checkout/checkin dates
- Assigned cleaning staff
- Status (pending, in-progress, completed)
- Quick actions (reschedule, assign staff, mark done)

### 4. Calendar Event + Cleaning Link

**Database**: Link `visit` (turnover jobs) to `calendarEvent` (display dates)

**GraphQL**: Add field to Visit:
```graphql
visit {
  id
  checkoutDate
  property {
    name
    address
  }
  guestNote
  calendarEvent {  # NEW: Link to calendar display
    id
    title
    startsAt
    endsAt
  }
  assignedStaff {
    firstName
    lastName
  }
  status
}
```

## Data Model Reference

### Calendar Event
```
calendarEvent {
  id
  title              # e.g., "Guest Checkout - Property A"
  startsAt           # Date/time
  endsAt
  location           # Property address
  isFullDay          # For all-day cleaning blocks
  description        # Notes
  conferenceLink     # For scheduling calls with staff
}
```

### STR Cleaning Visit (Turnover)
```
visit {
  id
  serviceAgreement   # Link to STR turnover agreement
  property           # Which property being cleaned
  checkoutDate       # When guest checks out (cleaning date)
  checkinDate        # When next guest checks in
  guestNote          # Notes from booking
  assignedStaff      # Who's doing the cleaning
  status             # pending | in-progress | completed
  icalUid            # From Airbnb, prevents duplicates
}
```

## Implementation Steps

### Phase 1: Backend Navigation (1-2 hours)
1. ✅ Add `goToCalendar` to command menu items
2. ✅ Add registration migration (already created)
3. Create GraphQL resolvers for calendar events with cleaning data

### Phase 2: Frontend Calendar View (4-6 hours)
1. Create calendar component combining events + cleanings
2. Implement month/week/day view switcher
3. Add filtering by property
4. Style cleanings vs events differently

### Phase 3: Dashboard (2-3 hours)
1. Create cleaning schedule list view
2. Add bulk actions (assign staff, reschedule)
3. Add status tracking
4. Create notifications for upcoming cleanings

### Phase 4: Integration (1-2 hours)
1. Link visits to calendar events
2. Add calendar widget to property detail page
3. Add sidebar widget showing next 7 days of cleanings

## Testing Checklist

- [ ] Calendar shows Google Calendar events
- [ ] Calendar shows STR cleaning cleanings
- [ ] Cleanings have correct dates from iCal sync
- [ ] Can filter by property
- [ ] Can reschedule cleaning visit
- [ ] Assign staff to cleaning
- [ ] Mark cleaning as complete
- [ ] Email notifications for upcoming cleanings
- [ ] Mobile responsive view

## Current Status

✅ **Email Sync** - Active, syncing Gmail/Outlook calendars every hour
✅ **STR Sync** - Active, polling Airbnb iCal every 6 hours
⏳ **Calendar Navigation** - Ready to implement
⏳ **Calendar View UI** - Needs to be built
⏳ **Cleaning Dashboard** - Needs to be built
⏳ **Integration** - Needs to link components

## Next Actions

1. **Generate UUID** for calendar navigation item
2. **Update** command menu items constant
3. **Create** calendar view component
4. **Create** cleaning dashboard component  
5. **Test** end-to-end workflow
6. **Deploy** to production

## Code References

- Calendar module: `/packages/twenty-server/src/modules/calendar/`
- Message/email sync: `/packages/twenty-server/src/modules/messaging/`
- iCal sync: `/lib/icalSync.js`, `/lib/icalParser.js`
- Frontend navigation: `/packages/twenty-front/src/modules/ui/navigation/`

## Support

For questions about:
- **Email sync**: See `packages/twenty-server/src/modules/messaging/`
- **iCal parsing**: See `/lib/icalParser.js` for event parsing logic
- **Calendar events**: GraphQL queries in `calendarEvent` type
- **Cleanings**: GraphQL queries in `visit` type (filtered by serviceType="TURNOVER")
