'use strict';

// Parses raw .ics text and returns checkout events for the next N days.
// Uses simple string parsing — no heavy ical library needed for this.

function parseIcalCheckouts(icsText, daysAhead = 60) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const events = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    if (!block) continue;

    const uid = extractField(block, 'UID');
    const summary = extractField(block, 'SUMMARY') || '';
    const dtStart = extractField(block, 'DTSTART');
    const dtEnd = extractField(block, 'DTEND');

    // Skip blocked/unavailable events (Airbnb uses "Not available" for owner blocks)
    const upperSummary = summary.toUpperCase();
    if (
      upperSummary.includes('BLOCKED') ||
      upperSummary.includes('UNAVAILABLE') ||
      upperSummary.includes('NOT AVAILABLE')
    ) {
      continue;
    }

    // DTEND = checkout day (the turnover/cleaning date)
    const checkoutDate = parseIcalDate(dtEnd);
    const checkinDate = parseIcalDate(dtStart);

    if (!checkoutDate) continue;

    // Skip events where checkout is in the past or beyond the window
    if (checkoutDate < now || checkoutDate > cutoff) {
      continue;
    }

    events.push({
      uid: uid || `unknown-${i}`,
      checkoutDate: checkoutDate.toISOString().split('T')[0],
      checkinDate: checkinDate ? checkinDate.toISOString().split('T')[0] : null,
      guestNote: summary.trim(),
    });
  }

  return events;
}

function extractField(block, fieldName) {
  // Handle folded lines (RFC 5545: lines can continue with leading whitespace)
  // Also handle properties with parameters like DTSTART;VALUE=DATE:20240101
  const regex = new RegExp(`^${fieldName}[;:](.*)`, 'm');
  const match = block.match(regex);
  if (!match) return null;

  let value = match[1];

  // If there's a parameter separator, get the value after the last colon
  // e.g. "VALUE=DATE:20240601" -> "20240601"
  if (value.includes(':')) {
    value = value.split(':').pop();
  }

  return value.replace(/\r?\n\s/g, '').trim();
}

function parseIcalDate(raw) {
  if (!raw) return null;

  // Strip any parameters before the value (e.g. VALUE=DATE:20240601)
  let dateStr = raw;
  if (dateStr.includes(':')) {
    dateStr = dateStr.split(':').pop();
  }
  dateStr = dateStr.replace(/\r?\n\s/g, '').trim();

  // Format: YYYYMMDD or YYYYMMDDTHHmmssZ
  if (dateStr.length >= 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    if (dateStr.length >= 15) {
      const hour = dateStr.substring(9, 11);
      const min = dateStr.substring(11, 13);
      const sec = dateStr.substring(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
    }

    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }

  return null;
}

module.exports = { parseIcalCheckouts };
