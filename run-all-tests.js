#!/usr/bin/env node

// Set environment variables for ALL tests
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/sas_test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRE = '30d';
process.env.PORT = '5001';

console.log('🚀 SAS Test Runner');
console.log('==================\n');
console.log('🔧 Environment configured:');
console.log('   MONGODB_URI_TEST:', process.env.MONGODB_URI_TEST);
console.log('   JWT_SECRET:', process.env.JWT_SECRET);
console.log('');

const { spawn } = require('child_process');

const jest = spawn('npx', ['jest', 'tests/', '--verbose', '--colors'], {
    stdio: 'inherit',
    shell: true
});

jest.on('close', (code) => {
    console.log('\n==================');
    if (code === 0) {
        console.log('✅ ALL TESTS PASSED!');
        console.log('🎉 Your SAS application is working correctly.');
    } else {
        console.log('❌ Some tests failed.');
        console.log('💡 Check the test output above for details.');
    }
    process.exit(code);
});