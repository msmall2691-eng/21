'use strict';

// Standalone iCal sync server for Maine Clean Co.
// Runs as a separate process from the main Twenty CRM server.
//
// Features:
//   - Cron job: polls iCal feeds every 6 hours
//   - POST /sync/ical: manual trigger (protected by x-sync-secret)
//   - GET /health: health check
//
// Run: node ical-sync-server.js

const http = require('node:http');
const cron = require('node-cron');
const { runIcalSync } = require('./lib/icalSync');

const PORT = process.env.ICAL_SYNC_PORT || 3001;

// --- Simple HTTP server (no Express needed) ---

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'ical-sync' }));
    return;
  }

  // Manual sync trigger
  if (req.method === 'POST' && req.url === '/sync/ical') {
    const secret = req.headers['x-sync-secret'];

    if (!process.env.ICAL_SYNC_SECRET) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ICAL_SYNC_SECRET is not configured' }));
      return;
    }

    if (secret !== process.env.ICAL_SYNC_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing x-sync-secret header' }));
      return;
    }

    console.log('[sync] Manual iCal sync triggered');
    try {
      const result = await runIcalSync();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[sync] iCal sync failed:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// --- Cron: every 6 hours (12am, 6am, 12pm, 6pm) ---

cron.schedule('0 0,6,12,18 * * *', async () => {
  console.log('[ical-cron] Starting scheduled iCal sync...');
  try {
    const result = await runIcalSync();
    console.log('[ical-cron] Complete:', JSON.stringify(result));
  } catch (err) {
    console.error('[ical-cron] Fatal error:', err.message);
  }
});

// --- Start ---

server.listen(PORT, () => {
  console.log(`[ical-sync] Server listening on port ${PORT}`);
  console.log('[ical-sync] Cron scheduled: every 6 hours (0 0,6,12,18 * * *)');
  console.log('[ical-sync] POST /sync/ical — manual trigger');
  console.log('[ical-sync] GET /health — health check');
});
