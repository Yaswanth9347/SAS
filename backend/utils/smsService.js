const twilio = require('twilio');

/**
 * SMS Service using Twilio
 * Handles sending SMS notifications to users
 */

let twilioClient = null;

// Initialize Twilio client
const initTwilio = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && phoneNumber) {
        twilioClient = twilio(accountSid, authToken);
        console.log('✅ Twilio SMS service initialized');
        return true;
    } else {
        console.warn('⚠️ Twilio credentials not configured. SMS notifications disabled.');
        return false;
    }
};

// Check if SMS is configured
const isSmsConfigured = () => {
    return twilioClient !== null;
};

/**
 * Send SMS to a phone number
 * @param {string} to - Phone number (E.164 format: +1234567890)
 * @param {string} message - Message text (max 160 chars recommended)
 */
const sendSMS = async (to, message) => {
    try {
        if (!twilioClient) {
            const initialized = initTwilio();
            if (!initialized) {
                throw new Error('SMS service not configured');
            }
        }

        // Validate phone number format (basic)
        if (!to || !to.startsWith('+')) {
            throw new Error('Phone number must be in E.164 format (e.g., +1234567890)');
        }

        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });

        console.log(`📱 SMS sent successfully to ${to}. SID: ${result.sid}`);
        return {
            success: true,
            sid: result.sid,
            status: result.status
        };
    } catch (error) {
        console.error('❌ SMS sending failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send notification SMS
 * @param {object} params - Notification parameters
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.type - Notification type
 * @param {string} params.message - Message content
 */
const sendNotificationSMS = async ({ phone, type, message }) => {
    try {
        const prefix = type ? `[${type.toUpperCase()}] ` : '';
        const fullMessage = `${prefix}${message}\n\n- Spread A Smile`;

        return await sendSMS(phone, fullMessage);
    } catch (error) {
        console.error('Notification SMS error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send 2FA verification code
 */
const send2FACode = async (phone, code) => {
    const message = `Your Spread A Smile verification code is: ${code}\n\nThis code expires in 5 minutes.`;
    return await sendSMS(phone, message);
};

/**
 * Send visit reminder SMS
 */
const sendVisitReminderSMS = async (phone, visitDetails) => {
    const message = `Reminder: You have a visit scheduled at ${visitDetails.schoolName} on ${visitDetails.date}.\n\nSpread A Smile`;
    return await sendSMS(phone, message);
};

/**
 * Send password reset code via SMS
 */
const sendPasswordResetSMS = async (phone, code) => {
    const message = `Your password reset code is: ${code}\n\nValid for 1 hour.\n\nSpread A Smile`;
    return await sendSMS(phone, message);
};

// Initialize on module load
if (process.env.NODE_ENV !== 'test') {
    initTwilio();
}

module.exports = {
    initTwilio,
    isSmsConfigured,
    sendSMS,
    sendNotificationSMS,
    send2FACode,
    sendVisitReminderSMS,
    sendPasswordResetSMS
};
