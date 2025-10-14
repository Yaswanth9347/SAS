const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });

    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            department: user.department,
            year: user.year,
            team: user.team
        }
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

        // Validate username & password
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a username and password'
            });
        }

        // Check for user by username
        const user = await User.findOne({ username }).select('+password').populate('team');

        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
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