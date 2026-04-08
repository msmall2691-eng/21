'use strict';

// Validates that the required Twenty CRM objects and fields exist
// for the Maine Clean iCal sync system.
//
// Usage: node scripts/validate-schema.js
//
// Env vars:
//   TWENTY_API_URL   (default: https://21-production-0bd4.up.railway.app)
//   TWENTY_API_TOKEN (required)

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

async function getAllObjectsWithFields() {
  // First get all object IDs
  const objData = await metadataQuery(`{
    objects(paging: { first: 100 }) {
      edges {
        node {
          id
          nameSingular
          namePlural
          isCustom
        }
      }
    }
  }`);

  const objects = (objData.objects?.edges || []).map((e) => e.node);

  // Then get fields for each relevant object by ID
  const target = ['property', 'jobVisit', 'serviceAgreement', 'quoteRequest', 'staffMember'];
  const result = [];

  for (const obj of objects) {
    if (target.includes(obj.nameSingular)) {
      const fieldData = await metadataQuery(`{
        object(id: "${obj.id}") {
          nameSingular
          fields(paging: { first: 100 }) {
            edges {
              node {
                name
                type
              }
            }
          }
        }
      }`);

      result.push({
        ...obj,
        fields: (fieldData.object?.fields?.edges || []).map((e) => e.node),
      });
    } else {
      result.push({ ...obj, fields: [] });
    }
  }

  return result;
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
  console.log('=== Twenty CRM Schema Validator (iCal Sync) ===');
  console.log(`API: ${TWENTY_API_URL}`);
  console.log('');

  let objects;
  try {
    objects = await getAllObjectsWithFields();
  } catch (err) {
    console.error('Failed to fetch metadata:', err.message);
    process.exit(1);
  }

  console.log(`Found ${objects.length} total objects\n`);

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

  const requiredObjects = ['property', 'jobVisit', 'serviceAgreement', 'quoteRequest', 'staffMember'];
  const foundObjects = {};

  for (const name of requiredObjects) {
    const obj = findObject(objects, name);
    check(`Object: ${name}`, !!obj);
    if (obj) foundObjects[name] = obj;
  }

  console.log('');

  // --- Required fields for iCal sync ---
  console.log('--- Required Fields (iCal Sync) ---');

  // property fields needed by the sync
  if (foundObjects.property) {
    console.log('  [property]');
    check('  property.name', !!findField(foundObjects.property, 'name'));
    check('  property.propertyType', !!findField(foundObjects.property, 'propertyType'));
    check('  property.isActive', !!findField(foundObjects.property, 'isActive'));
    check('  property.icalSyncUrl', !!findField(foundObjects.property, 'icalSyncUrl'));
    check('  property.address', !!findField(foundObjects.property, 'address'));
    check('  property.serviceAgreements (relation)', !!findField(foundObjects.property, 'serviceAgreements'));
  } else {
    for (const f of ['name', 'propertyType', 'isActive', 'icalSyncUrl', 'address', 'serviceAgreements']) {
      check(`  property.${f} (object not found)`, false);
    }
  }

  // serviceAgreement fields
  if (foundObjects.serviceAgreement) {
    console.log('  [serviceAgreement]');
    check('  serviceAgreement.serviceType', !!findField(foundObjects.serviceAgreement, 'serviceType'));
    check('  serviceAgreement.isActive', !!findField(foundObjects.serviceAgreement, 'isActive'));
    check('  serviceAgreement.frequency', !!findField(foundObjects.serviceAgreement, 'frequency'));
    check('  serviceAgreement.jobVisits (relation)', !!findField(foundObjects.serviceAgreement, 'jobVisits'));
  } else {
    for (const f of ['serviceType', 'isActive', 'frequency', 'jobVisits']) {
      check(`  serviceAgreement.${f} (object not found)`, false);
    }
  }

  // jobVisit fields
  if (foundObjects.jobVisit) {
    console.log('  [jobVisit]');
    check('  jobVisit.scheduledDate', !!findField(foundObjects.jobVisit, 'scheduledDate'));
    check('  jobVisit.status', !!findField(foundObjects.jobVisit, 'status'));
    check('  jobVisit.notes', !!findField(foundObjects.jobVisit, 'notes'));
    check('  jobVisit.checklistCompleted', !!findField(foundObjects.jobVisit, 'checklistCompleted'));
    check('  jobVisit.serviceAgreement (relation)', !!findField(foundObjects.jobVisit, 'serviceAgreement'));
    check('  jobVisit.property (relation)', !!findField(foundObjects.jobVisit, 'property'));
    check('  jobVisit.staffMember (relation)', !!findField(foundObjects.jobVisit, 'staffMember'));
  } else {
    for (const f of ['scheduledDate', 'status', 'notes', 'checklistCompleted', 'serviceAgreement', 'property', 'staffMember']) {
      check(`  jobVisit.${f} (object not found)`, false);
    }
  }

  console.log('');

  // --- Summary ---
  console.log('=== SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('PASSED - All required objects and fields exist for iCal sync.');
  } else {
    console.log('FAILED - Some objects or fields are missing.');
    console.log('Create missing items in Twenty Settings > Data Model.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
