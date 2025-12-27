const express = require('express');
const { checkEmailConfig } = require('./utils/emailService');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
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

// Automatically add Vercel URLs when deployed there
if (process.env.VERCEL_URL) {
    derivedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL) {
    // Also allow all vercel.app preview/production domains
    derivedOrigins.push('https://spread-a-smile.vercel.app');
}

const defaultOrigins = [
    'http://localhost:5001', 
    'http://localhost:3000',
    'http://localhost:5002',
    'http://127.0.0.1:5001',
    'http://127.0.0.1:5002'
];
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
    max: Number(process.env.RATE_LIMIT_MAX || 100),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,

    // Keep ip validation off because Firebase emulator/proxy chains can be odd
    validate: { ip: false },

    // Correct IPv6-safe key generator (recommended by express-rate-limit)
    keyGenerator: (req, res) => {
        try {
            return ipKeyGenerator(req, res);
        } catch {
            // very defensive fallback (should rarely be needed)
            const xff = req.headers['x-forwarded-for'];
            const xffValue = Array.isArray(xff) ? xff[0] : xff;
            const forwardedIp =
                typeof xffValue === 'string' ? xffValue.split(',')[0].trim() : '';
            return forwardedIp || req.socket?.remoteAddress || 'unknown';
        }
    },
});

app.use('/api/', globalLimiter);
// ...existing code...

// Request parsing & static
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// NOTE: When deployed behind Firebase Hosting, static frontend is served by Hosting,
// but this remains useful for local development.
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection (skip in tests)
const getMongoUri = () => (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();

let mongoConnectPromise;
async function ensureMongoConnected() {
    if (mongoose.connection.readyState === 1) return;
    if (mongoConnectPromise) return mongoConnectPromise;

    const mongoUri = getMongoUri();
    if (!mongoUri) {
        throw new Error('Missing MongoDB connection string. Set MONGODB_URI (recommended) or MONGO_URI.');
    }

    mongoConnectPromise = mongoose
        .connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        .then(() => {
            console.log('✅ MongoDB Atlas Connected Successfully!');
        })
        .catch((err) => {
            mongoConnectPromise = undefined;
            throw err;
        });

    return mongoConnectPromise;
}

if (process.env.NODE_ENV !== 'test') {
    // In Cloud Functions, the process must never exit on startup errors.
    // We attempt to connect at startup if a URI exists; otherwise we log and continue.
    const mongoUri = getMongoUri();
    if (mongoUri) {
        ensureMongoConnected().catch((err) => {
            console.error('❌ MongoDB connection error:', err.message);
        });
    } else {
        console.warn('⚠️  MONGODB_URI not set. API will start, but database features will fail until it is configured.');
    }
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

// Temporarily disable PDF reports on Vercel (puppeteer not serverless-compatible)
if (process.env.VERCEL) {
    app.use('/api/reports', (req, res) => {
        res.status(503).json({ 
            error: 'PDF report generation is temporarily unavailable on serverless deployment.',
            message: 'Use local backend or upgrade to puppeteer-core + @sparticuz/chromium for serverless support.'
        });
    });
} else {
    app.use('/api/reports', require('./routes/reports'));
}

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
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        mongoUriPresent: Boolean(getMongoUri()),
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
