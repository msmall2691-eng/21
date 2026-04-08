'use strict';

const TWENTY_API_URL = process.env.TWENTY_API_URL || 'https://21-production-0bd4.up.railway.app';
const TWENTY_API_TOKEN = process.env.TWENTY_API_TOKEN;

async function gql(query, variables = {}) {
  if (!TWENTY_API_TOKEN) {
    throw new Error('TWENTY_API_TOKEN is not set');
  }

  const response = await fetch(`${TWENTY_API_URL}/api`, {
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

// Fetches STR properties with their iCal feeds and active turnover jobs.
// Adapts to the actual object names in the Twenty instance.
// The setup script creates "Property", "Job", "Visit" objects.
// The spec references "icalFeed" — we try that name.
// Property type might be "VACATION_RENTAL" (from setup script) rather than "short_term_rental".
async function getSTRProperties() {
  // Try fetching properties with icalFeeds relation first.
  // If icalFeeds doesn't exist as a relation, fall back to properties only.
  const query = `
    query GetSTRProperties {
      properties(
        filter: {
          propertyType: { eq: "VACATION_RENTAL" }
        }
      ) {
        edges {
          node {
            id
            name
            propertyType
            icalFeeds {
              edges {
                node {
                  id
                  feedUrl
                  platform
                  lastSyncedAt
                }
              }
            }
            jobs(
              filter: {
                jobType: { eq: "STR_TURNOVER" }
                status: { eq: "ACTIVE" }
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

  try {
    const data = await gql(query);
    return (data.properties?.edges || []).map((e) => ({
      id: e.node.id,
      name: e.node.name,
      propertyType: e.node.propertyType,
      icalFeeds: (e.node.icalFeeds?.edges || []).map((f) => f.node),
      jobs: (e.node.jobs?.edges || []).map((j) => j.node),
    }));
  } catch (err) {
    // If the query fails (e.g. icalFeeds relation doesn't exist),
    // try a simpler query without the icalFeeds relation
    console.warn('[twentyClient] Full query failed, trying without icalFeeds:', err.message);
    return getSTRPropertiesSimple();
  }
}

async function getSTRPropertiesSimple() {
  const query = `
    query GetSTRPropertiesSimple {
      properties(
        filter: {
          propertyType: { eq: "VACATION_RENTAL" }
        }
      ) {
        edges {
          node {
            id
            name
            propertyType
            jobs(
              filter: {
                jobType: { eq: "STR_TURNOVER" }
                status: { eq: "ACTIVE" }
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
  return (data.properties?.edges || []).map((e) => ({
    id: e.node.id,
    name: e.node.name,
    propertyType: e.node.propertyType,
    icalFeeds: [],
    jobs: (e.node.jobs?.edges || []).map((j) => j.node),
  }));
}

// Checks whether a visit already exists for a given job + date to prevent duplicates.
// The setup script creates a "Visit" object (not "jobVisit").
async function visitExists(jobId, checkoutDate) {
  const query = `
    query CheckVisitExists($jobId: ID!, $date: DateTime!) {
      visits(
        filter: {
          jobId: { eq: $jobId }
          scheduledAt: { eq: $date }
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
    jobId,
    date: `${checkoutDate}T00:00:00.000Z`,
  });

  return (data.visits?.edges || []).length > 0;
}

// Creates a turnover visit linked to a job.
// Uses the "Visit" object from the setup script with fields:
//   scheduledAt (DATE_TIME), status (SELECT), crew (TEXT),
//   notes (RICH_TEXT), calendarEventId (TEXT), job (RELATION)
async function createTurnoverVisit({ jobId, checkoutDate, guestNote, icalUid }) {
  const internalNotes = `Auto-created from iCal. Guest: ${guestNote || 'N/A'}. UID: ${icalUid || 'unknown'}`;

  const query = `
    mutation CreateVisit($input: VisitCreateInput!) {
      createVisit(data: $input) {
        id
        scheduledAt
        status
      }
    }
  `;

  const data = await gql(query, {
    input: {
      name: `Turnover - ${checkoutDate}`,
      scheduledAt: `${checkoutDate}T00:00:00.000Z`,
      status: 'SCHEDULED',
      notes: { blocknote: internalNotes },
      calendarEventId: icalUid || '',
      jobId,
    },
  });

  return data.createVisit;
}

// Updates the last sync time on an iCal feed record.
// Only works if the icalFeed object exists in Twenty.
async function updateFeedSyncTime(feedId, status) {
  const query = `
    mutation UpdateIcalFeed($id: ID!, $input: IcalFeedUpdateInput!) {
      updateIcalFeed(id: $id, data: $input) {
        id
        lastSyncedAt
        syncStatus
      }
    }
  `;

  const data = await gql(query, {
    id: feedId,
    input: {
      lastSyncedAt: new Date().toISOString(),
      syncStatus: status,
    },
  });

  return data.updateIcalFeed;
}

module.exports = {
  gql,
  getSTRProperties,
  visitExists,
  createTurnoverVisit,
  updateFeedSyncTime,
};
