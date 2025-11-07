const express = require('express');
const { checkEmailConfig } = require('./utils/emailService');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Fix Mongoose deprecation warning
mongoose.set('strictQuery', false);

// ============================================
// JWT SECRET VALIDATION
// ============================================
// Validate JWT secret meets security requirements
const validateJWTSecret = () => {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
        console.error('❌ CRITICAL: JWT_SECRET is not defined in environment variables!');
        console.error('   Generate one using: openssl rand -base64 64');
        process.exit(1);
    }
    
    // Check minimum length (32 characters recommended)
    if (jwtSecret.length < 32) {
        console.warn('⚠️  WARNING: JWT_SECRET is too short (minimum 32 characters recommended)');
        console.warn('   Current length:', jwtSecret.length);
        console.warn('   Generate a stronger secret: openssl rand -base64 64');
        
        if (process.env.NODE_ENV === 'production') {
            console.error('❌ CRITICAL: Cannot start in production with weak JWT secret');
            process.exit(1);
        }
    }
    
    // Check for common weak secrets
    const weakSecrets = [
        'secret', 'password', 'test', 'dev', 'development',
        '123456', 'your-secret-key', 'change-this', 'your-super-secret'
    ];
    
    const lowerSecret = jwtSecret.toLowerCase();
    const isWeak = weakSecrets.some(weak => lowerSecret.includes(weak));
    
    if (isWeak) {
        console.warn('⚠️  WARNING: JWT_SECRET appears to be weak (contains common words)');
        console.warn('   Use cryptographically random bytes: openssl rand -base64 64');
        
        if (process.env.NODE_ENV === 'production') {
            console.error('❌ CRITICAL: Cannot start in production with weak JWT secret');
            process.exit(1);
        }
    }
    
    // Success
    console.log('✅ JWT Secret validated (length:', jwtSecret.length, 'characters)');
    
    // Check expiration setting
    const jwtExpire = process.env.JWT_EXPIRE || '7d';
    console.log('✅ JWT Token Expiration:', jwtExpire);
    
    // Warn if expiration is too long in production
    if (process.env.NODE_ENV === 'production') {
        const days = parseInt(jwtExpire);
        if (days > 30) {
            console.warn('⚠️  WARNING: JWT_EXPIRE is quite long for production (>', days, 'days)');
            console.warn('   Consider using shorter expiration (7-30 days) for better security');
        }
    }
};

// Validate JWT secret on startup (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    validateJWTSecret();
}

// ============================================
// SERVER INSTANCE ID (FOR SESSION INVALIDATION)
// ============================================
// Generate unique server instance ID on every restart
// This will be used to invalidate all client sessions when server restarts
const SERVER_INSTANCE_ID = `server_${Date.now()}_${Math.random().toString(36).substring(7)}`;
console.log(`🔑 Server Instance ID: ${SERVER_INSTANCE_ID}`);

