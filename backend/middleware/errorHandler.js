// ============================================
// CENTRALIZED ERROR HANDLER MIDDLEWARE
// Provides consistent error responses across the API
// Handles different error types appropriately
// ============================================

/**
 * Custom API Error Class
 * Used to create consistent errors with status codes
 */
class ApiError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // Distinguish operational errors from programming errors
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Not Found Error Class
 * Used for 404 errors
 */
class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

/**
 * Validation Error Class
 * Used for input validation errors
 */
class ValidationError extends ApiError {
    constructor(message = 'Validation failed') {
        super(message, 400);
    }
}

/**
 * Unauthorized Error Class
 * Used for authentication errors
 */
class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized access') {
        super(message, 401);
    }
}

/**
 * Forbidden Error Class
 * Used for authorization errors
 */
class ForbiddenError extends ApiError {
    constructor(message = 'Access forbidden') {
        super(message, 403);
    }
}

/**
 * Format error response
 * Creates consistent error response structure
 */
const formatErrorResponse = (error, statusCode) => {
    const response = {
        success: false,
        error: error.message || 'Internal server error',
        statusCode: statusCode
    };

    // Add validation errors if present (Mongoose ValidationError)
    if (error.errors) {
        response.validationErrors = {};
        Object.keys(error.errors).forEach(key => {
            response.validationErrors[key] = error.errors[key].message;
        });
    }

    // Add stack trace in development mode
    if (process.env.NODE_ENV === 'development') {
        response.stack = error.stack;
    }

    return response;
};

/**
 * Log error with context
 * Provides detailed error logging for debugging
 */
const logError = (error, req) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id || 'anonymous',
        body: req.method !== 'GET' ? req.body : undefined,
        query: req.query
    };

    // Use appropriate log level based on error type
    if (error.statusCode >= 500) {
        console.error('❌ Server Error:', JSON.stringify(errorLog, null, 2));
    } else if (error.statusCode >= 400) {
        console.warn('⚠️  Client Error:', JSON.stringify(errorLog, null, 2));
    } else {
        console.log('ℹ️  Error:', JSON.stringify(errorLog, null, 2));
    }
};

/**
 * Main Error Handler Middleware
 * Catches all errors and formats them consistently
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.stack = err.stack;

    // Log error
    logError(err, req);

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        message = 'Resource not found';
        statusCode = 404;
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0];
        message = field 
            ? `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            : 'Duplicate field value entered';
        statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        message = 'Validation failed';
        statusCode = 400;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        message = 'Invalid token';
        statusCode = 401;
    }

    if (err.name === 'TokenExpiredError') {
        message = 'Token expired';
        statusCode = 401;
    }

    // Multer errors (file upload)
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size too large';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
        } else {
            message = err.message;
        }
        statusCode = 400;
    }

    // Rate limit errors (already handled by rate limiters, but just in case)
    if (err.statusCode === 429) {
        message = err.message || 'Too many requests, please try again later';
        statusCode = 429;
    }

    // CORS errors
    if (err.message && err.message.includes('CORS')) {
        message = 'CORS policy violation';
        statusCode = 403;
    }

    // Send error response
    res.status(statusCode).json(formatErrorResponse(error, statusCode));
};

/**
 * 404 Not Found Handler
 * Catches all unmatched routes
 */
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    ApiError,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError
};
