const { sendEmail } = require('../utils/emailService');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function test() {
    console.log('Attempting to send test email...');
    const user = process.env.EMAIL_USER;
    const to = process.env.FROM_EMAIL || user;

    if (!user) {
        console.error('No EMAIL_USER defined');
        return;
    }
    console.log('User:', user);
    console.log('Pass length:', process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.length : 0);
    console.log('Pass start:', process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.substring(0, 3) : 'N/A');

    const result = await sendEmail({
        email: to,
        subject: 'Test Email from Script',
        html: '<p>This is a test.</p>',
        text: 'This is a test.'
    });

    if (result.success) {
        console.log('✅ Email sent successfully!');
        if (result.messageId) console.log('Message ID:', result.messageId);
    } else {
        console.error('❌ Email failed to send.');
        console.error('Error:', result.error);
        if (result.error && result.error.includes('Username and Password not accepted')) {
            console.log('\n💡 Tip: If using Gmail, you likely need to use an App Password instead of your login password.');
            console.log('   Go to My Account > Security > 2-Step Verification > App Passwords.');
        }
    }
}

test();
