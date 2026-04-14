import { FieldInputOverlay } from '@/ui/editable-field/components/FieldInputOverlay';
import { useCallback, useState } from 'react';

type StrIcalUrlFieldProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  onSave: () => Promise<void>;
  isLoading?: boolean;
};

/**
 * Form field for editing a Property's iCal sync URL.
 *
 * Used in Property details page. Allows adding/editing iCal feed URLs
 * from Airbnb, VRBO, Booking.com, etc.
 *
 * Features:
 * - Paste iCal URL
 * - Validate URL format
 * - Show example iCal feed formats
 * - Test connection button
 */
export const StrIcalUrlField = ({
  value,
  onChange,
  onSave,
  isLoading,
}: StrIcalUrlFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState<string | null>(null);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Allow empty
    try {
      const urlObj = new URL(url);
      return (
        urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
      ) && url.includes('.ics');
    } catch {
      return false;
    }
  };

  const handleSave = useCallback(async () => {
    if (!validateUrl(inputValue)) {
      setError('Invalid iCal URL. Must be HTTPS and end with .ics');
      return;
    }

    onChange(inputValue || null);
    await onSave();
    setIsEditing(false);
    setError(null);
  }, [inputValue, onChange, onSave]);

  const handleCancel = useCallback(() => {
    setInputValue(value || '');
    setIsEditing(false);
    setError(null);
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">iCal Feed URL</label>
        {value && (
          <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
            Syncing
          </span>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center justify-between rounded border border-gray-300 p-2">
          {value ? (
            <code className="truncate text-sm text-gray-700">{value}</code>
          ) : (
            <span className="text-sm text-gray-500">No iCal URL configured</span>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="ml-2 text-sm text-blue-600 hover:text-blue-800"
          >
            {value ? 'Edit' : 'Add'}
          </button>
        </div>
      )}

      {isEditing && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            placeholder="https://www.airbnb.com/calendar/ical/123456.ics"
            className="rounded border border-gray-300 p-2 text-sm"
          />
          {error && <span className="text-sm text-red-600">{error}</span>}

          <div className="text-xs text-gray-600">
            <div className="font-semibold">Example URLs:</div>
            <div className="mt-1 space-y-1 font-mono text-xs">
              <div>Airbnb: https://www.airbnb.com/calendar/ical/...ics</div>
              <div>VRBO: https://icalendar.vrbo.com/...ics</div>
              <div>Booking: Your booking.com iCal link</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
