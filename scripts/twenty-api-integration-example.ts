// Twenty CRM API integration for maineclean.co
//
// Drop this into your website's API routes to push form submissions
// into Twenty as Request records.
//
// Your website already has:
//   POST /api/intake/submit  (contact form + quote form)
//   POST /api/booking/submit (booking form)
//
// Add this to those handlers to sync into Twenty CRM.

const TWENTY_API_URL = process.env.TWENTY_API_URL; // e.g. https://your-app.railway.app
const TWENTY_API_KEY = process.env.TWENTY_API_KEY; // from Settings > Accounts > API Keys

type IntakeSubmission = {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  address?: string;
  zip?: string;
  sqft?: number;
  serviceType?: string;
  frequency?: string;
  bathrooms?: number;
  petHair?: boolean;
  condition?: string;
  estimateMin?: number;
  estimateMax?: number;
  source: 'website_form' | 'contact_form';
};

type BookingSubmission = {
  name: string;
  email?: string;
  phone: string;
  address: string;
  zip?: string;
  serviceType: string;
  frequency?: string;
  sqft?: number;
  bathrooms?: number;
  estimateMin?: number;
  estimateMax?: number;
  requestedDate: string;
};

// Map your website's service types to Twenty CRM select values
const SERVICE_TYPE_MAP: Record<string, string> = {
  standard: 'STANDARD',
  deep: 'DEEP',
  'vacation-rental': 'VACATION_RENTAL',
  commercial: 'COMMERCIAL',
};

const FREQUENCY_MAP: Record<string, string> = {
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
  monthly: 'MONTHLY',
  'one-time': 'ONE_TIME',
};

const SOURCE_MAP: Record<string, string> = {
  website_form: 'WEBSITE_FORM',
  contact_form: 'CONTACT_FORM',
  booking: 'BOOKING',
};

async function createRequestInTwenty(
  data: IntakeSubmission | BookingSubmission,
  source: string,
) {
  if (!TWENTY_API_URL || !TWENTY_API_KEY) {
    console.warn('Twenty CRM not configured, skipping sync');
    return null;
  }

  const serviceType =
    'serviceType' in data && data.serviceType
      ? SERVICE_TYPE_MAP[data.serviceType] || data.serviceType
      : null;

  const frequency =
    'frequency' in data && data.frequency
      ? FREQUENCY_MAP[data.frequency] || data.frequency
      : null;

  // Build the Request record using Twenty's REST API
  const requestBody: Record<string, unknown> = {
    name: { firstName: data.name, lastName: '' },
    source: SOURCE_MAP[source] || 'WEBSITE_FORM',
    status: 'NEW',
  };

  if (serviceType) requestBody.serviceType = serviceType;
  if (frequency) requestBody.frequency = frequency;
  if (data.email) {
    requestBody.email = {
      primaryEmail: data.email,
      additionalEmails: null,
    };
  }
  if (data.phone) {
    requestBody.phone = {
      primaryPhoneNumber: data.phone,
      primaryPhoneCountryCode: 'US',
      primaryPhoneCallingCode: '+1',
      additionalPhones: null,
    };
  }
  if (data.address) {
    requestBody.address = {
      addressStreet1: data.address,
      addressPostcode: 'zip' in data ? data.zip : null,
      addressState: 'ME',
      addressCountry: 'US',
    };
  }
  if (data.sqft) requestBody.sqft = data.sqft;
  if (data.bathrooms) requestBody.bathrooms = data.bathrooms;
  if (data.estimateMin) {
    requestBody.estimateMin = {
      amountMicros: data.estimateMin * 1_000_000,
      currencyCode: 'USD',
    };
  }
  if (data.estimateMax) {
    requestBody.estimateMax = {
      amountMicros: data.estimateMax * 1_000_000,
      currencyCode: 'USD',
    };
  }
  if ('notes' in data && data.notes) {
    requestBody.notes = {
      blocknote: null,
      markdown: data.notes,
    };
  }
  if ('requestedDate' in data && data.requestedDate) {
    requestBody.requestedDate = data.requestedDate;
  }

  const response = await fetch(`${TWENTY_API_URL}/rest/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create request in Twenty:', error);
    return null;
  }

  return response.json();
}

// Usage in your existing API routes:
//
// In /api/intake/submit handler:
//   await createRequestInTwenty(body, body.source);
//
// In /api/booking/submit handler:
//   await createRequestInTwenty(body, 'booking');

export {
  createRequestInTwenty,
  type IntakeSubmission,
  type BookingSubmission,
};
