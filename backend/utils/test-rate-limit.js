/**
 * Rate Limiting Test Utility
 * 
 * Tests rate limiting configuration by making multiple requests
 * Run: node backend/utils/test-rate-limit.js
 */

const axios = require('axios');

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

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

async function testGlobalRateLimit() {
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║           TEST 1: Global API Rate Limiting                    ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    log('📊 Testing global API rate limit...', 'blue');
    log(`   Endpoint: GET ${BASE_URL}/api/health`, 'blue');
    log(`   Expected Limit: 100 requests per 15 minutes\n`, 'blue');

    let successCount = 0;
    let rateLimitedCount = 0;
    let lastRateLimitInfo = null;

    // Make 110 requests to trigger rate limit
    for (let i = 1; i <= 110; i++) {
        try {
            const response = await axios.get(`${BASE_URL}/api/health`);
            
            // Check rate limit headers
            const remaining = response.headers['ratelimit-remaining'];
            const limit = response.headers['ratelimit-limit'];
            
            successCount++;
            
            if (i % 10 === 0) {
                log(`   ✅ Request ${i}: Success (Remaining: ${remaining}/${limit})`, 'green');
            }
            
            lastRateLimitInfo = {
                limit,
                remaining,
                reset: response.headers['ratelimit-reset']
            };
        } catch (error) {
            if (error.response && error.response.status === 429) {
                rateLimitedCount++;
                const retryAfter = error.response.data.retryAfter || 'unknown';
                log(`   🚫 Request ${i}: Rate limited (Retry after: ${retryAfter}s)`, 'red');
                
                if (rateLimitedCount === 1) {
                    log(`\n   ✅ Rate limit triggered at request ${i}!`, 'green');
                    break;
                }
            } else {
                log(`   ❌ Request ${i}: Error - ${error.message}`, 'red');
            }
        }
    }

    log('\n📊 Global Rate Limit Test Results:', 'cyan');
    log(`   Successful requests: ${successCount}`, successCount > 0 ? 'green' : 'red');
    log(`   Rate limited requests: ${rateLimitedCount}`, rateLimitedCount > 0 ? 'green' : 'yellow');
    
    if (lastRateLimitInfo) {
        log(`   Rate limit: ${lastRateLimitInfo.limit} requests`, 'blue');
        log(`   Last remaining: ${lastRateLimitInfo.remaining}`, 'blue');
    }

    return rateLimitedCount > 0;
}

async function testAuthRateLimit() {
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║         TEST 2: Authentication Rate Limiting                  ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    log('📊 Testing authentication rate limit...', 'blue');
    log(`   Endpoint: POST ${BASE_URL}/api/auth/login`, 'blue');
    log(`   Expected Limit: 50 requests per 15 minutes\n`, 'blue');

    let successCount = 0;
    let failedCount = 0;
    let rateLimitedCount = 0;

    // Make 55 login attempts to trigger rate limit
    for (let i = 1; i <= 55; i++) {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: 'test@example.com',
                password: 'wrongpassword123'
            });
            
            successCount++;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                rateLimitedCount++;
                if (rateLimitedCount === 1) {
                    log(`   🚫 Request ${i}: Rate limited!`, 'red');
                    log(`   ✅ Auth rate limit triggered at request ${i}!`, 'green');
                    break;
                }
            } else if (error.response && error.response.status === 401) {
                failedCount++;
                if (i % 10 === 0) {
                    log(`   ⚠️  Request ${i}: Auth failed (expected)`, 'yellow');
                }
            } else {
                log(`   ❌ Request ${i}: Error - ${error.message}`, 'red');
            }
        }
    }

    log('\n📊 Auth Rate Limit Test Results:', 'cyan');
    log(`   Successful requests: ${successCount}`, 'blue');
    log(`   Failed auth (expected): ${failedCount}`, 'yellow');
    log(`   Rate limited requests: ${rateLimitedCount}`, rateLimitedCount > 0 ? 'green' : 'red');

    return rateLimitedCount > 0;
}

