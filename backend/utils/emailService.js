const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
    // For development: Use environment variables or Gmail
    // For production: Use SendGrid, AWS SES, or other email service
    
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER || 'your-email@gmail.com',
            pass: process.env.EMAIL_PASSWORD || 'your-app-password'
        }
    });
};

// Send email
const sendEmail = async (options) => {
    try {
        const transporter = createTransporter();
        
        const message = {
            from: `${process.env.FROM_NAME || 'Spread A Smile'} <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            html: options.html,
            text: options.text
        };
        
        const info = await transporter.sendMail(message);
        
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email error:', error);
        return { success: false, error: error.message };
    }
};

// Password reset email template
const getPasswordResetEmailHTML = (resetUrl, name) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header {
                    background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                }
                .content {
                    padding: 40px 30px;
                }
                .content h2 {
                    color: #2e7d32;
                    margin-top: 0;
                }
                .button {
                    display: inline-block;
                    padding: 14px 28px;
                    background: #2e7d32;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    margin: 20px 0;
                }
                .button:hover {
                    background: #1b5e20;
                }
                .link-text {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 5px;
                    word-break: break-all;
                    font-size: 12px;
                    color: #666;
                    margin: 20px 0;
                }
                .footer {
                    background: #f9f9f9;
                    padding: 20px 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                    border-top: 1px solid #e0e0e0;
                }
                .warning {
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }
                .info {
                    background: #e3f2fd;
                    border-left: 4px solid #2196f3;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌟 Spread A Smile</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hi ${name},</p>
                    <p>We received a request to reset your password for your Spread A Smile account. Click the button below to reset your password:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </div>
                    
                    <div class="info">
                        <strong>⏰ This link expires in 1 hour</strong>
                    </div>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <div class="link-text">${resetUrl}</div>
                    
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong><br>
                        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                    </div>
                    
                    <p>If you're having trouble, please contact our support team.</p>
                    
                    <p>Best regards,<br>The Spread A Smile Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated email. Please do not reply to this message.</p>
                    <p>&copy; ${new Date().getFullYear()} Spread A Smile. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

// Plain text version for email clients that don't support HTML
const getPasswordResetEmailText = (resetUrl, name) => {
    return `
Hi ${name},

We received a request to reset your password for your Spread A Smile account.

To reset your password, please visit the following link:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

If you're having trouble, please contact our support team.

Best regards,
The Spread A Smile Team

---
This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} Spread A Smile. All rights reserved.
    `;
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5001/frontend'}/reset-password.html?token=${resetToken}`;
    
    const html = getPasswordResetEmailHTML(resetUrl, user.name);
    const text = getPasswordResetEmailText(resetUrl, user.name);
    
    return await sendEmail({
        email: user.email,
        subject: 'Password Reset Request - Spread A Smile',
        html,
        text
    });
};

// Password reset confirmation email
const sendPasswordResetConfirmation = async (user) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 20px auto; padding: 20px; background: white; border-radius: 8px; }
                .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { padding: 30px 20px; }
                .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🌟 Spread A Smile</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Successful</h2>
                    <p>Hi ${user.name},</p>
                    
                    <div class="success">
                        ✅ Your password has been successfully reset!
                    </div>
                    
                    <p>You can now log in to your account using your new password.</p>
                    
                    <p>If you did not make this change, please contact our support team immediately.</p>
                    
                    <p>Best regards,<br>The Spread A Smile Team</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const text = `
Hi ${user.name},

Your password has been successfully reset!

You can now log in to your account using your new password.

If you did not make this change, please contact our support team immediately.

Best regards,
The Spread A Smile Team
    `;
    
    return await sendEmail({
        email: user.email,
        subject: 'Password Reset Successful - Spread A Smile',
        html,
        text
    });
};

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    sendPasswordResetConfirmation
};
