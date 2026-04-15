import { useMemo } from 'react';

type JobVisit = {
  id: string;
  name: string;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  property: {
    id: string;
    name: string;
    propertyType?: string | null; // e.g., "STR", "Residential", "Commercial"
  } | null;
  calendarEvent: {
    id: string;
    title: string;
  } | null;
};

type JobVisitsListProps = {
  jobVisits?: JobVisit[];
  showGrouping?: boolean;
};

const PROPERTY_TYPES = {
  STR: { label: 'Short-Term Rental', color: 'bg-purple-100', textColor: 'text-purple-700' },
  RESIDENTIAL: { label: 'Residential', color: 'bg-blue-100', textColor: 'text-blue-700' },
  COMMERCIAL: { label: 'Commercial', color: 'bg-orange-100', textColor: 'text-orange-700' },
  OTHER: { label: 'Other', color: 'bg-gray-100', textColor: 'text-gray-700' },
};

/**
 * JobVisits list with property type grouping and styling.
 *
 * Organizes job visits by:
 * - Property type (STR, Residential, Commercial)
 * - Status (Scheduled, In Progress, Completed)
 * - Date order (earliest first)
 *
 * Shows:
 * - Property name and type
 * - Scheduled date
 * - Customer info (from property link)
 * - Calendar sync status
 */
export const JobVisitsListWithTypes = ({
  jobVisits = [],
  showGrouping = true,
}: JobVisitsListProps) => {
  const groupedVisits = useMemo(() => {
    if (!showGrouping) {
      return {
        STR: jobVisits.filter((jv) => jv.property?.propertyType === 'STR'),
        RESIDENTIAL: jobVisits.filter(
          (jv) => jv.property?.propertyType === 'RESIDENTIAL',
        ),
        COMMERCIAL: jobVisits.filter(
          (jv) => jv.property?.propertyType === 'COMMERCIAL',
        ),
        OTHER: jobVisits.filter(
          (jv) =>
            !jv.property?.propertyType ||
            !['STR', 'RESIDENTIAL', 'COMMERCIAL'].includes(
              jv.property.propertyType,
            ),
        ),
      };
    }

    return {
      STR: jobVisits.filter((jv) => jv.property?.propertyType === 'STR'),
      RESIDENTIAL: jobVisits.filter(
        (jv) => jv.property?.propertyType === 'RESIDENTIAL',
      ),
      COMMERCIAL: jobVisits.filter(
        (jv) => jv.property?.propertyType === 'COMMERCIAL',
      ),
      OTHER: jobVisits.filter(
        (jv) =>
          !jv.property?.propertyType ||
          !['STR', 'RESIDENTIAL', 'COMMERCIAL'].includes(
            jv.property.propertyType,
          ),
      ),
    };
  }, [jobVisits, showGrouping]);

  const getPropertyTypeInfo = (type?: string | null) => {
    if (!type) return PROPERTY_TYPES.OTHER;
    return PROPERTY_TYPES[type as keyof typeof PROPERTY_TYPES] || PROPERTY_TYPES.OTHER;
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SCHEDULED':
        return 'bg-yellow-100 text-yellow-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const renderGroup = (type: 'STR' | 'RESIDENTIAL' | 'COMMERCIAL' | 'OTHER', visits: JobVisit[]) => {
    if (visits.length === 0) return null;

    const typeInfo = getPropertyTypeInfo(type);

    return (
      <div key={type} className="mb-6">
        <div className={`mb-3 flex items-center gap-2 rounded-t ${typeInfo.color} p-3`}>
          <div className={`text-sm font-semibold ${typeInfo.textColor}`}>
            {PROPERTY_TYPES[type].label}
          </div>
          <span className="ml-auto text-xs text-gray-600">{visits.length} visits</span>
        </div>

        <div className="space-y-2">
          {visits
            .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
            .map((visit) => (
              <div
                key={visit.id}
                className="flex items-start justify-between rounded border border-gray-200 p-3 hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium">{visit.name}</div>
                  <div className="text-sm text-gray-600">
                    Property: {visit.property?.name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Scheduled: {new Date(visit.scheduledDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {visit.completedDate && (
                    <div className="text-xs text-gray-500">
                      Completed: {new Date(visit.completedDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex flex-col items-end gap-1">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${getStatusBadge(visit.status)}`}>
                    {visit.status?.replace('_', ' ') || 'Unknown'}
                  </span>
                  {visit.calendarEvent && (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                      📅 Synced
                    </span>
                  )}
                  {!visit.calendarEvent && (
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      ⏱️ Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  const hasVisits = jobVisits.length > 0;

  return (
    <div className="rounded border border-gray-300 bg-white p-4">
      <h2 className="mb-4 text-lg font-semibold">Job Visits</h2>

      {!hasVisits ? (
        <div className="rounded bg-gray-50 p-4 text-center text-sm text-gray-600">
          <p>No job visits scheduled.</p>
        </div>
      ) : (
        <div>
          {renderGroup('STR', groupedVisits.STR)}
          {renderGroup('RESIDENTIAL', groupedVisits.RESIDENTIAL)}
          {renderGroup('COMMERCIAL', groupedVisits.COMMERCIAL)}
          {renderGroup('OTHER', groupedVisits.OTHER)}

          <div className="mt-4 rounded bg-blue-50 p-3 text-xs text-blue-700">
            <div className="font-semibold">Legend</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>📅 Synced = Google Calendar event created</div>
              <div>⏱️ Pending = Awaiting calendar sync</div>
              <div>✅ Completed = Job finished, invoice eligible</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
