const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who performed the action
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // target user (optional)
  action: { type: String, required: true }, // e.g., 'user.approve', 'user.reject', 'user.role.change'
  targetType: { type: String }, // e.g., 'User', 'Team', 'Visit'
  targetId: { type: mongoose.Schema.Types.ObjectId },
  metadata: { type: Object }, // arbitrary details
  ip: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
