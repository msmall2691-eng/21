import { useCallback, useState } from 'react';
import { StrIcalUrlField } from '@/calendar/components/str-ical-url-field.component';

type Property = {
  id: string;
  name: string;
  propertyType?: string | null;
  icalSyncUrl?: {
    primaryLinkUrl?: string | null;
    primaryLinkLabel?: string | null;
    secondaryLinks?: Array<{ url?: string | null; label?: string | null }> | null;
  } | null;
  person?: {
    id: string;
    name?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  company?: {
    id: string;
    name: string;
  } | null;
};

type StrPropertiesDashboardProps = {
  properties?: Property[];
  workspaceId?: string;
  onUpdatePropertyIcalUrl?: (
    propertyId: string,
    icalUrl: string | null,
  ) => Promise<void>;
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
  properties = [],
  workspaceId = '',
  onUpdatePropertyIcalUrl,
  onSyncComplete,
}: StrPropertiesDashboardProps) => {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);
  const [draftIcalByPropertyId, setDraftIcalByPropertyId] = useState<
    Record<string, string | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleManualSync = useCallback(
    async (propertyId?: string) => {
      setSyncing(propertyId || 'all');
      setError(null);
      setSuccess(null);

      try {
        if (!workspaceId) {
          throw new Error(
            'Workspace ID is required before triggering STR iCal sync.',
          );
        }

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

  const handleSaveIcalUrl = useCallback(
    async (propertyId: string, icalUrl: string | null) => {
      if (!onUpdatePropertyIcalUrl) {
        return;
      }

      setSavingPropertyId(propertyId);
      setError(null);
      setSuccess(null);

      try {
        await onUpdatePropertyIcalUrl(propertyId, icalUrl);
        setSuccess('iCal URL updated successfully');
        onSyncComplete?.();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update iCal URL');
      } finally {
        setSavingPropertyId(null);
      }
    },
    [onSyncComplete, onUpdatePropertyIcalUrl],
  );

  const strProperties = properties.filter((property) => {
    if (property.propertyType?.toUpperCase() === 'STR') {
      return true;
    }

    return Boolean(property.icalSyncUrl?.primaryLinkUrl);
  });

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
                  {property.company?.name || property.person?.name?.firstName ? (
                    <>
                      Customer:{' '}
                      {property.company?.name ||
                        `${property.person?.name?.firstName ?? ''} ${property.person?.name?.lastName ?? ''}`.trim()}
                    </>
                  ) : (
                    'No customer assigned'
                  )}
                </div>

                <div className="mt-3">
                  <StrIcalUrlField
                    value={
                      draftIcalByPropertyId[property.id] ??
                      property.icalSyncUrl?.primaryLinkUrl ??
                      null
                    }
                    onChange={(nextValue) => {
                      setDraftIcalByPropertyId((currentDrafts) => ({
                        ...currentDrafts,
                        [property.id]: nextValue,
                      }));
                    }}
                    onSave={async () => {
                      await handleSaveIcalUrl(
                        property.id,
                        draftIcalByPropertyId[property.id] ??
                          property.icalSyncUrl?.primaryLinkUrl ??
                          null,
                      );
                    }}
                    isLoading={savingPropertyId === property.id}
                  />
                </div>
              </div>
              <button
                onClick={() => handleManualSync(property.id)}
                disabled={syncing === property.id || savingPropertyId === property.id}
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
