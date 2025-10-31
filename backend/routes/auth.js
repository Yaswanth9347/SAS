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
const { uploadAnyFiles, validateMimeType } = require('../middleware/upload');
const User = require('../models/User');

const router = express.Router();

// Rate limiter for authentication endpoints (stricter limits)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.AUTH_RATE_LIMIT_MAX || 50, // 50 attempts per 15 minutes (increased for testing)
    message: JSON.stringify({
        success: false,
        error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
    }),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
        });
    }
});

// Rate limiter for password reset (prevent abuse)
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.PASSWORD_RESET_LIMIT_MAX || 10, // 10 reset requests per hour (increased for testing)
    message: JSON.stringify({
        success: false,
        error: 'Too many password reset requests, please try again after an hour.'
    }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many password reset requests, please try again after an hour.'
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
router.post('/profile/avatar', protect, uploadAnyFiles, validateMimeType, require('../controllers/authController').uploadAvatar);
router.put('/change-password', protect, changePassword);
router.get('/stats', protect, getUserStats);

// Preferences / Settings
router.get('/preferences', protect, getPreferences);
router.put('/preferences', protect, updatePreferences);

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

module.exports = router;