async function testPasswordResetRateLimit() {
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║       TEST 3: Password Reset Rate Limiting                    ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    log('📊 Testing password reset rate limit...', 'blue');
    log(`   Endpoint: POST ${BASE_URL}/api/auth/forgot-password`, 'blue');
    log(`   Expected Limit: 10 requests per hour\n`, 'blue');

    let successCount = 0;
    let rateLimitedCount = 0;

    // Make 12 password reset requests to trigger rate limit
    for (let i = 1; i <= 12; i++) {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
                email: 'test@example.com'
            });
            
            successCount++;
            if (i % 2 === 0) {
                log(`   ✅ Request ${i}: Success`, 'green');
            }
        } catch (error) {
            if (error.response && error.response.status === 429) {
                rateLimitedCount++;
                log(`   🚫 Request ${i}: Rate limited!`, 'red');
                
                if (rateLimitedCount === 1) {
                    log(`   ✅ Password reset rate limit triggered at request ${i}!`, 'green');
                    break;
                }
            } else {
                // Might fail due to invalid email, that's ok
                if (i % 2 === 0) {
                    log(`   ⚠️  Request ${i}: ${error.response?.data?.error || error.message}`, 'yellow');
                }
            }
        }
    }

    log('\n📊 Password Reset Rate Limit Test Results:', 'cyan');
    log(`   Successful requests: ${successCount}`, 'blue');
    log(`   Rate limited requests: ${rateLimitedCount}`, rateLimitedCount > 0 ? 'green' : 'red');

    return rateLimitedCount > 0;
}

async function checkServerStatus() {
    try {
        const response = await axios.get(`${BASE_URL}/api/health`);
        log('✅ Server is running and accessible', 'green');
        return true;
    } catch (error) {
        log(`❌ Cannot connect to server at ${BASE_URL}`, 'red');
        log(`   Error: ${error.message}`, 'red');
        log(`\n💡 Tip: Start the server first with: cd backend && node server.js`, 'yellow');
        return false;
    }
}

async function runAllTests() {
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║           RATE LIMITING TEST SUITE                            ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    log(`🔍 Testing server at: ${BASE_URL}`, 'blue');
    
    // Check if server is running
    const serverOk = await checkServerStatus();
    if (!serverOk) {
        process.exit(1);
    }

    const results = {
        global: false,
        auth: false,
        passwordReset: false
    };

    // Run tests with delay between them to avoid interference
    log('\n⏳ Running tests (this may take a minute)...\n', 'yellow');

    try {
        results.global = await testGlobalRateLimit();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

        results.auth = await testAuthRateLimit();
        await new Promise(resolve => setTimeout(resolve, 2000));

        results.passwordReset = await testPasswordResetRateLimit();
    } catch (error) {
        log(`\n❌ Unexpected error: ${error.message}`, 'red');
    }

    // Summary
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                      TEST SUMMARY                              ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    const passedTests = Object.values(results).filter(r => r === true).length;
    const totalTests = Object.keys(results).length;

    log(`Tests Passed: ${passedTests}/${totalTests}\n`, passedTests === totalTests ? 'green' : 'yellow');
    log(`Detailed Results:`, 'blue');
    log(`  Global API Rate Limit: ${results.global ? '✅ WORKING' : '❌ NOT TRIGGERED'}`, results.global ? 'green' : 'red');
    log(`  Auth Rate Limit: ${results.auth ? '✅ WORKING' : '❌ NOT TRIGGERED'}`, results.auth ? 'green' : 'red');
    log(`  Password Reset Rate Limit: ${results.passwordReset ? '✅ WORKING' : '❌ NOT TRIGGERED'}`, results.passwordReset ? 'green' : 'red');

    if (passedTests === totalTests) {
        log('\n🎉 All rate limiting tests passed! Your API is protected.', 'green');
        log('\n📝 Rate limiting is working correctly:', 'blue');
        log('   ✅ Global API protection active', 'blue');
        log('   ✅ Authentication protection active', 'blue');
        log('   ✅ Password reset protection active', 'blue');
    } else {
        log('\n⚠️  Some rate limits may not be configured correctly.', 'yellow');
        log('\n🔧 Check:', 'yellow');
        log('   1. Rate limit environment variables in .env', 'yellow');
        log('   2. Server logs for rate limit messages', 'yellow');
        log('   3. express-rate-limit package is installed', 'yellow');
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
    testGlobalRateLimit,
    testAuthRateLimit,
    testPasswordResetRateLimit
};
