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

module.exports = mongoose.model('Team', teamSchema);
