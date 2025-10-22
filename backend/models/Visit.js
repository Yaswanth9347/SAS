const mongoose = require('mongoose');

// ============================================
// HYBRID STORAGE APPROACH - FILE METADATA SCHEMA
// Stores file information in MongoDB while 
// actual media files stored in File System
// Ready for Cloud Storage migration
// ============================================

const fileMetadataSchema = new mongoose.Schema({
    filename: { 
        type: String, 
        required: true 
    },
    originalName: { 
        type: String, 
        required: true 
    },
    path: { 
        type: String, 
        required: true 
    },
    size: { 
        type: Number, 
        required: true 
    },
    mimetype: { 
        type: String, 
        required: true 
    },
    uploadedAt: { 
        type: Date, 
        default: Date.now 
    },
    storageType: { 
        type: String, 
        enum: ['local', 'cloud'], 
        default: 'local' 
    },
    cloudUrl: { 
        type: String 
    }, // For future S3/Cloudinary
    
    // Photo-specific metadata
    width: { type: Number },
    height: { type: Number },
    
    // Video-specific metadata
    duration: { type: Number }, // in seconds
    thumbnail: { type: String }, // thumbnail path
    
    // Document-specific metadata
    pageCount: { type: Number },
    
    // Processing status for thumbnails/optimization
    processed: { 
        type: Boolean, 
        default: false 
    },
    processingError: { 
        type: String 
    }
}, { _id: true });

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
    
    // Enhanced file storage with full metadata (Hybrid Approach)
    photos: {
        type: [fileMetadataSchema],
        default: []
    },
    videos: {
        type: [fileMetadataSchema],
        default: []
    },
    docs: {
        type: [fileMetadataSchema],
        default: []
    },
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