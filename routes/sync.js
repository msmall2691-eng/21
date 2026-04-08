'use strict';

const { runIcalSync } = require('../lib/icalSync');

// Express-compatible route handler for manual iCal sync trigger.
// Protected by x-sync-secret header.
//
// Usage: POST /sync/ical
// Header: x-sync-secret: <your-secret>

function registerSyncRoutes(app) {
  app.post('/sync/ical', async (req, res) => {
    const secret = req.headers['x-sync-secret'];

    if (!process.env.ICAL_SYNC_SECRET) {
      return res.status(500).json({ error: 'ICAL_SYNC_SECRET is not configured on the server' });
    }

    if (secret !== process.env.ICAL_SYNC_SECRET) {
      return res.status(401).json({ error: 'Invalid or missing x-sync-secret header' });
    }

    console.log('[sync] Manual iCal sync triggered');

    try {
      const result = await runIcalSync();
      return res.status(200).json(result);
    } catch (err) {
      console.error('[sync] iCal sync failed:', err);
      return res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { registerSyncRoutes };
