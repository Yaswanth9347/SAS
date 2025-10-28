const nodemailer = require('nodemailer');

const isProdLike = /^(production|staging)$/i.test(process.env.NODE_ENV || '');

function requireEnv(name) {
    const v = process.env[name];
    if (isProdLike && (!v || String(v).trim() === '')) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return v;
}

// Best-effort startup check (does not throw to avoid blocking server boot)
function checkEmailConfig() {
    if (!isProdLike) return { ok: true, env: 'dev' };
    const required = ['EMAIL_HOST','EMAIL_PORT','EMAIL_USER','EMAIL_PASSWORD','FROM_NAME','FROM_EMAIL','FRONTEND_URL'];
    const missing = required.filter(k => !process.env[k] || String(process.env[k]).trim() === '');
    if (missing.length) {
        console.warn('[email] Missing required email env vars in', process.env.NODE_ENV, ':', missing.join(', '));
        return { ok: false, missing };
    }

    // Additional soft validations for production/staging
    const freeDomains = new Set(['gmail.com','yahoo.com','outlook.com','hotmail.com','live.com','aol.com','proton.me','icloud.com','yandex.com']);
    const fromEmail = String(process.env.FROM_EMAIL || '').toLowerCase();
    const fromDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : '';
    if (fromDomain && freeDomains.has(fromDomain)) {
        console.warn('[email] Warning: FROM_EMAIL uses a free mailbox domain (', fromDomain, '). Use a verified domain you control for best deliverability.');
    }

    try {
        const u = new URL(process.env.FRONTEND_URL);
        if (u.protocol !== 'https:') {
            console.warn('[email] Warning: FRONTEND_URL is not HTTPS. Use HTTPS in production/staging.');
        }
        if (['localhost','127.0.0.1'].includes(u.hostname)) {
            console.warn('[email] Warning: FRONTEND_URL points to localhost; update this for production/staging.');
        }
    } catch {
        console.warn('[email] Warning: FRONTEND_URL is not a valid URL.');
    }

    return { ok: true };
}

// Create reusable transporter
const createTransporter = () => {
    // For development: Use environment variables or Gmail
    // For production: Use SendGrid, AWS SES, or other email service
    const host = process.env.EMAIL_HOST || (!isProdLike ? 'smtp.gmail.com' : undefined);
    const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : (!isProdLike ? 587 : undefined);
    const user = process.env.EMAIL_USER || (!isProdLike ? 'dev@example.com' : undefined);
    const pass = process.env.EMAIL_PASSWORD || (!isProdLike ? 'dev-password' : undefined);

    if (isProdLike) {
        // Enforce presence in prod/staging
        requireEnv('EMAIL_HOST');
        requireEnv('EMAIL_PORT');
        requireEnv('EMAIL_USER');
        requireEnv('EMAIL_PASSWORD');
    } else {
        // Warn in dev if missing
        if (!host || !port || !user || !pass) {
            console.warn('[email] Using incomplete dev email config. Set EMAIL_* env vars for realistic testing.');
        }
    }

    const secure = Number(port) === 465; // SSL port
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        // Harden TLS and timeouts
        tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
        connectionTimeout: 15_000,
        socketTimeout: 20_000
    });

    return transporter;
};

// Send email
const sendEmail = async (options) => {
    try {
        const transporter = createTransporter();
        
        const fromName = process.env.FROM_NAME || 'Spread A Smile';
        const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER;
        if (isProdLike) {
            // Require explicit sender identity in prod/staging
            requireEnv('FROM_NAME');
            requireEnv('FROM_EMAIL');
        }

        const message = {
            from: `${fromName} <${fromEmail}>`,
            to: options.email,
            subject: options.subject,
            html: options.html,
            text: options.text
        };
        
        const info = await transporter.sendMail(message);
        
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email error:', {
            message: error.message,
            code: error.code,
            command: error.command,
            to: options?.email ? String(options.email).replace(/(.{2}).+(@.+)/, '$1***$2') : undefined,
            subject: options?.subject
        });
        return { success: false, error: 'EMAIL_SEND_FAILED' };
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
    const resetBase = process.env.FRONTEND_URL || (!isProdLike ? 'http://localhost:5001/frontend' : undefined);
    if (isProdLike && !resetBase) {
        throw new Error('Missing FRONTEND_URL for password reset link');
    }
    const resetUrl = `${resetBase}/reset-password.html?token=${resetToken}`;
    
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

