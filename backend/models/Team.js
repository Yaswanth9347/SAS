const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    teamLeader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    departmentDistribution: {
        type: Map,
        of: Number
    },
    yearDistribution: {
        type: Map,
        of: Number
    },
    assignedSchool: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// ============================================
// DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
// ============================================

// Index for team name - must be unique
teamSchema.index({ name: 1 }, { unique: true });

// Index for team leader queries
teamSchema.index({ teamLeader: 1 });

// Index for active teams
teamSchema.index({ isActive: 1 });

// Compound index for active teams sorted by name
teamSchema.index({ isActive: 1, name: 1 });

// Index for school assignments
teamSchema.index({ assignedSchool: 1 });

// Compound index for teams by school and status
teamSchema.index({ assignedSchool: 1, isActive: 1 });

// Index for members array (finding which team a user belongs to)
teamSchema.index({ members: 1 });

// Text index for search functionality
teamSchema.index({ name: 'text' });

module.exports = mongoose.model('Team', teamSchema);