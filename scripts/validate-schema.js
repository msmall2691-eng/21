'use strict';

// Validates that the required Twenty CRM objects and fields exist
// for the iCal sync system.
//
// Usage: node scripts/validate-schema.js
//
// Env vars:
//   TWENTY_API_URL  (default: https://21-production-0bd4.up.railway.app)
//   TWENTY_API_TOKEN

const TWENTY_API_URL = process.env.TWENTY_API_URL || 'https://21-production-0bd4.up.railway.app';
const TWENTY_API_TOKEN = process.env.TWENTY_API_TOKEN;

if (!TWENTY_API_TOKEN) {
  console.error('ERROR: TWENTY_API_TOKEN environment variable is required');
  console.error('Get it from Twenty Settings > Accounts > API Keys');
  process.exit(1);
}

const METADATA_URL = `${TWENTY_API_URL}/metadata`;

async function metadataQuery(query) {
  const response = await fetch(METADATA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Metadata API error (${response.status}): ${await response.text()}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Metadata GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

async function getAllObjects() {
  const data = await metadataQuery(`{
    objects(paging: { first: 100 }) {
      edges {
        node {
          id
          nameSingular
          namePlural
          isCustom
          fields(paging: { first: 200 }) {
            edges {
              node {
                name
                type
                isCustom
              }
            }
          }
        }
      }
    }
  }`);

  return (data.objects?.edges || []).map((e) => ({
    id: e.node.id,
    nameSingular: e.node.nameSingular,
    namePlural: e.node.namePlural,
    isCustom: e.node.isCustom,
    fields: (e.node.fields?.edges || []).map((f) => f.node),
  }));
}

function findObject(objects, name) {
  return objects.find(
    (o) => o.nameSingular.toLowerCase() === name.toLowerCase()
  );
}

function findField(obj, fieldName) {
  return obj.fields.find(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase()
  );
}

async function main() {
  console.log('=== Twenty CRM Schema Validator ===');
  console.log(`API: ${TWENTY_API_URL}`);
  console.log('');

  let objects;
  try {
    objects = await getAllObjects();
  } catch (err) {
    console.error('Failed to fetch metadata:', err.message);
    process.exit(1);
  }

  console.log(`Found ${objects.length} total objects (${objects.filter((o) => o.isCustom).length} custom)\n`);

  let passed = 0;
  let failed = 0;

  function check(label, condition) {
    if (condition) {
      console.log(`  \u2705 ${label}`);
      passed++;
    } else {
      console.log(`  \u274C ${label}`);
      failed++;
    }
    return condition;
  }

  // --- Required objects ---
  console.log('--- Required Objects ---');

  const requiredObjects = [
    'property',
    'quoteRequest',
    'icalFeed',
    'staffMember',
  ];

  const foundObjects = {};

  for (const name of requiredObjects) {
    const obj = findObject(objects, name);
    check(`Object: ${name}`, !!obj);
    if (obj) foundObjects[name] = obj;
  }

  // "visit" or "jobVisit" — either name is fine
  const visitObj = findObject(objects, 'jobVisit') || findObject(objects, 'visit');
  const visitName = visitObj ? visitObj.nameSingular : 'jobVisit/visit';
  check(`Object: jobVisit OR visit (found: ${visitName})`, !!visitObj);
  if (visitObj) foundObjects['visit'] = visitObj;

  // "job" or "serviceAgreement" — either name is fine
  const jobObj = findObject(objects, 'job') || findObject(objects, 'serviceAgreement');
  const jobName = jobObj ? jobObj.nameSingular : 'job/serviceAgreement';
  check(`Object: job OR serviceAgreement (found: ${jobName})`, !!jobObj);
  if (jobObj) foundObjects['job'] = jobObj;

  console.log('');

  // --- Required fields ---
  console.log('--- Required Fields ---');

  const fieldChecks = {
    property: ['name', 'propertyType', 'address'],
    visit: ['status', 'scheduledAt'],
    icalFeed: ['feedUrl', 'platform', 'syncStatus', 'lastSyncedAt'],
  };

  for (const [objName, fields] of Object.entries(fieldChecks)) {
    const obj = foundObjects[objName];
    if (!obj) {
      for (const field of fields) {
        check(`${objName}.${field} (object not found)`, false);
      }
      continue;
    }

    console.log(`  [${obj.nameSingular}]`);
    for (const field of fields) {
      check(`  ${obj.nameSingular}.${field}`, !!findField(obj, field));
    }
  }

  // Check job/serviceAgreement fields
  if (foundObjects['job']) {
    const obj = foundObjects['job'];
    console.log(`  [${obj.nameSingular}]`);
    check(`  ${obj.nameSingular}.jobType`, !!findField(obj, 'jobType'));
    check(`  ${obj.nameSingular}.status`, !!findField(obj, 'status'));
  } else {
    check('  job.jobType (object not found)', false);
    check('  job.status (object not found)', false);
  }

  console.log('');

  // --- Summary ---
  console.log('=== SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('PASSED - All required objects and fields exist.');
  } else {
    console.log('FAILED - Some objects or fields are missing.');
    console.log('');
    console.log('To create missing objects, either:');
    console.log('  1. Run the setup script: bash scripts/setup-maine-clean-data-model.sh');
    console.log('  2. Create them manually in Twenty Settings > Data Model');
    console.log('');
    console.log('Missing "icalFeed" object? You need to create it with fields:');
    console.log('  - feedUrl (TEXT): the .ics URL');
    console.log('  - platform (SELECT): Airbnb, VRBO, Direct, etc.');
    console.log('  - syncStatus (SELECT): SUCCESS, ERROR, PENDING');
    console.log('  - lastSyncedAt (DATE_TIME): last successful sync');
    console.log('  - property (RELATION -> Property): many-to-one');
  }

  // Print all custom objects found for debugging
  console.log('');
  console.log('--- All Custom Objects Found ---');
  for (const obj of objects.filter((o) => o.isCustom)) {
    const fieldNames = obj.fields
      .filter((f) => f.isCustom)
      .map((f) => f.name);
    console.log(`  ${obj.nameSingular} (${obj.namePlural}): ${fieldNames.join(', ') || '(no custom fields)'}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
