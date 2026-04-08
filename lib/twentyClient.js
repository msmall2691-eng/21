'use strict';

// Load .env file from project root if it exists
const fs = require('node:fs');
const pathMod = require('node:path');
const envFile = pathMod.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i)]) process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}

// Twenty CRM GraphQL client for Maine Clean iCal sync.
//
// Actual object/field names from the live Twenty instance:
//   property: propertyType (SELECT), isActive (BOOLEAN), icalSyncUrl (LINKS),
//             serviceAgreements (RELATION), address (ADDRESS)
//   serviceAgreement: serviceType (SELECT), isActive (BOOLEAN), frequency (SELECT),
//                     property (RELATION), jobVisits (RELATION)
//   jobVisit: scheduledDate (DATE_TIME), status (SELECT), notes (TEXT),
//             checklistCompleted (BOOLEAN), serviceAgreement (RELATION),
//             property (RELATION), staffMember (RELATION)

const TWENTY_API_URL = process.env.TWENTY_API_URL || 'https://21-production-0bd4.up.railway.app';
const TWENTY_API_TOKEN = process.env.TWENTY_API_TOKEN;

async function gql(query, variables = {}) {
  if (!TWENTY_API_TOKEN) {
    throw new Error('TWENTY_API_TOKEN is not set');
  }

  const response = await fetch(`${TWENTY_API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twenty API error (${response.status}): ${text}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Twenty GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// Fetches STR properties with their iCal URL and active turnover service agreements.
//
// Schema mapping (actual SELECT values from live instance):
//   - property.propertyType = "STR" for short-term rental properties
//   - property.isActive = true
//   - property.icalSyncUrl (LINKS) = the iCal feed URL stored on the property
//   - property.serviceAgreements -> serviceAgreement with serviceType = "TURNOVER", isActive = true
async function getSTRProperties() {
  const query = `
    query GetSTRProperties {
      properties(
        filter: {
          propertyType: { eq: "STR" }
          isActive: { eq: true }
        }
      ) {
        edges {
          node {
            id
            name
            propertyType
            icalSyncUrl {
              primaryLinkUrl
              primaryLinkLabel
              secondaryLinks
            }
            serviceAgreements(
              filter: {
                serviceType: { eq: "TURNOVER" }
                isActive: { eq: true }
              }
            ) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await gql(query);
  return (data.properties?.edges || []).map((e) => {
    const node = e.node;

    // Extract iCal URLs from the LINKS field.
    // primaryLinkUrl is the main feed; secondaryLinks may have additional feeds.
    const icalUrls = [];
    if (node.icalSyncUrl?.primaryLinkUrl) {
      icalUrls.push({
        url: node.icalSyncUrl.primaryLinkUrl,
        label: node.icalSyncUrl.primaryLinkLabel || 'Primary',
      });
    }
    // secondaryLinks is a JSON array of {url, label} objects
    if (node.icalSyncUrl?.secondaryLinks) {
      try {
        const secondary = typeof node.icalSyncUrl.secondaryLinks === 'string'
          ? JSON.parse(node.icalSyncUrl.secondaryLinks)
          : node.icalSyncUrl.secondaryLinks;
        if (Array.isArray(secondary)) {
          for (const link of secondary) {
            if (link.url) {
              icalUrls.push({ url: link.url, label: link.label || 'Secondary' });
            }
          }
        }
      } catch (_) {
        // ignore parse errors on secondary links
      }
    }

    return {
      id: node.id,
      name: node.name,
      propertyType: node.propertyType,
      icalUrls,
      serviceAgreements: (node.serviceAgreements?.edges || []).map((s) => s.node),
    };
  });
}

// Checks whether a jobVisit already exists for a given serviceAgreement + date.
// Prevents duplicate turnover visits from being created.
//
// Schema: jobVisit.serviceAgreementId, jobVisit.scheduledDate
async function visitExists(serviceAgreementId, checkoutDate) {
  const query = `
    query CheckVisitExists($saId: ID!, $date: DateTime!) {
      jobVisits(
        filter: {
          serviceAgreementId: { eq: $saId }
          scheduledDate: { eq: $date }
        }
      ) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  const data = await gql(query, {
    saId: serviceAgreementId,
    date: `${checkoutDate}T00:00:00.000Z`,
  });

  return (data.jobVisits?.edges || []).length > 0;
}

// Creates a turnover jobVisit linked to a serviceAgreement and property.
//
// Schema fields used:
//   name (TEXT), scheduledDate (DATE_TIME), status (SELECT),
//   checklistCompleted (BOOLEAN), notes (TEXT),
//   serviceAgreementId (RELATION), propertyId (RELATION)
async function createTurnoverVisit({ serviceAgreementId, propertyId, checkoutDate, guestNote, icalUid }) {
  const notes = `Auto-created from iCal. Guest: ${guestNote || 'N/A'}. UID: ${icalUid || 'unknown'}`;

  const query = `
    mutation CreateJobVisit($input: JobVisitCreateInput!) {
      createJobVisit(data: $input) {
        id
        scheduledDate
        status
      }
    }
  `;

  const data = await gql(query, {
    input: {
      name: `Turnover - ${checkoutDate}`,
      scheduledDate: `${checkoutDate}T00:00:00.000Z`,
      status: 'SCHEDULED',
      checklistCompleted: false,
      notes,
      serviceAgreementId,
      propertyId,
    },
  });

  return data.createJobVisit;
}

module.exports = {
  gql,
  getSTRProperties,
  visitExists,
  createTurnoverVisit,
};
