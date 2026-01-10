const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    register,
    login,
    getMe,
    checkUsername,
    getUserProfile,
    updateUserProfile,
    changePassword,
    getUserStats,
    forgotPassword,
    resetPassword,
    getPreferences,
    updatePreferences
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { hybridUploadAny } = require('../middleware/hybridUpload');
const User = require('../models/User');

const router = express.Router();

// Rate limiter for authentication endpoints (stricter limits)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.AUTH_RATE_LIMIT_MAX || 50, // 50 attempts per 15 minutes (increased for production)
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,

    // Return JSON response instead of plain text
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
        });
    }
});

// Rate limiter for password reset (prevent abuse)
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.PASSWORD_RESET_LIMIT_MAX || 3, // 3 reset requests per hour
    standardHeaders: true,
    legacyHeaders: false,

    // Return JSON response instead of plain text
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many password reset requests, please try again after an hour.'
        });
    }
});

router.post('/register', authLimiter, register);
router.get('/check-username', checkUsername);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);

// Password reset routes with rate limiting
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.put('/reset-password/:resettoken', passwordResetLimiter, resetPassword);

// Profile management routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/profile/avatar', protect, hybridUploadAny, require('../controllers/authController').uploadAvatar);
router.put('/change-password', protect, changePassword);
router.get('/stats', protect, getUserStats);

// Preferences / Settings
router.get('/preferences', protect, getPreferences);
router.put('/preferences', protect, updatePreferences);

// Two-Factor Authentication routes
router.use('/', require('./twoFactor'));


// Debug route for admin credentials
router.get('/check-admin', async (req, res) => {
    try {
        // Find admin user
        const admin = await User.findOne({ role: 'admin' });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'No admin user found'
            });
        }

        return res.status(200).json({
            success: true,
            admin: {
                name: admin.name,
                username: admin.username,
                role: admin.role,
                id: admin._id
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Test Cloudinary connection
router.get('/test-cloudinary', async (req, res) => {
    try {
        const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
        
        // Check if credentials are configured
        const hasCredentials = isCloudinaryConfigured();
        
        if (!hasCredentials) {
            return res.status(500).json({
                success: false,
                message: 'Cloudinary credentials not configured',
                config: {
                    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
                    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
                    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
                }
            });
        }
        
        // Test API connection with ping
        const result = await cloudinary.api.ping();
        
        res.json({
            success: true,
            message: 'Cloudinary connected successfully! 🎉',
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            status: result.status,
            config: {
                CLOUDINARY_CLOUD_NAME: '✅ Connected',
                CLOUDINARY_API_KEY: '✅ Valid',
                CLOUDINARY_API_SECRET: '✅ Valid'
            }
        });
    } catch (error) {
        console.error('❌ Cloudinary test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Cloudinary connection failed',
            error: error.message,
            config: {
                CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
                CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
                CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
            }
        });
    }
});

module.exports = router;