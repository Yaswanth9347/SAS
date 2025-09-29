// This runs BEFORE tests
console.log('🔧 Loading test environment...');

// Force set ALL test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/sas_test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRE = '30d';
process.env.PORT = '5001';

console.log('✅ Test environment configured:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   MONGODB_URI_TEST:', process.env.MONGODB_URI_TEST);
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Not Set');