#!/usr/bin/env node
/**
 * Clean up orphaned file references in Visit documents
 * Removes references to files that don't exist on disk
 * 
 * Usage:
 *   node scripts/cleanup-orphaned-files.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

function fileExists(filePath) {
  try {
    // Extract path starting from /uploads/
    let cleanPath = filePath;
    if (cleanPath.startsWith('/uploads/')) {
      cleanPath = cleanPath.substring('/uploads/'.length);
    }
    const fullPath = path.join(UPLOADS_DIR, cleanPath);
    return fs.existsSync(fullPath);
  } catch (error) {
    return false;
  }
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sas';
  await mongoose.connect(mongoUri, { dbName: process.env.DB_NAME || undefined });
  
  const summary = {
    scanned: 0,
    visitsWithOrphans: 0,
    orphanedPhotos: 0,
    orphanedVideos: 0,
    orphanedDocs: 0
  };

  console.log(DRY_RUN ? '🔍 DRY RUN - No changes will be made' : '⚠️  LIVE RUN - Database will be updated');
  console.log('');

  const cursor = Visit.find({
    $or: [
      { 'photos.0': { $exists: true } },
      { 'videos.0': { $exists: true } },
      { 'docs.0': { $exists: true } }
    ]
  }).cursor();

  for await (const visit of cursor) {
    summary.scanned++;
    let hasOrphans = false;

    const filterFiles = (arr, type) => {
      if (!Array.isArray(arr) || arr.length === 0) return { kept: [], removed: [] };
      
      const kept = [];
      const removed = [];
      
      for (const item of arr) {
        let filePath = null;
        
        if (typeof item === 'string') {
          filePath = item;
        } else if (item && typeof item === 'object' && item.path) {
          filePath = item.path;
        }
        
        if (filePath && fileExists(filePath)) {
          kept.push(item);
        } else {
          removed.push(filePath || 'unknown');
          hasOrphans = true;
          summary[`orphaned${type.charAt(0).toUpperCase() + type.slice(1)}`]++;
        }
      }
      
      return { kept, removed };
    };

    const photosResult = filterFiles(visit.photos || [], 'photos');
    const videosResult = filterFiles(visit.videos || [], 'videos');
    const docsResult = filterFiles(visit.docs || [], 'docs');

    if (hasOrphans) {
      summary.visitsWithOrphans++;
      
      console.log(`\n📋 Visit: ${visit.name || visit._id}`);
      console.log(`   Date: ${visit.date}`);
      
      if (photosResult.removed.length > 0) {
        console.log(`   ❌ Orphaned photos (${photosResult.removed.length}):`);
        photosResult.removed.forEach(p => console.log(`      - ${p}`));
      }
      if (videosResult.removed.length > 0) {
        console.log(`   ❌ Orphaned videos (${videosResult.removed.length}):`);
        videosResult.removed.forEach(v => console.log(`      - ${v}`));
      }
      if (docsResult.removed.length > 0) {
        console.log(`   ❌ Orphaned docs (${docsResult.removed.length}):`);
        docsResult.removed.forEach(d => console.log(`      - ${d}`));
      }

      if (!DRY_RUN) {
        await Visit.updateOne(
          { _id: visit._id },
          {
            $set: {
              photos: photosResult.kept,
              videos: videosResult.kept,
              docs: docsResult.kept
            }
          }
        );
        console.log('   ✅ Updated in database');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Visits scanned: ${summary.scanned}`);
  console.log(`Visits with orphaned files: ${summary.visitsWithOrphans}`);
  console.log(`Orphaned photos removed: ${summary.orphanedPhotos}`);
  console.log(`Orphaned videos removed: ${summary.orphanedVideos}`);
  console.log(`Orphaned docs removed: ${summary.orphanedDocs}`);
  console.log(`Total orphaned files: ${summary.orphanedPhotos + summary.orphanedVideos + summary.orphanedDocs}`);
  
  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to actually clean up the database');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
