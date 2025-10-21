const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: ''
    },
    date: {
        type: Date,
        required: true
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    assignedClass: {
        type: String,
        required: true
    },
    // optional list of individual members (names or ids) who attended
    members: [{
        type: String
    }],
    topicsCovered: [String],
    teachingMethods: [String],
    childrenCount: {
        type: Number,
        required: true
    },
    childrenResponse: {
        type: String,
        enum: ['excellent', 'good', 'average', 'poor'],
        required: false
    },
    challengesFaced: String,
    suggestions: String,
    photos: [String],
    videos: [String],
    docs: [String],
    // total classes planned for the visit and how many were actually visited
    totalClasses: {
        type: Number,
        default: 0
    },
    classesVisited: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    submissionDate: Date,
    feedbackFromSchool: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comments: String,
        submittedBy: String,
        submittedDate: Date,
        contactInfo: {
            name: String,
            position: String,
            phone: String,
            email: String
        }
    }
}, 
{
    timestamps: true
});

// Index for better query performance
visitSchema.index({ date: 1, team: 1 });
visitSchema.index({ school: 1, status: 1 });

module.exports = mongoose.model('Visit', visitSchema);