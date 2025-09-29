// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

describe('Debug Environment Test', () => {
    test('Environment variables should be set', () => {
        console.log('Environment Variables:');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('MONGODB_URI_TEST:', process.env.MONGODB_URI_TEST);
        console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not Set');
        
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.MONGODB_URI_TEST).toBe('mongodb://localhost:27017/sas_test');
        expect(process.env.JWT_SECRET).toBe('test_jwt_secret_key_12345');
    });
});