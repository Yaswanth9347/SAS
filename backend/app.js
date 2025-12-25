const express = require('express');
const { checkEmailConfig } = require('./utils/emailService');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy - important behind proxies/load balancers
app.set('trust proxy', 1);

// Fix Mongoose deprecation warning
mongoose.set('strictQuery', false);

// Helmet - Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS configuration
const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

const derivedOrigins = [];
if (process.env.FRONTEND_URL) {
    derivedOrigins.push(process.env.FRONTEND_URL.trim());
}

const defaultOrigins = ['http://localhost:5001', 'http://localhost:3000'];
const allowedOrigins = [...new Set([...envOrigins, ...derivedOrigins, ...defaultOrigins])];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', globalLimiter);

// Request parsing & static
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// NOTE: When deployed behind Firebase Hosting, static frontend is served by Hosting,
// but this remains useful for local development.
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection (skip in tests)
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
app.use('/api/security', require('./routes/security'));

// Test & health
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Backend is working!',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

// Local-only frontend fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;
