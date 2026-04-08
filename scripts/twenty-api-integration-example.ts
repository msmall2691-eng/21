// Twenty CRM API integration for maineclean.co
//
// Syncs form submissions into Twenty CRM as Quote Request records.
//
// Your website already has:
//   POST /api/intake/submit  (contact form + quote form)
//   POST /api/booking/submit (booking form)
//
// Add these env vars to your website:
//   TWENTY_API_URL=https://21-production-0bd4.up.railway.app
//   TWENTY_API_KEY=<your-api-key>
//
// Then call createQuoteRequestInTwenty() from those handlers.

const TWENTY_API_URL = process.env.TWENTY_API_URL;
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;

// Maps website form values -> Twenty CRM SELECT values
const SERVICE_TYPE_MAP: Record<string, string> = {
  standard: 'STANDARD',
  deep: 'DEEP',
  'vacation-rental': 'TURNOVER',
  commercial: 'STANDARD',
};

const FREQUENCY_MAP: Record<string, string> = {
  weekly: 'WEEKLY',
  biweekly: 'BIWEEKLY',
  monthly: 'MONTHLY',
  'one-time': 'ONE_TIME',
};

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

// Step 1: Create or find a Person in Twenty (the contact)
async function findOrCreatePerson(data: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<string | null> {
  if (!TWENTY_API_URL || !TWENTY_API_KEY) return null;

  const nameParts = data.name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const personBody: Record<string, unknown> = {
    name: { firstName, lastName },
  };

  if (data.email) {
    personBody.emails = {
      primaryEmail: data.email,
      additionalEmails: null,
    };
  }
  if (data.phone) {
    personBody.phones = {
      primaryPhoneNumber: data.phone,
      primaryPhoneCountryCode: 'US',
      primaryPhoneCallingCode: '+1',
      additionalPhones: null,
    };
  }

  const response = await fetch(`${TWENTY_API_URL}/rest/people`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify(personBody),
  });

  if (!response.ok) {
    console.error('Failed to create person:', await response.text());
    return null;
  }

  const result = await response.json();
  // REST API returns { data: { createPerson: { id, ... } } }
  const createKey = Object.keys(result.data || {})[0];
  return result.data?.[createKey]?.id || null;
}

// Step 2: Create a Quote Request linked to the Person
async function createQuoteRequest(
  data: IntakeSubmission | BookingSubmission,
  personId: string | null,
): Promise<string | null> {
  if (!TWENTY_API_URL || !TWENTY_API_KEY) return null;

  const serviceType =
    'serviceType' in data && data.serviceType
      ? SERVICE_TYPE_MAP[data.serviceType] || data.serviceType.toUpperCase()
      : null;

  const frequency =
    'frequency' in data && data.frequency
      ? FREQUENCY_MAP[data.frequency] || data.frequency.toUpperCase()
      : null;

  const body: Record<string, unknown> = {
    name: `${data.name} - Web Request`,
    stage: 'NEW',
    requestDate: new Date().toISOString(),
  };

  if (serviceType) body.serviceType = serviceType;
  if (frequency) body.frequency = frequency;
  if (personId) body.personId = personId;

  if (data.estimateMin || data.estimateMax) {
    const avg = data.estimateMin && data.estimateMax
      ? Math.round((data.estimateMin + data.estimateMax) / 2)
      : data.estimateMin || data.estimateMax;
    body.estimatedPrice = {
      amountMicros: (avg || 0) * 1_000_000,
      currencyCode: 'USD',
    };
  }

  if ('requestedDate' in data && data.requestedDate) {
    body.desiredStartDate = data.requestedDate;
  }

  const notes: string[] = [];
  if ('notes' in data && data.notes) notes.push(data.notes);
  if ('address' in data && data.address) notes.push(`Address: ${data.address}`);
  if ('zip' in data && data.zip) notes.push(`Zip: ${data.zip}`);
  if (data.sqft) notes.push(`Sqft: ${data.sqft}`);
  if (data.bathrooms) notes.push(`Bathrooms: ${data.bathrooms}`);
  if ('petHair' in data && data.petHair) notes.push('Has pets');
  if ('condition' in data && data.condition) notes.push(`Condition: ${data.condition}`);
  if ('source' in data) notes.push(`Source: ${data.source}`);
  if (notes.length > 0) body.notes = notes.join('\n');

  const response = await fetch(`${TWENTY_API_URL}/rest/quoteRequests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('Failed to create quote request:', await response.text());
    return null;
  }

  const result = await response.json();
  // REST API returns { data: { createQuoteRequest: { id, ... } } }
  const createKey = Object.keys(result.data || {})[0];
  return result.data?.[createKey]?.id || null;
}

// Main function: call this from your API routes
async function createQuoteRequestInTwenty(
  data: IntakeSubmission | BookingSubmission,
): Promise<{ personId: string | null; quoteRequestId: string | null }> {
  if (!TWENTY_API_URL || !TWENTY_API_KEY) {
    console.warn('Twenty CRM not configured (missing TWENTY_API_URL or TWENTY_API_KEY)');
    return { personId: null, quoteRequestId: null };
  }

  try {
    const personId = await findOrCreatePerson({
      name: data.name,
      email: data.email,
      phone: data.phone,
    });

    const quoteRequestId = await createQuoteRequest(data, personId);

    console.log('Twenty CRM sync:', { personId, quoteRequestId });
    return { personId, quoteRequestId };
  } catch (error) {
    console.error('Twenty CRM sync failed:', error);
    return { personId: null, quoteRequestId: null };
  }
}

// Usage in your existing API routes:
//
// In /api/intake/submit handler, add:
//   await createQuoteRequestInTwenty(body);
//
// In /api/booking/submit handler, add:
//   await createQuoteRequestInTwenty(body);

export {
  createQuoteRequestInTwenty,
  type IntakeSubmission,
  type BookingSubmission,
};