// Make instance ID available globally
app.locals.serverInstanceId = SERVER_INSTANCE_ID;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
// In development, relax CSP for local network access; in production, enforce strict policies
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : { // Disable CSP in development for easier testing
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://unpkg.com",
                "https://ga.jspm.io"
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, onerror, onload)
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow loading external resources
    hsts: isDevelopment ? false : { // Disable HSTS in development
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

// CORS Configuration - Production-Ready with Strict Origin Validation
const corsMode = process.env.CORS_MODE || 'development';
const allowedOrigins = [
    'http://localhost:5001',
    'http://localhost:3000',
    'http://127.0.0.1:5001',
    'http://127.0.0.1:3000'
];

// Add production frontend URL if defined
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

// Add custom allowed origins from environment variable
if (process.env.ALLOWED_ORIGINS) {
    const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    allowedOrigins.push(...customOrigins);
}

// In production, also allow Render domains (only if not in strict mode)
if (process.env.NODE_ENV === 'production' && corsMode !== 'strict') {
    allowedOrigins.push(/\.onrender\.com$/);
}

// Log CORS configuration on startup
console.log('🔒 CORS Configuration:');
console.log('   Mode:', corsMode);
console.log('   Environment:', process.env.NODE_ENV || 'development');
console.log('   Allowed Origins:', allowedOrigins.filter(o => !(o instanceof RegExp)));
if (allowedOrigins.some(o => o instanceof RegExp)) {
    console.log('   Pattern Matching: *.onrender.com (Render platform)');
}

app.use(cors({
    origin: function (origin, callback) {
        // In strict production mode, reject requests with no origin
        if (!origin) {
            if (corsMode === 'strict' && process.env.NODE_ENV === 'production') {
                console.log('❌ CORS: Rejected request with no origin (strict mode)');
                return callback(new Error('Origin header required'));
            }
            // Allow requests with no origin in development (Postman, curl, mobile apps)
            return callback(null, true);
        }
        
        // In development mode, allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (process.env.NODE_ENV !== 'production' || corsMode === 'development') {
            const localNetworkRegex = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
            if (localNetworkRegex.test(origin)) {
                console.log('✅ CORS: Allowing local network origin:', origin);
                return callback(null, true);
            }
        }
        
        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin);
            }
            return allowedOrigin === origin;
        });
        
        if (isAllowed) {
            if (process.env.NODE_ENV === 'production') {
                console.log('✅ CORS: Allowed production origin:', origin);
            }
            callback(null, true);
        } else {
            console.log('❌ CORS Error: Origin not allowed:', origin);
            console.log('   Allowed origins:', allowedOrigins.filter(o => !(o instanceof RegExp)).join(', '));
            console.log('   💡 Tip: Add this origin to ALLOWED_ORIGINS in .env file');
            
            // In strict mode, reject with detailed error
            if (corsMode === 'strict') {
                callback(new Error(`CORS policy: Origin ${origin} is not in the allowed list`));
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours - Cache preflight requests
}));

// ============================================
// RATE LIMITING - API PROTECTION
// ============================================
// Comprehensive rate limiting to prevent abuse and DDoS attacks

// 1. Global API Rate Limiter (all /api/* endpoints)
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: JSON.stringify({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        type: 'RATE_LIMIT_EXCEEDED'
    }),
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (req, res) => {
        const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000) - Math.floor(Date.now() / 1000);
        
        console.warn('🚫 Rate limit exceeded:', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            remaining: req.rateLimit.remaining,
            limit: req.rateLimit.limit,
            retryAfter: retryAfter
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: retryAfter,
            limit: req.rateLimit.limit,
            windowMs: req.rateLimit.windowMs
        });
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});

// 2. Authentication Rate Limiter (stricter for auth endpoints)
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 50,
    message: 'Too many authentication attempts from this IP, please try again later.',
    standardHeaders: true,
    skipSuccessfulRequests: false, // Count successful requests
    handler: (req, res) => {
        console.warn('🚫 Auth rate limit exceeded:', {
            ip: req.ip,
            path: req.path,
            email: req.body?.email || 'unknown'
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many authentication attempts. Please try again later.',
            type: 'AUTH_RATE_LIMIT'
        });
    }
});

// 3. Password Reset Rate Limiter (very strict)
const passwordResetLimiter = rateLimit({
    windowMs: parseInt(process.env.PASSWORD_RESET_LIMIT_WINDOW) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.PASSWORD_RESET_LIMIT_MAX) || 10,
    message: 'Too many password reset requests, please try again later.',
    standardHeaders: true,
    handler: (req, res) => {
        console.warn('🚫 Password reset limit exceeded:', {
            ip: req.ip,
            email: req.body?.email || 'unknown'
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many password reset requests. Please try again in an hour.',
            type: 'PASSWORD_RESET_LIMIT'
        });
    }
});

