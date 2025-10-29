// Notification worker to send reminders and upload window alerts (run via cron or pm2)
// Usage: node scripts/notification-worker.js

require('dotenv').config();
const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const Team = require('../models/Team');
const { notifyUsers } = require('../utils/notificationService');

(async function run(){
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sas';
  await mongoose.connect(mongoUri, { dbName: process.env.DB_NAME || undefined });

  const now = new Date();
  const in24h = new Date(now.getTime() + 24*60*60*1000);
  const past48h = new Date(now.getTime() - 48*60*60*1000);

  // Visit reminders in next 24h (status scheduled)
  const upcoming = await Visit.find({ status: 'scheduled', date: { $gte: now, $lte: in24h } }).populate('team');
  for (const v of upcoming) {
    try {
      const team = await Team.findById(v.team).populate('members', '_id');
      const members = (team?.members||[]).map(m=>m._id);
      if (members.length) {
        await notifyUsers(members, {
          title: 'Visit Reminder',
          message: `Reminder: Visit on ${new Date(v.date).toLocaleString()}`,
          type: 'visit',
          link: '/visits.html',
          meta: { visitId: v._id, date: v.date },
          emailTemplate: 'visitReminder'
        });
      }
    } catch(e) { console.warn('Reminder failed', e.message); }
  }

  // Report submission reminder: visits completed in last 48h without report
  const needReport = await Visit.find({ status: 'completed', 'report.submitted': { $ne: true }, updatedAt: { $gte: past48h } }).populate('team');
  for (const v of needReport) {
    try {
      const team = await Team.findById(v.team).populate('members', '_id');
      const members = (team?.members||[]).map(m=>m._id);
      if (members.length) {
        await notifyUsers(members, {
          title: 'Report Submission Reminder',
          message: 'Please submit your visit report.',
          type: 'visit',
          link: '/visit-report.html',
          meta: { visitId: v._id, deadline: new Date(now.getTime() + 24*60*60*1000) },
          emailTemplate: 'reportDeadline'
        });
      }
    } catch(e) { console.warn('Report reminder failed', e.message); }
  }

  // ==============================
  // Upload window notifications
  // ==============================
  // 1) Window open now: notify team when windowStart has passed and not yet notified
  const toOpen = await Visit.find({
    uploadWindowStartUtc: { $lte: now },
    windowOpenNotified: { $ne: true }
  }).select('team date uploadWindowStartUtc').populate('team');
  for (const v of toOpen) {
    try {
      const team = await Team.findById(v.team).populate('members', '_id');
      const members = (team?.members||[]).map(m=>m._id);
      if (members.length) {
        await notifyUsers(members, {
          title: 'Uploads open now',
          message: 'You can now upload visit media (photos/videos).',
          type: 'visit',
          link: '/visit-report.html',
          meta: { visitId: v._id, windowStart: v.uploadWindowStartUtc }
        });
      }
      v.windowOpenNotified = true;
      await v.save();
    } catch(e) { console.warn('Window-open notify failed', e.message); }
  }

  // 2) Window closing soon (1 hour left): notify team once
  const in1h = new Date(now.getTime() + 60*60*1000);
  const closingSoon = await Visit.find({
    uploadWindowEndUtc: { $gt: now, $lte: in1h },
    windowClosingNotified: { $ne: true }
  }).select('team uploadWindowEndUtc').populate('team');
  for (const v of closingSoon) {
    try {
      const team = await Team.findById(v.team).populate('members', '_id');
      const members = (team?.members||[]).map(m=>m._id);
      if (members.length) {
        await notifyUsers(members, {
          title: 'Uploads close in 1 hour',
          message: 'Finish your uploads soon. Upload window closes in ~1 hour.',
          type: 'visit',
          link: '/visit-report.html',
          meta: { visitId: v._id, windowEnd: v.uploadWindowEndUtc }
        });
      }
      v.windowClosingNotified = true;
      await v.save();
    } catch(e) { console.warn('Window-closing notify failed', e.message); }
  }

  // 3) Window closed: notify team once
  const justClosed = await Visit.find({
    uploadWindowEndUtc: { $lte: now },
    windowClosedNotified: { $ne: true }
  }).select('team uploadWindowEndUtc').populate('team');
  for (const v of justClosed) {
    try {
      const team = await Team.findById(v.team).populate('members', '_id');
      const members = (team?.members||[]).map(m=>m._id);
      if (members.length) {
        await notifyUsers(members, {
          title: 'Uploads are now closed',
          message: 'The 48-hour upload window has ended.',
          type: 'visit',
          link: '/visits.html',
          meta: { visitId: v._id, windowEnd: v.uploadWindowEndUtc }
        });
      }
      v.windowClosedNotified = true;
      await v.save();
    } catch(e) { console.warn('Window-closed notify failed', e.message); }
  }

  await mongoose.disconnect();
  process.exit(0);
})();
