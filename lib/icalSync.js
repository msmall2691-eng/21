'use strict';

const { parseIcalCheckouts } = require('./icalParser');
const {
  getSTRProperties,
  visitExists,
  createTurnoverVisit,
  updateFeedSyncTime,
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
    const feeds = property.icalFeeds || [];
    const activeJob = property.jobs[0]; // first active STR turnover job

    if (!activeJob) {
      console.log(`[ical-sync] Property "${property.name}" has no active STR turnover job, skipping`);
      continue;
    }

    if (feeds.length === 0) {
      console.log(`[ical-sync] Property "${property.name}" has no iCal feeds, skipping`);
      continue;
    }

    for (const feed of feeds) {
      try {
        summary.feedsProcessed++;
        console.log(`[ical-sync] Fetching feed ${feed.platform || 'unknown'}: ${feed.feedUrl}`);

        // Fetch the raw .ics file
        const icsResponse = await fetch(feed.feedUrl, {
          headers: { 'User-Agent': 'MaineClean-iCal-Sync/1.0' },
          signal: AbortSignal.timeout(15000),
        });

        if (!icsResponse.ok) {
          throw new Error(`HTTP ${icsResponse.status} fetching ${feed.feedUrl}`);
        }

        const icsText = await icsResponse.text();
        const checkouts = parseIcalCheckouts(icsText, 60);

        console.log(`[ical-sync] Found ${checkouts.length} upcoming checkouts for "${property.name}" (${feed.platform || 'feed'})`);

        for (const checkout of checkouts) {
          try {
            const exists = await visitExists(activeJob.id, checkout.checkoutDate);

            if (exists) {
              summary.visitsSkipped++;
              continue;
            }

            await createTurnoverVisit({
              jobId: activeJob.id,
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

        // Update feed sync timestamp
        try {
          await updateFeedSyncTime(feed.id, 'SUCCESS');
        } catch (syncErr) {
          // Non-fatal — the icalFeed object might not exist yet
          console.warn(`[ical-sync] Could not update feed sync time: ${syncErr.message}`);
        }
      } catch (feedErr) {
        summary.errors.push(
          `Feed error for ${property.name} (${feed.platform || feed.feedUrl}): ${feedErr.message}`
        );

        // Try to mark the feed as failed
        try {
          await updateFeedSyncTime(feed.id, 'ERROR');
        } catch (_) {
          // ignore
        }
      }
    }
  }

  summary.completedAt = new Date().toISOString();
  return summary;
}

module.exports = { runIcalSync };
