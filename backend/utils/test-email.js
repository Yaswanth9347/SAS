/**
 * Email Service Test Utility
 * 
 * Tests email configuration and sends test emails
 * Run: node backend/utils/test-email.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sendPasswordResetEmail, sendWelcomeEmail, sendContactFormEmail } = require('./emailService');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEmailConfiguration() {
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                EMAIL CONFIGURATION TEST                        ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    // Check environment variables
    log('📋 Checking Email Configuration...', 'blue');
    
    const requiredVars = [
        'EMAIL_HOST',
        'EMAIL_PORT',
        'EMAIL_USER',
        'EMAIL_PASSWORD',
        'FROM_NAME',
        'FROM_EMAIL',
        'FRONTEND_URL'
    ];

    const missingVars = [];
    const configuredVars = [];

    requiredVars.forEach(varName => {
        const value = process.env[varName];
        if (!value || value === 'your.email@gmail.com' || value === 'your_gmail_app_password_16_chars') {
            missingVars.push(varName);
            log(`   ❌ ${varName}: Not configured`, 'red');
        } else {
            configuredVars.push(varName);
            // Mask sensitive values
            if (varName.includes('PASSWORD')) {
                log(`   ✅ ${varName}: ********`, 'green');
            } else {
                log(`   ✅ ${varName}: ${value}`, 'green');
            }
        }
    });

    if (missingVars.length > 0) {
        log('\n⚠️  Warning: Some email configuration variables are missing or not properly set:', 'yellow');
        missingVars.forEach(varName => {
            log(`   - ${varName}`, 'yellow');
        });
        log('\n📝 To fix:', 'yellow');
        log('   1. Copy backend/.env.example to backend/.env', 'yellow');
        log('   2. Configure email settings in backend/.env', 'yellow');
        log('   3. For Gmail: Generate App Password at https://myaccount.google.com/apppasswords', 'yellow');
        return false;
    }

    log('\n✅ All required email configuration variables are set!', 'green');
    return true;
}

async function testPasswordResetEmail() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('📧 Test 1: Password Reset Email', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

    const testUser = {
        name: 'Test User',
        email: process.env.EMAIL_USER || 'test@example.com'
    };

    const testToken = 'test_reset_token_123456789';

    try {
        log(`   Sending to: ${testUser.email}`, 'blue');
        const result = await sendPasswordResetEmail(testUser, testToken);
        
        if (result.accepted && result.accepted.length > 0) {
            log('   ✅ Password reset email sent successfully!', 'green');
            log(`   Message ID: ${result.messageId}`, 'green');
            return true;
        } else {
            log('   ❌ Email was rejected', 'red');
            log(`   Response: ${JSON.stringify(result)}`, 'red');
            return false;
        }
    } catch (error) {
        log('   ❌ Failed to send password reset email', 'red');
        log(`   Error: ${error.message}`, 'red');
        if (error.code) log(`   Code: ${error.code}`, 'red');
        return false;
    }
}

async function testWelcomeEmail() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('📧 Test 2: Welcome Email', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

    const testUser = {
        name: 'Test User',
        email: process.env.EMAIL_USER || 'test@example.com',
        role: 'volunteer'
    };

    try {
        log(`   Sending to: ${testUser.email}`, 'blue');
        const result = await sendWelcomeEmail(testUser);
        
        if (result.accepted && result.accepted.length > 0) {
            log('   ✅ Welcome email sent successfully!', 'green');
            log(`   Message ID: ${result.messageId}`, 'green');
            return true;
        } else {
            log('   ❌ Email was rejected', 'red');
            return false;
        }
    } catch (error) {
        log('   ❌ Failed to send welcome email', 'red');
        log(`   Error: ${error.message}`, 'red');
        return false;
    }
}

async function testContactFormEmail() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    log('📧 Test 3: Contact Form Email', 'blue');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

    const contactData = {
        name: 'Test User',
        email: process.env.EMAIL_USER || 'test@example.com',
        subject: 'Test Contact Form Submission',
        message: 'This is a test message from the email service test utility.'
    };

    try {
        log(`   Sending from: ${contactData.email}`, 'blue');
        const result = await sendContactFormEmail(contactData);
        
        if (result.accepted && result.accepted.length > 0) {
            log('   ✅ Contact form email sent successfully!', 'green');
            log(`   Message ID: ${result.messageId}`, 'green');
            return true;
        } else {
            log('   ❌ Email was rejected', 'red');
            return false;
        }
    } catch (error) {
        log('   ❌ Failed to send contact form email', 'red');
        log(`   Error: ${error.message}`, 'red');
        return false;
    }
}

async function runAllTests() {
    const configOk = await testEmailConfiguration();
    
    if (!configOk) {
        log('\n❌ Email configuration is incomplete. Please configure email settings first.', 'red');
        process.exit(1);
    }

    const results = {
        passwordReset: false,
        welcome: false,
        contactForm: false
    };

    results.passwordReset = await testPasswordResetEmail();
    results.welcome = await testWelcomeEmail();
    results.contactForm = await testContactFormEmail();

    // Summary
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                      TEST SUMMARY                              ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    const passedTests = Object.values(results).filter(r => r === true).length;
    const totalTests = Object.keys(results).length;

    log(`Tests Passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');
    log(`\nDetailed Results:`, 'blue');
    log(`  Password Reset Email: ${results.passwordReset ? '✅ PASS' : '❌ FAIL'}`, results.passwordReset ? 'green' : 'red');
    log(`  Welcome Email: ${results.welcome ? '✅ PASS' : '❌ FAIL'}`, results.welcome ? 'green' : 'red');
    log(`  Contact Form Email: ${results.contactForm ? '✅ PASS' : '❌ FAIL'}`, results.contactForm ? 'green' : 'red');

    if (passedTests === totalTests) {
        log('\n🎉 All email tests passed! Your email service is configured correctly.', 'green');
        log('\n📝 Next Steps:', 'blue');
        log('   1. Check your inbox for the test emails', 'blue');
        log('   2. Verify emails are not in spam folder', 'blue');
        log('   3. Test password reset flow in the application', 'blue');
        process.exit(0);
    } else {
        log('\n⚠️  Some email tests failed. Please check your configuration.', 'yellow');
        log('\n🔧 Common Issues:', 'yellow');
        log('   1. Gmail App Password not generated or incorrect', 'yellow');
        log('   2. Gmail "Less secure app access" needs to be enabled', 'yellow');
        log('   3. SMTP host/port incorrect', 'yellow');
        log('   4. Firewall blocking SMTP port 587', 'yellow');
        log('   5. Email service provider credentials expired', 'yellow');
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    runAllTests().catch(error => {
        log(`\n❌ Unexpected error: ${error.message}`, 'red');
        process.exit(1);
    });
}

module.exports = {
    testEmailConfiguration,
    testPasswordResetEmail,
    testWelcomeEmail,
    testContactFormEmail
};
