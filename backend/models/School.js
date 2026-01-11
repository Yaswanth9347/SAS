const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add school name'],
        trim: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    // Multiple contact persons support
    contactPersons: [{
        name: { type: String, required: true },
        position: String,
        phone: String,
        email: String,
        isPrimary: { type: Boolean, default: false },
        notes: String,
        addedAt: { type: Date, default: Date.now }
    }],
    // Legacy single contact person (for backward compatibility)
    contactPerson: {
        name: String,
        position: String,
        phone: String,
        email: String
    },
    totalClasses: {
        type: Number,
        required: true,
        min: 1
    },
    availableClasses: {
        type: Number,
        required: true
    },
    grades: [String],
    notes: String,
    isActive: {
        type: Boolean,
        default: true
    },
    // Contact History
    contactHistory: [{
        date: { type: Date, default: Date.now },
        type: { 
            type: String, 
            enum: ['call', 'email', 'visit', 'meeting', 'other'],
            required: true 
        },
        contactedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            required: true 
        },
        contactPerson: String, // Which school contact person was contacted
        subject: String,
        notes: String,
        outcome: {
            type: String,
            enum: ['successful', 'no-response', 'follow-up-needed', 'declined', 'other']
        },
        followUpDate: Date,
        followUpCompleted: { type: Boolean, default: false }
    }],
    // School Ratings & Feedback
    ratings: [{
        visitId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Visit'
        },
        ratedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            required: true 
        },
        date: { type: Date, default: Date.now },
        // Rating categories (1-5 scale)
        cooperation: { type: Number, min: 1, max: 5 },
        facilities: { type: Number, min: 1, max: 5 },
        studentEngagement: { type: Number, min: 1, max: 5 },
        overallExperience: { type: Number, min: 1, max: 5 },
        // Feedback
        positives: String,
        improvements: String,
        generalComments: String,
        wouldRecommend: { type: Boolean, default: true }
    }],
    // Availability Calendar
    availability: {
        preferredDays: [{
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }],
        preferredTimeSlots: [{
            type: String,
            enum: ['morning', 'afternoon', 'evening']
        }],
        unavailableDates: [{
            startDate: Date,
            endDate: Date,
            reason: String
        }],
        specialInstructions: String,
        maxVisitsPerMonth: { type: Number, default: 4 },
        advanceNoticeDays: { type: Number, default: 7 } // Days in advance needed for scheduling
    },
    // Statistics
    stats: {
        totalVisits: { type: Number, default: 0 },
        completedVisits: { type: Number, default: 0 },
        cancelledVisits: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        lastVisitDate: Date,
        totalChildrenReached: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Indexes for better query performance
schoolSchema.index({ name: 1 });
schoolSchema.index({ isActive: 1 });
schoolSchema.index({ 'address.city': 1 });
schoolSchema.index({ 'stats.totalVisits': -1 });
schoolSchema.index({ 'availability.preferredDays': 1 });

// Update availableClasses when totalClasses changes
schoolSchema.pre('save', function(next) {
    if (this.isModified('totalClasses') && !this.isModified('availableClasses')) {
        this.availableClasses = this.totalClasses;
    }
    next();
});

// Virtual for average rating calculation
schoolSchema.virtual('averageRating').get(function() {
    if (!this.ratings || this.ratings.length === 0) return 0;
    
    const totalRatings = this.ratings.reduce((sum, rating) => {
        const avg = (
            (rating.cooperation || 0) + 
            (rating.facilities || 0) + 
            (rating.studentEngagement || 0) + 
            (rating.overallExperience || 0)
        ) / 4;
        return sum + avg;
    }, 0);
    
    return (totalRatings / this.ratings.length).toFixed(2);
});

// Virtual for pending follow-ups
schoolSchema.virtual('pendingFollowUps').get(function() {
    if (!this.contactHistory) return [];
    
    return this.contactHistory.filter(contact => 
        contact.followUpDate && 
        !contact.followUpCompleted && 
        new Date(contact.followUpDate) >= new Date()
    );
});

// Method to check if school is available on a specific date
schoolSchema.methods.isAvailableOn = function(date) {
    const checkDate = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][checkDate.getDay()];
    
    // Check if it's a preferred day
    if (this.availability?.preferredDays?.length > 0 && 
        !this.availability.preferredDays.includes(dayOfWeek)) {
        return { available: false, reason: 'Not a preferred day' };
    }
    
    // Check unavailable dates
    if (this.availability?.unavailableDates) {
        for (const period of this.availability.unavailableDates) {
            if (checkDate >= new Date(period.startDate) && checkDate <= new Date(period.endDate)) {
                return { available: false, reason: period.reason || 'School unavailable' };
            }
        }
    }
    
    return { available: true };
};

// Method to add contact history
schoolSchema.methods.addContactHistory = function(contactData) {
    this.contactHistory.push(contactData);
    return this.save();
};

// Method to add rating
schoolSchema.methods.addRating = function(ratingData) {
    this.ratings.push(ratingData);
    
    // Update average rating in stats
    const totalRatings = this.ratings.reduce((sum, rating) => {
        const avg = (
            (rating.cooperation || 0) + 
            (rating.facilities || 0) + 
            (rating.studentEngagement || 0) + 
            (rating.overallExperience || 0)
        ) / 4;
        return sum + avg;
    }, 0);
    
    this.stats.averageRating = (totalRatings / this.ratings.length).toFixed(2);
    
    return this.save();
};

// Enable virtuals in JSON
schoolSchema.set('toJSON', { virtuals: true });
schoolSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('School', schoolSchema);