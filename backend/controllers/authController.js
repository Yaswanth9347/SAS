const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendPasswordResetConfirmation } = require('../utils/emailService');
const { optimizeAvatar } = require('../utils/imageOptimizer');

// Generate JWT Token
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'your-jwt-secret', {
        expiresIn: process.env.JWT_EXPIRE || '30d',
    });

    // Prepare user data for response (handle missing properties for admin)
    const userData = {
        id: user._id,
        name: user.name || 'Admin',
        username: user.username || 'admin',
        email: user.email || 'admin@sas.org',
        role: user.role || 'admin'
    };
    
    // Add optional fields if they exist
    if (user.department) userData.department = user.department;
    if (user.year) userData.year = user.year;
    if (user.team) userData.team = user.team;

    res.status(statusCode).json({
        success: true,
        token,
        user: userData
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, username, email, password, collegeId, department, year, phone, skills } = req.body;

        // Create user
        const user = await User.create({
            name,
            username,
            email,
            password,
            collegeId,
            department,
            year,
            phone,
            skills
        });

        sendTokenResponse(user, 200, res);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        console.log('Login attempt with username:', username);

        // Validate username & password
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a username and password'
            });
        }

        // Note: Removed legacy hard-coded admin credential bypass to ensure only the current password works

        // Regular case - check for user by username (convert to lowercase to match schema setting)
        const user = await User.findOne({ username: username.toLowerCase() }).select('+password').populate('team');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('team');
        
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Check username availability
// @route   GET /api/auth/check-username?username=...
// @access  Public
exports.checkUsername = async (req, res, next) => {
    try {
        const { username } = req.query;
        if (!username || typeof username !== 'string') {
            return res.status(400).json({ success: false, message: 'Username query parameter is required' });
        }

        const existing = await User.findOne({ username: username.toLowerCase() });
        return res.status(200).json({ success: true, available: !existing });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .populate('team', 'teamName');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
    try {
        const { name, email, phone, department, year, skills } = req.body;

        // Check if email is being changed and if it's already in use
        if (email) {
            const emailExists = await User.findOne({ 
                email: email.toLowerCase(),
                _id: { $ne: req.user.id }
            });
            
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
        }

        // Build update object
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (phone !== undefined) updateData.phone = phone;
        if (department) updateData.department = department;
        if (year) updateData.year = year;
        if (skills) updateData.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
        // Allow updating profile image (nullable to remove)
        if (req.body.profileImage !== undefined) {
            updateData.profileImage = req.body.profileImage;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both current and new password'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is same as current
        const isSame = await user.matchPassword(newPassword);
        if (isSame) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get user statistics
// @route   GET /api/auth/stats
// @access  Private
exports.getUserStats = async (req, res, next) => {
    try {
        const Visit = require('../models/Visit');
        
        // Get user's visits
        const visits = await Visit.find({
            'team.members': req.user.id,
            status: 'completed'
        }).populate('school');

        // Calculate statistics
        const stats = {
            totalVisits: visits.length,
            childrenReached: visits.reduce((sum, visit) => sum + (visit.numberOfChildren || 0), 0),
            schoolsVisited: [...new Set(visits.map(v => v.school?._id?.toString()).filter(Boolean))].length,
            totalHours: visits.reduce((sum, visit) => {
                if (visit.feedback?.duration) {
                    return sum + visit.feedback.duration;
                }
                return sum + 2; // Default 2 hours per visit if duration not specified
            }, 0)
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            data: {
                totalVisits: 0,
                childrenReached: 0,
                schoolsVisited: 0,
                totalHours: 0
            }
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email address'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent'
            });
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();

        await user.save({ validateBeforeSave: false });

        // Send email
        const emailResult = await sendPasswordResetEmail(user, resetToken);

        if (!emailResult.success) {
            // If email fails, clear the reset token
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({
                success: false,
                message: 'Email could not be sent. Please try again later.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent',
            // In development, include token for testing
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a new password'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Set new password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Send confirmation email
        await sendPasswordResetConfirmation(user);

        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again later.'
        });
    }
};

// @desc    Upload profile avatar
// @route   POST /api/auth/profile/avatar
// @access  Private
exports.uploadAvatar = async (req, res, next) => {
    try {
        // multer's upload.any() will populate req.files (array) or req.file
        const files = req.files || [];
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const file = files[0];
        
        // Optimize avatar image (resize to 320x320, compress)
        console.log('Optimizing avatar:', file.path);
        const optimizeResult = await optimizeAvatar(file.path);
        
        if (!optimizeResult.success) {
            console.error('Avatar optimization failed:', optimizeResult.error);
            // Continue anyway with original file
        } else {
            console.log('Avatar optimized:', optimizeResult);
        }
        
        const path = require('path');
        const rel = path.relative(path.join(__dirname, '../uploads'), file.path).replace(/\\/g, '/');
        const url = `/uploads/${rel}`;

        const user = await User.findByIdAndUpdate(req.user.id, { profileImage: url }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.status(200).json({ 
            success: true, 
            message: 'Avatar uploaded and optimized', 
            data: { 
                profileImage: url,
                optimization: optimizeResult.success ? {
                    originalSize: optimizeResult.originalSize,
                    optimizedSize: optimizeResult.optimizedSize,
                    reduction: optimizeResult.reduction
                } : null
            } 
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
