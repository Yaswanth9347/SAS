const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }

    try {
        // Verify token and get full user details including team
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch complete user data including team information
        const user = await User.findById(decoded.id).populate('team');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach complete user info to req.user (keeping role for backward compatibility)
        req.user = {
            id: user._id,
            role: user.role, // Kept for backward compatibility but not enforced
            team: user.team ? user.team._id : null,
            name: user.name,
            username: user.username,
            email: user.email
        };

        next();
    } catch (err) {
        // Handle token expiry specifically
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
};

// Grant access to specific roles (DEPRECATED - no longer enforced)
// Kept for backward compatibility but does not restrict access
exports.authorize = (...roles) => {
    return (req, res, next) => {
        // Role authorization removed - all authenticated users can access
        next();
    };
};