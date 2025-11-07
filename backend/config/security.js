/**
 * Security Configuration and Validation
 * 
 * This module provides security-related configuration and validation
 * for JWT secrets, CORS origins, and other security settings.
 */

const crypto = require('crypto');

/**
 * Validate JWT Secret Security
 * @param {string} secret - JWT secret to validate
 * @returns {Object} Validation result with status and messages
 */
const validateJWTSecurity = (secret) => {
    const issues = [];
    const warnings = [];
    
    if (!secret) {
        return {
            valid: false,
            critical: true,
            issues: ['JWT_SECRET is not defined'],
            warnings: []
        };
    }
    
    // Check minimum length
    if (secret.length < 32) {
        issues.push(`JWT secret too short (${secret.length} chars, minimum 32 required)`);
    } else if (secret.length < 64) {
        warnings.push(`JWT secret could be longer (${secret.length} chars, 64+ recommended)`);
    }
    
    // Check entropy (randomness)
    const uniqueChars = new Set(secret).size;
    const entropyRatio = uniqueChars / secret.length;
    
    if (entropyRatio < 0.5) {
        warnings.push('JWT secret has low entropy (repeated characters)');
    }
    
    // Check for common patterns
    const hasUpperCase = /[A-Z]/.test(secret);
    const hasLowerCase = /[a-z]/.test(secret);
    const hasNumbers = /[0-9]/.test(secret);
    const hasSpecialChars = /[^A-Za-z0-9]/.test(secret);
    
    const charTypeCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;
    
    if (charTypeCount < 3) {
        warnings.push('JWT secret uses limited character types (use mix of upper, lower, numbers, special chars)');
    }
    
    // Check for weak patterns
    const weakPatterns = [
        'secret', 'password', 'test', 'dev', 'development',
        '123456', 'abcdef', 'qwerty', 'admin',
        'your-secret', 'change-this', 'replace-me', 'example'
    ];
    
    const lowerSecret = secret.toLowerCase();
    const foundWeakPatterns = weakPatterns.filter(pattern => lowerSecret.includes(pattern));
    
    if (foundWeakPatterns.length > 0) {
        issues.push(`JWT secret contains weak patterns: ${foundWeakPatterns.join(', ')}`);
    }
    
    return {
        valid: issues.length === 0,
        critical: issues.length > 0,
        issues,
        warnings,
        strength: issues.length === 0 ? (warnings.length === 0 ? 'strong' : 'moderate') : 'weak'
    };
};

/**
 * Generate a strong JWT secret
 * @param {number} bytes - Number of random bytes (default 64)
 * @returns {string} Base64-encoded random secret
 */
const generateJWTSecret = (bytes = 64) => {
    return crypto.randomBytes(bytes).toString('base64');
};

/**
 * Validate CORS origin format
 * @param {string} origin - Origin URL to validate
 * @returns {Object} Validation result
 */
const validateCORSOrigin = (origin) => {
    if (!origin || origin.trim() === '') {
        return { valid: false, message: 'Origin is empty' };
    }
    
    const trimmedOrigin = origin.trim();
    
    // Check for trailing slash
    if (trimmedOrigin.endsWith('/')) {
        return { 
            valid: false, 
            message: 'Origin should not have trailing slash',
            suggestion: trimmedOrigin.slice(0, -1)
        };
    }
    
    // Check for wildcards (not recommended in production)
    if (trimmedOrigin.includes('*')) {
        return {
            valid: false,
            message: 'Wildcards (*) are not recommended in CORS origins',
            suggestion: 'Specify exact domain names'
        };
    }
    
    // Check for valid URL format
    try {
        const url = new URL(trimmedOrigin);
        
        // Warn about HTTP in production
        if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
            return {
                valid: true,
                warning: 'Using HTTP for non-localhost origin (use HTTPS in production)'
            };
        }
        
        return { valid: true };
    } catch (e) {
        return {
            valid: false,
            message: 'Invalid URL format',
            error: e.message
        };
    }
};

/**
 * Parse and validate CORS origins from environment
 * @param {string} originsString - Comma-separated origins
 * @returns {Object} Parsed origins with validation results
 */
