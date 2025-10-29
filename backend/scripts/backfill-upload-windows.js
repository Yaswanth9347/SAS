#!/usr/bin/env node
/*
 One-off migration: Backfill upload window fields for legacy Visit documents
 - Computes uploadWindowStartUtc (12:00 PM IST on visit date) and uploadWindowEndUtc (+48h)
 - Sets timezone to 'Asia/Kolkata' if missing
 - Sets uploadVisibility to 'public' if missing
 - Optionally sets notification flags to avoid spamming users for old visits

 Usage:
   node scripts/backfill-upload-windows.js [--dry-run]

 Environment:
   MONGODB_URI or MONGO_URI must point to your database. Optional DB_NAME supported.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const Visit = require('../models/Visit');

const DRY_RUN = process.argv.includes('--dry-run');

function computeIstUploadWindow(date) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30, no DST
  const utcMs = new Date(date).getTime();
  const istMs = utcMs + IST_OFFSET_MS;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const midnightIstUtcMs = Date.UTC(y, m, d, 0, 0, 0) - IST_OFFSET_MS;
  const windowStartUtc = new Date(midnightIstUtcMs + 12 * 60 * 60 * 1000); // 12:00 IST in UTC
  const windowEndUtc = new Date(windowStartUtc.getTime() + 48 * 60 * 60 * 1000);
  return { windowStartUtc, windowEndUtc };
}

(async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sas';
  await mongoose.connect(mongoUri, { dbName: process.env.DB_NAME || undefined });

  const now = new Date();
  const summary = { scanned: 0, updated: 0, skipped: 0, errors: 0 };

  console.log(`[backfill] Starting upload-window backfill. dryRun=${DRY_RUN}`);

  try {
    const cursor = Visit.find({ $or: [
      { uploadWindowStartUtc: { $exists: false } },
      { uploadWindowEndUtc: { $exists: false } },
      { uploadWindowStartUtc: null },
      { uploadWindowEndUtc: null }
    ] }).cursor();

    for await (const v of cursor) {
      summary.scanned++;
      try {
        if (!v.date) {
          summary.skipped++;
          continue;
        }
        const { windowStartUtc, windowEndUtc } = computeIstUploadWindow(v.date);

        // Determine notification flags to avoid spamming for old/current windows
        let windowOpenNotified = v.windowOpenNotified;
        let windowClosingNotified = v.windowClosingNotified;
        let windowClosedNotified = v.windowClosedNotified;

        const status = v.status || 'scheduled';
        if (status !== 'scheduled') {
          // Completed or cancelled: suppress all window alerts
          windowOpenNotified = true;
          windowClosingNotified = true;
          windowClosedNotified = true;
        } else if (now >= windowEndUtc) {
          // Already closed: suppress all alerts
          windowOpenNotified = true;
          windowClosingNotified = true;
          windowClosedNotified = true;
        } else if (now >= windowStartUtc && now < windowEndUtc) {
          // Currently open: mark open sent to avoid immediate spam after migration
          if (windowOpenNotified !== true) windowOpenNotified = true;
          // allow closingSoon/closed to be sent later by worker
        } else {
          // Future window: leave flags as-is (likely undefined/false) so worker can notify later
        }

        const update = {
          uploadWindowStartUtc: windowStartUtc,
          uploadWindowEndUtc: windowEndUtc,
          timezone: v.timezone || 'Asia/Kolkata',
          uploadVisibility: v.uploadVisibility || 'public',
          windowOpenNotified,
          windowClosingNotified,
          windowClosedNotified,
        };

        if (DRY_RUN) {
          console.log(`[dry-run] Visit ${v._id} ->`, {
            date: v.date,
            start: windowStartUtc,
            end: windowEndUtc,
            status,
            flags: { windowOpenNotified, windowClosingNotified, windowClosedNotified }
          });
          summary.updated++;
        } else {
          await Visit.updateOne({ _id: v._id }, { $set: update });
          summary.updated++;
        }
      } catch (e) {
        summary.errors++;
        console.warn(`[backfill] Error processing visit ${v._id}:`, e.message);
      }
    }
  } catch (outer) {
    console.error('[backfill] Fatal error:', outer);
  } finally {
    console.log('[backfill] Summary:', summary);
    await mongoose.disconnect();
    process.exit(0);
  }
})();
