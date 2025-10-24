const express = require('express');
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
    resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadAnyFiles } = require('../middleware/upload');
const User = require('../models/User');

const router = express.Router();

router.post('/register', register);
router.get('/check-username', checkUsername);
router.post('/login', login);
router.get('/me', protect, getMe);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resettoken', resetPassword);

// Profile management routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/profile/avatar', protect, uploadAnyFiles, require('../controllers/authController').uploadAvatar);
router.put('/change-password', protect, changePassword);
router.get('/stats', protect, getUserStats);

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