const parseCORSOrigins = (originsString) => {
    if (!originsString) {
        return { origins: [], errors: [], warnings: [] };
    }
    
    const origins = originsString.split(',').map(o => o.trim()).filter(o => o);
    const errors = [];
    const warnings = [];
    const validOrigins = [];
    
    origins.forEach(origin => {
        const validation = validateCORSOrigin(origin);
        
        if (validation.valid) {
            validOrigins.push(origin);
            if (validation.warning) {
                warnings.push(`${origin}: ${validation.warning}`);
            }
        } else {
            errors.push(`${origin}: ${validation.message}`);
            if (validation.suggestion) {
                errors.push(`  → Suggested: ${validation.suggestion}`);
            }
        }
    });
    
    return {
        origins: validOrigins,
        errors,
        warnings,
        valid: errors.length === 0
    };
};

/**
 * Get security configuration summary
 * @returns {Object} Security configuration status
 */
const getSecurityStatus = () => {
    const jwtValidation = validateJWTSecurity(process.env.JWT_SECRET);
    const corsValidation = parseCORSOrigins(process.env.ALLOWED_ORIGINS);
    
    return {
        jwt: {
            configured: !!process.env.JWT_SECRET,
            validation: jwtValidation,
            expiration: process.env.JWT_EXPIRE || '7d'
        },
        cors: {
            mode: process.env.CORS_MODE || 'development',
            validation: corsValidation,
            totalOrigins: corsValidation.origins.length
        },
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    };
};

/**
 * Security recommendations based on environment
 * @param {string} environment - Environment name (development, production, etc)
 * @returns {Array} List of security recommendations
 */
const getSecurityRecommendations = (environment = 'production') => {
    const recommendations = [];
    
    if (environment === 'production') {
        recommendations.push({
            category: 'JWT',
            priority: 'HIGH',
            recommendation: 'Use unique JWT secret for production (never reuse dev secrets)',
            action: 'Generate new secret: openssl rand -base64 64'
        });
        
        recommendations.push({
            category: 'JWT',
            priority: 'MEDIUM',
            recommendation: 'Set JWT_EXPIRE to 7-30 days maximum',
            action: 'Update JWT_EXPIRE in environment variables'
        });
        
        recommendations.push({
            category: 'JWT',
            priority: 'HIGH',
            recommendation: 'Rotate JWT secret every 90 days',
            action: 'Schedule secret rotation in your deployment process'
        });
        
        recommendations.push({
            category: 'CORS',
            priority: 'CRITICAL',
            recommendation: 'Set CORS_MODE=strict for production',
            action: 'Update CORS_MODE=strict in environment variables'
        });
        
        recommendations.push({
            category: 'CORS',
            priority: 'HIGH',
            recommendation: 'Specify exact allowed origins (no wildcards)',
            action: 'List all production domains in ALLOWED_ORIGINS'
        });
        
        recommendations.push({
            category: 'CORS',
            priority: 'MEDIUM',
            recommendation: 'Use HTTPS for all production origins',
            action: 'Ensure all ALLOWED_ORIGINS use https:// protocol'
        });
        
        recommendations.push({
            category: 'Security',
            priority: 'HIGH',
            recommendation: 'Enable rate limiting on all endpoints',
            action: 'Verify RATE_LIMIT_MAX is set appropriately'
        });
        
        recommendations.push({
            category: 'Security',
            priority: 'MEDIUM',
            recommendation: 'Set SESSION_SECRET to strong random value',
            action: 'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        });
    } else {
        recommendations.push({
            category: 'Development',
            priority: 'INFO',
            recommendation: 'Use separate JWT secret for development',
            action: 'Keep development and production secrets different'
        });
        
        recommendations.push({
            category: 'Development',
            priority: 'INFO',
            recommendation: 'CORS is relaxed for local development',
            action: 'Local network IPs are automatically allowed'
        });
    }
    
    return recommendations;
};

module.exports = {
    validateJWTSecurity,
    generateJWTSecret,
    validateCORSOrigin,
    parseCORSOrigins,
    getSecurityStatus,
    getSecurityRecommendations
};
