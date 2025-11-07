/**
 * Security Configuration Check Endpoint
 * 
 * GET /api/security/status (Admin only)
 * Returns security configuration status and recommendations
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const { 
    getSecurityStatus, 
    getSecurityRecommendations 
} = require('../config/security');

// Admin middleware - check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }
    
    next();
};

/**
 * @route   GET /api/security/status
 * @desc    Get security configuration status
 * @access  Admin only
 */
router.get('/status', protect, requireAdmin, async (req, res) => {
    try {
        const status = getSecurityStatus();
        const recommendations = getSecurityRecommendations(process.env.NODE_ENV);
        
        // Filter out actual secret values from response
        const safeStatus = {
            ...status,
            jwt: {
                ...status.jwt,
                secretPreview: status.jwt.configured 
                    ? `${process.env.JWT_SECRET.substring(0, 8)}...` 
                    : 'NOT SET'
            }
        };
        
        // Count issues
        const criticalIssues = [];
        const warnings = [];
        
        if (status.jwt.validation.critical) {
            criticalIssues.push(...status.jwt.validation.issues);
        }
        
        if (status.jwt.validation.warnings) {
            warnings.push(...status.jwt.validation.warnings);
        }
        
        if (!status.cors.validation.valid) {
            criticalIssues.push(...status.cors.validation.errors);
        }
        
        if (status.cors.validation.warnings) {
            warnings.push(...status.cors.validation.warnings);
        }
        
        res.json({
            success: true,
            security: {
                status: safeStatus,
                recommendations,
                summary: {
                    overallStatus: criticalIssues.length === 0 ? 'healthy' : 'issues_found',
                    criticalIssues: criticalIssues.length,
                    warnings: warnings.length,
                    jwtStrength: status.jwt.validation.strength || 'not_configured',
                    corsMode: status.cors.mode,
                    environment: status.environment
                },
                issues: {
                    critical: criticalIssues,
                    warnings: warnings
                }
            }
        });
    } catch (error) {
        console.error('Security status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security status',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/security/generate-secret
 * @desc    Generate a new JWT secret (development only)
 * @access  Admin only
 */
router.post('/generate-secret', protect, requireAdmin, async (req, res) => {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                error: 'Secret generation is disabled in production',
                message: 'Generate secrets locally and add them via environment variables'
            });
        }
        
        const { generateJWTSecret } = require('../config/security');
        const newSecret = generateJWTSecret(64);
        
        res.json({
            success: true,
            message: 'New JWT secret generated',
            secret: newSecret,
            instructions: [
                '1. Copy the secret above',
                '2. Update JWT_SECRET in your .env file',
                '3. Restart the server',
                '4. Never commit this secret to version control',
                '5. Use different secrets for dev/staging/production'
            ],
            commands: {
                openssl: 'openssl rand -base64 64',
                nodejs: 'node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"'
            }
        });
    } catch (error) {
        console.error('Secret generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate secret',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/security/recommendations
 * @desc    Get security recommendations for current environment
 * @access  Admin only
 */
router.get('/recommendations', protect, requireAdmin, async (req, res) => {
    try {
        const environment = req.query.env || process.env.NODE_ENV || 'development';
        const recommendations = getSecurityRecommendations(environment);
        
        // Group by priority
        const grouped = {
            critical: recommendations.filter(r => r.priority === 'CRITICAL'),
            high: recommendations.filter(r => r.priority === 'HIGH'),
            medium: recommendations.filter(r => r.priority === 'MEDIUM'),
            info: recommendations.filter(r => r.priority === 'INFO')
        };
        
        res.json({
            success: true,
            environment,
            recommendations: grouped,
            summary: {
                total: recommendations.length,
                critical: grouped.critical.length,
                high: grouped.high.length,
                medium: grouped.medium.length,
                info: grouped.info.length
            }
        });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve recommendations',
            message: error.message
        });
    }
});

module.exports = router;
