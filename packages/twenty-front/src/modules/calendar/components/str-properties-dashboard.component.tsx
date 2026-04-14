import { useMutation } from '@apollo/client';
import { useCallback, useState } from 'react';

type Property = {
  id: string;
  name: string;
  icalSyncUrl?: string | null;
  person?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
};

type StrPropertiesDashboardProps = {
  properties: Property[];
  workspaceId: string;
  onSyncComplete?: () => void;
};

/**
 * Dashboard for managing STR (Short-Term Rental) properties.
 *
 * Shows:
 * - List of STR properties with iCal feeds
 * - Last sync time
 * - Button to manually trigger sync
 * - Property customer info (person/company)
 *
 * Used on: Calendar → STR Properties page
 */
export const StrPropertiesDashboard = ({
  properties,
  workspaceId,
  onSyncComplete,
}: StrPropertiesDashboardProps) => {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleManualSync = useCallback(
    async (propertyId?: string) => {
      setSyncing(propertyId || 'all');
      setError(null);
      setSuccess(null);

      try {
        const endpoint = propertyId
          ? `/webhooks/str-ical-sync/${workspaceId}/property/${propertyId}`
          : `/webhooks/str-ical-sync/${workspaceId}`;

        const response = await fetch(endpoint, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
          setSuccess(
            propertyId
              ? `Sync started for ${properties.find((p) => p.id === propertyId)?.name}`
              : 'Sync started for all STR properties',
          );
          onSyncComplete?.();

          setTimeout(() => setSuccess(null), 5000);
        } else {
          setError(data.message || 'Sync failed');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to trigger sync',
        );
      } finally {
        setSyncing(null);
      }
    },
    [workspaceId, properties, onSyncComplete],
  );

  const strProperties = properties.filter((p) => p.icalSyncUrl);

  return (
    <div className="rounded border border-gray-300 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">STR Properties</h2>
          <p className="text-sm text-gray-600">
            {strProperties.length} properties with iCal feeds
          </p>
        </div>
        <button
          onClick={() => handleManualSync()}
          disabled={syncing === 'all'}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {syncing === 'all' ? 'Syncing...' : 'Sync All Now'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {strProperties.length === 0 ? (
        <div className="rounded bg-gray-50 p-4 text-center text-sm text-gray-600">
          <p>No STR properties with iCal feeds configured.</p>
          <p className="mt-2 text-xs">
            Add an iCal feed URL to a property to enable automatic sync.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {strProperties.map((property) => (
            <div
              key={property.id}
              className="flex items-center justify-between rounded border border-gray-200 p-3"
            >
              <div className="flex-1">
                <div className="font-medium">{property.name}</div>
                <div className="text-sm text-gray-600">
                  {property.company?.name || property.person?.firstName ? (
                    <>
                      Customer:{' '}
                      {property.company?.name ||
                        `${property.person?.firstName} ${property.person?.lastName}`}
                    </>
                  ) : (
                    'No customer assigned'
                  )}
                </div>
                {property.icalSyncUrl && (
                  <div className="truncate text-xs font-mono text-gray-500">
                    {property.icalSyncUrl}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleManualSync(property.id)}
                disabled={syncing === property.id}
                className="ml-2 rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:opacity-50"
              >
                {syncing === property.id ? 'Syncing...' : 'Sync'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded bg-blue-50 p-3 text-xs text-blue-700">
        <div className="font-semibold">Auto-sync every 6 hours</div>
        <p className="mt-1">
          New checkouts from your iCal feeds are automatically detected and
          added as JobVisits. Synced JobVisits appear in Google Calendar and
          are visible to customers.
        </p>
      </div>
    </div>
  );
};
