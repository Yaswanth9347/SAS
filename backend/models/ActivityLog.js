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

// ============================================
// DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
// ============================================

// Index for actor-based queries (who performed actions)
activityLogSchema.index({ actor: 1, createdAt: -1 });

// Index for user-based queries (actions on a specific user)
activityLogSchema.index({ user: 1, createdAt: -1 });

// Index for action type queries
activityLogSchema.index({ action: 1, createdAt: -1 });

// Index for target-based queries
activityLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Compound index for audit trails (actor + action over time)
activityLogSchema.index({ actor: 1, action: 1, createdAt: -1 });

// Index for date-based queries (recent activity logs)
activityLogSchema.index({ createdAt: -1 });

// TTL index to automatically delete old logs after 90 days (optional)
// Uncomment if you want to auto-delete old activity logs
// activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);