// Additional templates for notifications
const buildSimpleTemplate = (title, greeting, bodyHtml, bodyText) => {
    const year = new Date().getFullYear();
    const html = `
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"><style>
        body{font-family:Arial,Helvetica,sans-serif;color:#333}
        .container{max-width:600px;margin:20px auto;padding:20px;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1)}
        .header{background:#2e7d32;color:#fff;padding:16px;border-radius:8px 8px 0 0}
        .content{padding:20px}
        </style></head><body>
          <div class="container">
            <div class="header"><h2>🌟 Spread A Smile</h2></div>
            <div class="content">
              <h3>${title}</h3>
              <p>${greeting}</p>
              ${bodyHtml}
              <p>— Spread A Smile Team</p>
            </div>
            <div style="text-align:center;color:#777;font-size:12px;margin-top:10px">© ${year} Spread A Smile</div>
          </div>
        </body></html>`;
    const text = `${title}\n\n${greeting}\n\n${bodyText}\n\n— Spread A Smile Team`;
    return { html, text };
};

async function sendVisitScheduledEmail(user, meta) {
    const when = meta?.date ? new Date(meta.date).toLocaleString() : 'the scheduled time';
    const school = meta?.schoolName || 'a school';
    const { html, text } = buildSimpleTemplate(
        'Visit Scheduled',
        `Hi ${user.name},`,
        `<p>A new visit has been scheduled at <strong>${school}</strong> on <strong>${when}</strong>.</p>`,
        `A new visit has been scheduled at ${school} on ${when}.`
    );
    return sendEmail({ email: user.email, subject: 'Visit Scheduled - Spread A Smile', html, text });
}

async function sendVisitReminderEmail(user, meta) {
    const when = meta?.date ? new Date(meta.date).toLocaleString() : 'the scheduled time';
    const { html, text } = buildSimpleTemplate(
        'Visit Reminder (24 hours)',
        `Hi ${user.name},`,
        `<p>This is a reminder for your visit scheduled on <strong>${when}</strong>.</p>`,
        `This is a reminder for your visit scheduled on ${when}.`
    );
    return sendEmail({ email: user.email, subject: 'Visit Reminder - Spread A Smile', html, text });
}

async function sendReportDeadlineEmail(user, meta) {
    const deadline = meta?.deadline ? new Date(meta.deadline).toLocaleString() : 'the deadline time';
    const { html, text } = buildSimpleTemplate(
        'Report Submission Reminder',
        `Hi ${user.name},`,
        `<p>Please submit your visit report before <strong>${deadline}</strong>.</p>`,
        `Please submit your visit report before ${deadline}.`
    );
    return sendEmail({ email: user.email, subject: 'Report Submission Reminder - Spread A Smile', html, text });
}

async function sendTeamAssignmentEmail(user, meta) {
    const teamName = meta?.teamName || 'your new team';
    const { html, text } = buildSimpleTemplate(
        'Team Assignment Update',
        `Hi ${user.name},`,
        `<p>You have been assigned to <strong>${teamName}</strong>.</p>`,
        `You have been assigned to ${teamName}.`
    );
    return sendEmail({ email: user.email, subject: 'Team Assignment Update - Spread A Smile', html, text });
}

module.exports = {
    sendEmail,
    sendPasswordResetEmail,
    sendPasswordResetConfirmation,
    sendVisitScheduledEmail,
    sendVisitReminderEmail,
    sendReportDeadlineEmail,
    sendTeamAssignmentEmail,
    checkEmailConfig
};
