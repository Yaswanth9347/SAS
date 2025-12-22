const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const {
    generate2FASecret,
    generateQRCode,
    verify2FAToken,
    generateBackupCodes,
    hashBackupCode,
    verifyBackupCode,
    generateSMS2FACode
} = require('../utils/twoFactorService');
const { send2FACode } = require('../utils/smsService');

/**
 * @route   POST /api/auth/2fa/setup
 * @desc    Generate 2FA secret and QR code
 * @access  Private
 */
router.post('/2fa/setup', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user.userPreferences.security.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                message: '2FA is already enabled. Disable it first to setup again.'
            });
        }

        // Generate secret
        const { secret, otpauth_url } = generate2FASecret(user.email, user.name);

        // Generate QR code
        const qrCode = await generateQRCode(otpauth_url);

        // Store secret temporarily (not enabled yet)
        user.userPreferences.security.twoFactorSecret = secret;
        await user.save();

        res.json({
            success: true,
            message: 'Scan this QR code with your authenticator app',
            data: {
                qrCode,
                secret, // Also send secret in case user wants to enter manually
                otpauth_url
            }
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup 2FA',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/auth/2fa/verify-setup
 * @desc    Verify 2FA token and enable 2FA
 * @access  Private
 */
router.post('/2fa/verify-setup', protect, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token || token.length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 6-digit code'
            });
        }

        const user = await User.findById(req.user.id).select('+userPreferences.security.twoFactorSecret');

        if (!user.userPreferences.security.twoFactorSecret) {
            return res.status(400).json({
                success: false,
                message: 'Please setup 2FA first'
            });
        }

        // Verify token
        const verified = verify2FAToken(user.userPreferences.security.twoFactorSecret, token);

        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code. Please try again.'
            });
        }

        // Generate backup codes
        const backupCodes = generateBackupCodes(10);
        const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

        // Enable 2FA
        user.userPreferences.security.twoFactorEnabled = true;
        user.userPreferences.security.twoFactorBackupCodes = hashedBackupCodes;
        await user.save();

        res.json({
            success: true,
            message: '2FA enabled successfully',
            data: {
                backupCodes: backupCodes, // Display once to user
                message: 'Save these backup codes in a safe place. You won\'t see them again.'
            }
        });
    } catch (error) {
        console.error('2FA verify setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify 2FA',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/auth/2fa/verify
 * @desc    Verify 2FA token during login
 * @access  Public (but requires valid session)
 */
router.post('/2fa/verify', async (req, res) => {
    try {
        const { token, userId, useBackupCode } = req.body;

        if (!token || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Token and userId are required'
            });
        }

        const user = await User.findById(userId)
            .select('+userPreferences.security.twoFactorSecret +userPreferences.security.twoFactorBackupCodes');

        if (!user || !user.userPreferences.security.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

        let verified = false;

        if (useBackupCode) {
            // Verify backup code
            const result = verifyBackupCode(token, user.userPreferences.security.twoFactorBackupCodes);
            verified = result.valid;

            if (verified) {
                // Remove used backup code
                user.userPreferences.security.twoFactorBackupCodes.splice(result.codeIndex, 1);
                await user.save();
            }
        } else {
            // Verify TOTP token
            verified = verify2FAToken(user.userPreferences.security.twoFactorSecret, token);
        }

        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code'
            });
        }

        res.json({
            success: true,
            message: '2FA verified successfully',
            data: {
                verified: true,
                remainingBackupCodes: user.userPreferences.security.twoFactorBackupCodes.length
            }
        });
    } catch (error) {
        console.error('2FA verify error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify 2FA',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/2fa/disable', protect, async (req, res) => {
    try {
        const { password, token } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required to disable 2FA'
            });
        }

        const user = await User.findById(req.user.id)
            .select('+password +userPreferences.security.twoFactorSecret +userPreferences.security.twoFactorBackupCodes');

        // Verify password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password'
            });
        }

        // Verify 2FA token if 2FA is enabled
        if (user.userPreferences.security.twoFactorEnabled && token) {
            const verified = verify2FAToken(user.userPreferences.security.twoFactorSecret, token);
            if (!verified) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid 2FA code'
                });
            }
        }

        // Disable 2FA
        user.userPreferences.security.twoFactorEnabled = false;
        user.userPreferences.security.twoFactorSecret = undefined;
        user.userPreferences.security.twoFactorBackupCodes = [];
        await user.save();

        res.json({
            success: true,
            message: '2FA disabled successfully'
        });
    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disable 2FA',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/auth/2fa/regenerate-backup-codes
 * @desc    Regenerate backup codes
 * @access  Private
 */
router.post('/2fa/regenerate-backup-codes', protect, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: '2FA code is required'
            });
        }

        const user = await User.findById(req.user.id)
            .select('+userPreferences.security.twoFactorSecret');

        if (!user.userPreferences.security.twoFactorEnabled) {
            return res.status(400).json({
                success: false,
                message: '2FA is not enabled'
            });
        }

        // Verify current token
        const verified = verify2FAToken(user.userPreferences.security.twoFactorSecret, token);
        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid 2FA code'
            });
        }

        // Generate new backup codes
        const backupCodes = generateBackupCodes(10);
        const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

        user.userPreferences.security.twoFactorBackupCodes = hashedBackupCodes;
        await user.save();

        res.json({
            success: true,
            message: 'Backup codes regenerated successfully',
            data: {
                backupCodes,
                message: 'Save these new backup codes. Old codes are now invalid.'
            }
        });
    } catch (error) {
        console.error('Regenerate backup codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to regenerate backup codes',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/auth/2fa/sms/send
 * @desc    Send SMS 2FA code
 * @access  Private
 */
router.post('/2fa/sms/send', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.phone) {
            return res.status(400).json({
                success: false,
                message: 'No phone number on file'
            });
        }

        // Generate 6-digit code
        const code = generateSMS2FACode();

        // Store code with 5-minute expiry
        user.userPreferences.security.sms2FACode = code;
        user.userPreferences.security.sms2FACodeExpire = Date.now() + 5 * 60 * 1000;
        await user.save();

        // Send SMS
        const result = await send2FACode(user.phone, code);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send SMS code',
                error: result.error
            });
        }

        res.json({
            success: true,
            message: 'Verification code sent to your phone',
            data: {
                phoneLastFour: user.phone.slice(-4),
                expiresIn: 300 // seconds
            }
        });
    } catch (error) {
        console.error('SMS 2FA send error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send SMS code',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/auth/2fa/sms/verify
 * @desc    Verify SMS 2FA code
 * @access  Private
 */
router.post('/2fa/sms/verify', protect, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Code is required'
            });
        }

        const user = await User.findById(req.user.id)
            .select('+userPreferences.security.sms2FACode +userPreferences.security.sms2FACodeExpire');

        if (!user.userPreferences.security.sms2FACode) {
            return res.status(400).json({
                success: false,
                message: 'No code sent. Please request a new code.'
            });
        }

        // Check expiration
        if (Date.now() > user.userPreferences.security.sms2FACodeExpire) {
            return res.status(400).json({
                success: false,
                message: 'Code expired. Please request a new code.'
            });
        }

        // Verify code
        if (code !== user.userPreferences.security.sms2FACode) {
            return res.status(400).json({
                success: false,
                message: 'Invalid code'
            });
        }

        // Clear code
        user.userPreferences.security.sms2FACode = undefined;
        user.userPreferences.security.sms2FACodeExpire = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'SMS code verified successfully'
        });
    } catch (error) {
        console.error('SMS 2FA verify error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify SMS code',
            error: error.message
        });
    }
});

module.exports = router;
