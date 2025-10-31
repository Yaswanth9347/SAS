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
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(helmet({
    contentSecurityPolicy: {
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
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

// CORS Configuration - Production Ready
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

// In production, also allow Render domains
if (process.env.NODE_ENV === 'production') {
    allowedOrigins.push(/\.onrender\.com$/);
}

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, curl, server-to-server)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin instanceof RegExp) {
                return allowedOrigin.test(origin);
            }
            return allowedOrigin === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('❌ CORS Error: Origin not allowed:', origin);
            console.log('✅ Allowed origins:', allowedOrigins.filter(o => !(o instanceof RegExp)));
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Global rate limiter - General API protection
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 200, // Limit each IP to 200 requests per windowMs (increased for testing)
    message: JSON.stringify({
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    }),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests from this IP, please try again later.'
        });
    }
});

// Stricter rate limiter for authentication endpoints (defined in routes/auth.js instead)
// Keeping this definition for reference, but actual limiter is in auth.js routes

// Apply global rate limiter to all API routes
app.use('/api/', globalLimiter);

// Compression middleware - compress all responses for better performance
app.use(compression());

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5001;

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    // Bind to 0.0.0.0 to accept connections from any network interface (required for Render)
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📱 Access your site: http://localhost:${PORT}`);
        console.log(`🔗 API endpoints: http://localhost:${PORT}/api/`);
        console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    });
}

// Export app for testing
module.exports = app;