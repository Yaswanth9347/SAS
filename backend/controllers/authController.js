const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

        // Hard-coded check for admin credentials - highest priority
        if ((username.toLowerCase() === 'admin') && password === 'Admin@13') {
            console.log('Admin credentials match. Looking up admin user...');
            
            const admin = await User.findOne({ role: 'admin' });
            
            if (admin) {
                console.log('Admin user found. Sending token...');
                return sendTokenResponse(admin, 200, res);
            } else {
                console.log('No admin user found in the database.');
            }
        }

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