const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Two-Factor Authentication Service
 * Handles TOTP-based 2FA using speakeasy
 */

/**
 * Generate 2FA secret for a user
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's name
 * @returns {object} Secret and otpauth_url
 */
const generate2FASecret = (userEmail, userName) => {
    const secret = speakeasy.generateSecret({
        name: `Spread A Smile (${userEmail})`,
        issuer: 'Spread A Smile',
        length: 32
    });

    return {
        secret: secret.base32, // Store this in database
        otpauth_url: secret.otpauth_url, // Use this for QR code
        tempSecret: secret.ascii // Temporary format
    };
};

/**
 * Generate QR code data URL from otpauth_url
 * @param {string} otpauth_url - OTP auth URL from secret generation
 * @returns {Promise<string>} Data URL for QR code image
 */
const generateQRCode = async (otpauth_url) => {
    try {
        const dataUrl = await QRCode.toDataURL(otpauth_url);
        return dataUrl;
    } catch (error) {
        console.error('QR Code generation error:', error);
        throw new Error('Failed to generate QR code');
    }
};

/**
 * Verify 2FA token
 * @param {string} secret - User's 2FA secret (base32)
 * @param {string} token - 6-digit token from authenticator app
 * @param {number} window - Time window for token validity (default: 2)
 * @returns {boolean} True if valid
 */
const verify2FAToken = (secret, token, window = 2) => {
    try {
        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: window // Allows for slight time drift
        });

        return verified;
    } catch (error) {
        console.error('2FA verification error:', error);
        return false;
    }
};

/**
 * Generate backup codes for 2FA
 * @param {number} count - Number of backup codes to generate (default: 10)
 * @returns {array} Array of backup codes
 */
const generateBackupCodes = (count = 10) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric code
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        codes.push(code);
    }
    return codes;
};

/**
 * Hash backup code for storage
 * @param {string} code - Backup code
 * @returns {string} Hashed code
 */
const hashBackupCode = (code) => {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(code).digest('hex');
};

/**
 * Verify backup code
 * @param {string} code - Code entered by user
 * @param {array} hashedCodes - Array of hashed backup codes
 * @returns {object} { valid: boolean, codeIndex: number }
 */
const verifyBackupCode = (code, hashedCodes) => {
    const hashedInput = hashBackupCode(code);
    const index = hashedCodes.indexOf(hashedInput);

    return {
        valid: index !== -1,
        codeIndex: index
    };
};

/**
 * Generate SMS-based 2FA code (6-digit numeric)
 * @returns {string} 6-digit code
 */
const generateSMS2FACode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
    generate2FASecret,
    generateQRCode,
    verify2FAToken,
    generateBackupCodes,
    hashBackupCode,
    verifyBackupCode,
    generateSMS2FACode
};
