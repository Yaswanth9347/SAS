#!/usr/bin/env node

console.log('🧪 Starting SAS Tests...\n');

// Set environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/sas_test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRE = '30d';
process.env.PORT = '5001';

console.log('🔧 Environment configured:');
console.log('   MONGODB_URI_TEST:', process.env.MONGODB_URI_TEST);
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Not Set');
console.log('');

const { spawn } = require('child_process');

// Run Jest directly without config file
const jest = spawn('npx', ['jest', 'tests/', '--verbose', '--colors', '--no-cache'], {
    stdio: 'inherit',
    shell: true
});

jest.on('close', (code) => {
    console.log('\n' + '='.repeat(50));
    if (code === 0) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('✅ Your SAS application is working correctly.');
    } else {
        console.log('❌ Some tests failed.');
        console.log('💡 Check the output above for details.');
    }
    process.exit(code);
});
