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
    }
}, {
    timestamps: true
});

// ============================================
// DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
// ============================================

// Index for school name (frequently searched)
schoolSchema.index({ name: 1 });

// Index for active schools (common filter)
schoolSchema.index({ isActive: 1 });

// Compound index for active schools sorted by name
schoolSchema.index({ isActive: 1, name: 1 });

// Index for location-based queries
schoolSchema.index({ 'address.city': 1, 'address.state': 1 });
schoolSchema.index({ 'address.pincode': 1 });

// Text index for search functionality (name, address)
schoolSchema.index({
    name: 'text',
    'address.street': 'text',
    'address.city': 'text',
    'address.state': 'text'
});

// Index for schools with available classes
schoolSchema.index({ availableClasses: 1, isActive: 1 });

// ============================================
// SCHEMA MIDDLEWARE
// ============================================

// Update availableClasses when totalClasses changes
schoolSchema.pre('save', function(next) {
    if (this.isModified('totalClasses') && !this.isModified('availableClasses')) {
        this.availableClasses = this.totalClasses;
    }
    next();
});

module.exports = mongoose.model('School', schoolSchema);