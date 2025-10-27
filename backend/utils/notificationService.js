const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendVisitScheduledEmail, sendVisitReminderEmail, sendReportDeadlineEmail, sendTeamAssignmentEmail } = require('./emailService');

async function shouldEmail(userId) {
  const user = await User.findById(userId).select('userPreferences email name');
  if (!user) return false;
  const enabled = user.userPreferences?.notifications?.email !== false; // default true
  return { enabled, user };
}

exports.notifyUser = async (userId, { title, message, type = 'system', link, meta, emailTemplate }) => {
  const doc = await Notification.create({ user: userId, title, message, type, link, meta });
  // Optionally send email
  if (emailTemplate) {
    try {
      const { enabled, user } = await shouldEmail(userId);
      if (enabled) {
        if (emailTemplate === 'visitScheduled') await sendVisitScheduledEmail(user, meta);
        if (emailTemplate === 'visitReminder') await sendVisitReminderEmail(user, meta);
        if (emailTemplate === 'reportDeadline') await sendReportDeadlineEmail(user, meta);
        if (emailTemplate === 'teamAssignment') await sendTeamAssignmentEmail(user, meta);
      }
    } catch (e) { console.warn('Email notify failed:', e.message); }
  }
  return doc;
};

exports.notifyUsers = async (userIds, payload) => {
  return Promise.all(userIds.map(uid => this.notifyUser(uid, payload)));
};
