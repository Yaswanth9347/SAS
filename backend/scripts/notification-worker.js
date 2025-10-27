// Simple notification worker to send reminders (run via cron or pm2)
// Usage: node scripts/notification-worker.js

require('dotenv').config();
const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const Team = require('../models/Team');
const { notifyUsers } = require('../utils/notificationService');

(async function run(){
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sas';
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
          link: '/frontend/visits.html',
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
          link: '/frontend/visit-report.html',
          meta: { visitId: v._id, deadline: new Date(now.getTime() + 24*60*60*1000) },
          emailTemplate: 'reportDeadline'
        });
      }
    } catch(e) { console.warn('Report reminder failed', e.message); }
  }

  await mongoose.disconnect();
  process.exit(0);
})();
