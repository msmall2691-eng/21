'use strict';

const { parseIcalCheckouts } = require('./icalParser');
const {
  getSTRProperties,
  visitExists,
  createTurnoverVisit,
} = require('./twentyClient');

async function runIcalSync() {
  const summary = {
    startedAt: new Date().toISOString(),
    propertiesChecked: 0,
    feedsProcessed: 0,
    visitsCreated: 0,
    visitsSkipped: 0,
    errors: [],
  };

  let properties;
  try {
    properties = await getSTRProperties();
  } catch (err) {
    summary.errors.push(`Failed to fetch properties: ${err.message}`);
    summary.completedAt = new Date().toISOString();
    return summary;
  }

  summary.propertiesChecked = properties.length;

  for (const property of properties) {
    const icalUrls = property.icalUrls || [];
    const activeAgreement = property.serviceAgreements[0]; // first active STR turnover agreement

    if (!activeAgreement) {
      console.log(`[ical-sync] Property "${property.name}" has no active STR turnover agreement, skipping`);
      continue;
    }

    if (icalUrls.length === 0) {
      console.log(`[ical-sync] Property "${property.name}" has no iCal URL, skipping`);
      continue;
    }

    for (const feed of icalUrls) {
      try {
        summary.feedsProcessed++;
        console.log(`[ical-sync] Fetching iCal (${feed.label}): ${feed.url}`);

        // Fetch the raw .ics file
        const icsResponse = await fetch(feed.url, {
          headers: { 'User-Agent': 'MaineClean-iCal-Sync/1.0' },
          signal: AbortSignal.timeout(15000),
        });

        if (!icsResponse.ok) {
          throw new Error(`HTTP ${icsResponse.status} fetching ${feed.url}`);
        }

        const icsText = await icsResponse.text();
        const checkouts = parseIcalCheckouts(icsText, 60);

        console.log(`[ical-sync] Found ${checkouts.length} upcoming checkouts for "${property.name}" (${feed.label})`);

        for (const checkout of checkouts) {
          try {
            const exists = await visitExists(activeAgreement.id, checkout.checkoutDate);

            if (exists) {
              summary.visitsSkipped++;
              continue;
            }

            await createTurnoverVisit({
              serviceAgreementId: activeAgreement.id,
              propertyId: property.id,
              checkoutDate: checkout.checkoutDate,
              guestNote: checkout.guestNote,
              icalUid: checkout.uid,
            });

            summary.visitsCreated++;
            console.log(`[ical-sync] Created visit: ${checkout.checkoutDate} for "${property.name}"`);
          } catch (visitErr) {
            summary.errors.push(
              `Visit creation failed for ${property.name} on ${checkout.checkoutDate}: ${visitErr.message}`
            );
          }
        }
      } catch (feedErr) {
        summary.errors.push(
          `Feed error for ${property.name} (${feed.label}): ${feedErr.message}`
        );
      }
    }
  }

  summary.completedAt = new Date().toISOString();
  return summary;
}

module.exports = { runIcalSync };
