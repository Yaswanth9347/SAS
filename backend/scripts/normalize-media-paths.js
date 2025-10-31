#!/usr/bin/env node
/*
 Normalize stored media paths on Visit documents to web-accessible form starting with /uploads/...
 This is safe to run multiple times. Only updates paths that do not already start with /uploads/.

 Usage:
   node scripts/normalize-media-paths.js [--dry-run]
*/

require('dotenv').config();
const mongoose = require('mongoose');
const Visit = require('../models/Visit');

const DRY = process.argv.includes('--dry-run');

function toWebPath(p) {
  if (!p) return p;
  let s = String(p).replace(/\\/g, '/');
  if (s.startsWith('/uploads/')) return s;
  const idx = s.indexOf('/uploads/');
  if (idx !== -1) return s.substring(idx);
  const idx2 = s.indexOf('uploads/');
  if (idx2 !== -1) return '/' + s.substring(idx2);
  return s; // unknown layout, skip
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sas';
  await mongoose.connect(mongoUri, { dbName: process.env.DB_NAME || undefined });
  const summary = { scanned: 0, changed: 0, fields: 0 };

  const cursor = Visit.find({ $or: [
    { 'photos.0': { $exists: true } },
    { 'videos.0': { $exists: true } },
    { 'docs.0': { $exists: true } }
  ] }).cursor();

  for await (const v of cursor) {
    summary.scanned++;
    let changed = false;

    const fixArr = (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map(item => {
        if (item == null) return item;
        if (typeof item === 'string') {
          const np = toWebPath(item);
          if (np !== item) { changed = true; summary.fields++; }
          return np;
        }
        if (typeof item === 'object') {
          const clone = { ...item._doc, ...item };
          const prev = clone.path;
          const np = toWebPath(prev);
          if (np !== prev) { clone.path = np; changed = true; summary.fields++; }
          return clone;
        }
        return item;
      });
    };

    const next = v.toObject();
    next.photos = fixArr(next.photos);
    next.videos = fixArr(next.videos);
    next.docs = fixArr(next.docs);

    if (changed && !DRY) {
      await Visit.updateOne({ _id: v._id }, { $set: {
        photos: next.photos,
        videos: next.videos,
        docs: next.docs
      }});
      summary.changed++;
    } else if (changed) {
      summary.changed++;
    }
  }

  console.log('[normalize-media-paths] summary:', summary);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[normalize-media-paths] error:', err);
  process.exit(1);
});
