const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true,
        trim: true,
        lowercase: true
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    role: {
        type: String,
        enum: ['admin', 'volunteer'],
        default: 'volunteer'
    },
    collegeId: {
        type: String,
        required: function() {
            // collegeId required for years 1-4, optional for 'Others' (5)
            return this.year !== 5;
        }
    },
    department: {
        type: String,
        required: function() {
            // department required for years 1-4, optional for 'Others' (5)
            return this.year !== 5;
        }
    },
    year: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    phone: {
        type: String,
        required: true
    },
    skills: [String],
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    profileImage: {
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Admin verification status for registrations/profile
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    verificationNotes: {
        type: String
    },
    // Per-user preferences / settings
    userPreferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        },
        language: {
            type: String,
            default: 'en'
        },
        notifications: {
            email: { type: Boolean, default: true },
            app: { type: Boolean, default: true },
            sms: { type: Boolean, default: false }
        },
        privacy: {
            profileVisibility: { type: String, enum: ['public', 'team', 'private'], default: 'team' },
            showEmail: { type: Boolean, default: false },
            showPhone: { type: Boolean, default: false }
        },
        security: {
            twoFactorEnabled: { type: Boolean, default: false }
        },
        // Accessibility
        fontSize: {
            type: String,
            enum: ['small', 'medium', 'large', 'xlarge'],
            default: 'medium'
        },
        highContrast: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// ============================================
// DATABASE INDEXES FOR PERFORMANCE OPTIMIZATION
// ============================================

// Index for authentication - email must be unique and frequently queried
userSchema.index({ email: 1 }, { unique: true });

// Index for username lookups - username must be unique
userSchema.index({ username: 1 }, { unique: true });

// Index for role-based queries (e.g., find all admins, all volunteers)
userSchema.index({ role: 1 });

// Compound index for active users by role (common query pattern)
userSchema.index({ role: 1, isActive: 1 });

// Index for verification status queries (admin approval workflow)
userSchema.index({ verificationStatus: 1, isActive: 1 });

// Index for team assignments
userSchema.index({ team: 1 });

// Index for password reset tokens
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ resetPasswordExpire: 1 });

// Compound index for filtering active, verified users by role
userSchema.index({ role: 1, isActive: 1, isVerified: 1 });

// Text index for search functionality (name, email, username)
userSchema.index({ 
    name: 'text', 
    email: 'text', 
    username: 'text',
    department: 'text'
});

// ============================================
// SCHEMA METHODS
// ============================================

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token
userSchema.methods.getResetPasswordToken = function() {
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    // Set expire time (1 hour)
    this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
    
    return resetToken;
};

module.exports = mongoose.model('User', userSchema);