# STR iCal Calendar Components

Frontend React components for managing STR (Short-Term Rental) properties and the Google Calendar integration workflow.

## Components

### StrIcalUrlField
**File:** `str-ical-url-field.component.tsx`

Form field for editing Property iCal feed URLs.

**Usage:**
```tsx
<StrIcalUrlField
  value={property.icalSyncUrl}
  onChange={(url) => setProperty({...property, icalSyncUrl: url})}
  onSave={handleSave}
  isLoading={isLoading}
/>
```

**Features:**
- URL validation (must be HTTPS and end with .ics)
- Example formats for Airbnb, VRBO, Booking.com
- Edit/cancel flow
- Error handling

### StrPropertiesDashboard
**File:** `str-properties-dashboard.component.tsx`

Dashboard showing all STR properties with iCal feeds and manual sync controls.

**Usage:**
```tsx
<StrPropertiesDashboard
  properties={properties}
  workspaceId={workspaceId}
  onSyncComplete={() => refetchJobVisits()}
/>
```

**Features:**
- List of STR properties with iCal URLs
- Manual sync button (all properties or individual)
- Property-to-customer link (person/company)
- Success/error notifications
- Auto-sync info (6 hours)

### JobVisitsListWithTypes
**File:** `job-visits-list-with-types.component.tsx`

JobVisits list organized by property type (STR, Residential, Commercial).

**Usage:**
```tsx
<JobVisitsListWithTypes
  jobVisits={jobVisits}
  showGrouping={true}
/>
```

**Features:**
- Groups by property type with color coding
- Status badges (Scheduled, In Progress, Completed)
- Calendar sync indicator (📅 Synced vs ⏱️ Pending)
- Completion date tracking
- Sorted by scheduled date

### StrWorkflowNav
**File:** `str-workflow-nav.component.tsx`

Navigation menu showing the complete STR workflow steps.

**Usage:**
```tsx
<StrWorkflowNav activeSection="properties" />
```

**Shows:**
1. STR Properties (configure iCal)
2. Schedule (view jobs)
3. Google Calendar
4. Invoices

**Features:**
- Workflow step navigation
- Active section highlighting
- Complete workflow diagram
- Links to relevant pages

## Data Model

### Property
```typescript
{
  id: string;
  name: string;
  icalSyncUrl?: string | null;  // ← iCal feed URL
  propertyType?: 'STR' | 'RESIDENTIAL' | 'COMMERCIAL';
  person?: PersonRef;            // ← Customer
  company?: CompanyRef;          // ← Customer
}
```

### JobVisit
```typescript
{
  id: string;
  name: string;
  scheduledDate: string;
  completedDate: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  property: PropertyRef;         // ← Links to Property
  calendarEvent?: CalendarEventRef;  // ← Google Calendar sync status
}
```

## Integration Points

### With Backend API
- `POST /webhooks/str-ical-sync/{workspaceId}` - Manual sync all
- `POST /webhooks/str-ical-sync/{workspaceId}/property/{propertyId}` - Manual sync one property

### With GraphQL
- `getPropertyByIdQuery` - Fetch property with iCal URL
- `getJobVisitsQuery` - Fetch job visits for display
- `updatePropertyMutation` - Save iCal URL

### With Google Calendar
- Auto-synced JobVisits create calendar events
- Team members see cleanings in their calendar
- Customers see cleanings in shared calendar

## Styling

Components use Tailwind CSS utility classes:
- Blue (`bg-blue-100`, `text-blue-700`) - Primary actions
- Green (`bg-green-100`, `text-green-700`) - Success/synced status
- Yellow (`bg-yellow-100`, `text-yellow-700`) - Scheduled
- Orange (`bg-orange-100`, `text-orange-700`) - Commercial
- Purple (`bg-purple-100`, `text-purple-700`) - STR
- Gray (`bg-gray-100`, `text-gray-700`) - Default/pending

## Examples

### Complete STR Property Setup

```tsx
import { StrIcalUrlField } from './str-ical-url-field.component';
import { StrPropertiesDashboard } from './str-properties-dashboard.component';
import { JobVisitsListWithTypes } from './job-visits-list-with-types.component';
import { StrWorkflowNav } from './str-workflow-nav.component';

export function PropertySettingsPage() {
  const [property, setProperty] = useState(initialProperty);
  const { data: properties } = useQuery(GET_STR_PROPERTIES);
  const { data: jobVisits } = useQuery(GET_JOB_VISITS);
  const [updateProperty] = useMutation(UPDATE_PROPERTY);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <StrIcalUrlField
          value={property.icalSyncUrl}
          onChange={(url) => setProperty({...property, icalSyncUrl: url})}
          onSave={() => updateProperty({variables: {id: property.id, input: property}})}
        />

        <StrPropertiesDashboard
          properties={properties?.properties || []}
          workspaceId={workspaceId}
          onSyncComplete={() => refetchJobVisits()}
        />

        <JobVisitsListWithTypes jobVisits={jobVisits?.jobVisits || []} />
      </div>

      <aside>
        <StrWorkflowNav activeSection="properties" />
      </aside>
    </div>
  );
}
```

### Calendar View with STR Filter

```tsx
<div className="grid grid-cols-3 gap-4">
  <aside>
    <StrWorkflowNav activeSection="calendar" />
  </aside>
  <div className="col-span-2">
    <GoogleCalendarView
      filters={{
        propertyTypes: ['STR', 'RESIDENTIAL', 'COMMERCIAL'],
      }}
    />
  </div>
</div>
```

## Future Enhancements

- [ ] Drag-drop rescheduling on calendar
- [ ] Bulk import iCal URLs from CSV
- [ ] Real-time sync status (WebSocket)
- [ ] Conflict detection (overlapping checkouts)
- [ ] Guest information extraction
- [ ] Customer notifications on calendar
- [ ] Mobile app calendar view

## Related

- **Backend:** `packages/twenty-server/src/modules/calendar/str-ical-sync/`
- **Documentation:** `STR_ICAL_INTEGRATION_GUIDE.md`
- **GraphQL:** `src/modules/calendar/graphql/queries/`