// 4. File Upload Rate Limiter
const uploadLimiter = rateLimit({
    windowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 30,
    message: 'Too many file uploads, please try again later.',
    standardHeaders: true,
    handler: (req, res) => {
        console.warn('🚫 Upload rate limit exceeded:', {
            ip: req.ip,
            path: req.path
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many file uploads. Please try again later.',
            type: 'UPLOAD_RATE_LIMIT'
        });
    }
});

// 5. Contact Form Rate Limiter
const contactLimiter = rateLimit({
    windowMs: parseInt(process.env.CONTACT_RATE_LIMIT_WINDOW) || 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.CONTACT_RATE_LIMIT_MAX) || 5,
    message: 'Too many contact form submissions, please try again later.',
    standardHeaders: true,
    handler: (req, res) => {
        console.warn('🚫 Contact form limit exceeded:', {
            ip: req.ip,
            email: req.body?.email || 'unknown'
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many contact submissions. Please try again in an hour.',
            type: 'CONTACT_RATE_LIMIT'
        });
    }
});

// Log rate limiter configuration on startup
console.log('🛡️  Rate Limiting Configuration:');
console.log('   Global API:', parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, 'requests per 15 min');
console.log('   Authentication:', parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 50, 'requests per 15 min');
console.log('   Password Reset:', parseInt(process.env.PASSWORD_RESET_LIMIT_MAX) || 10, 'requests per hour');
console.log('   File Uploads:', parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 30, 'requests per 15 min');
console.log('   Contact Form:', parseInt(process.env.CONTACT_RATE_LIMIT_MAX) || 5, 'requests per hour');

// Apply global rate limiter to all API routes
app.use('/api/', globalLimiter);

// Export rate limiters for use in specific routes
app.locals.rateLimiters = {
    auth: authLimiter,
    passwordReset: passwordResetLimiter,
    upload: uploadLimiter,
    contact: contactLimiter
};

// Compression middleware - compress all responses for better performance
app.use(compression());

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to add server instance ID to all API responses
app.use('/api', (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to include server instance ID
    res.json = function(data) {
        // Add instance ID to response (except for health check to avoid clutter)
        if (!req.path.includes('/health') && typeof data === 'object' && data !== null) {
            data.serverInstanceId = SERVER_INSTANCE_ID;
        }
        return originalJson.call(this, data);
    };
    
    next();
});

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection (only connect if not in test environment)
if (process.env.NODE_ENV !== 'test') {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('✅ MongoDB Atlas Connected Successfully!'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/volunteers', require('./routes/volunteers'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/teams', require('./routes/teams'));
// On startup, verify email config in staging/production
try {
    const check = checkEmailConfig();
    if (!check.ok) {
        console.warn('[startup] Email configuration incomplete. Emails may fail to send.');
    }
} catch (e) {
    console.warn('[startup] Email configuration check failed:', e.message);
}
app.use('/api/schools', require('./routes/schools'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/reports', require('./routes/reports'));
// app.use('/api/security', require('./routes/security')); // TODO: Fix route definition

// Health check routes (for monitoring and Render deployment)
app.use('/api/health', require('./routes/health'));

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend is working!',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ============================================
// CENTRALIZED ERROR HANDLING
// Must be defined AFTER all routes
// ============================================
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 404 handler for unmatched API routes (only for /api/* paths)
app.use('/api/*', notFoundHandler);

// Global error handler - catches all errors
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

// Get local network IP address for easier mobile/tablet access
const getLocalIP = () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
};

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    // Bind to 0.0.0.0 to accept connections from any network interface (required for Render & local network access)
    app.listen(PORT, '0.0.0.0', () => {
        const localIP = getLocalIP();
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📱 Local: http://localhost:${PORT}`);
        console.log(`📱 Network: http://${localIP}:${PORT}`);
        console.log(`🔗 API endpoints: http://${localIP}:${PORT}/api/`);
        console.log(`❤️  Health check: http://${localIP}:${PORT}/api/health`);
        console.log('');
        console.log('📱 To access from other devices on your network:');
        console.log(`   Open http://${localIP}:${PORT} on your mobile/tablet`);
    });
}

// Export app for testing
module.exports = app;