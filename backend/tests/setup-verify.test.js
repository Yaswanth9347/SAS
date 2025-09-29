// MANUAL ENVIRONMENT SETUP - Add this to EVERY test file
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/sas_test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRE = '30d';
process.env.PORT = '5001';

describe('Setup Verification Test', () => {
    test('Environment variables should be set', () => {
        console.log('Verifying environment in test:');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('MONGODB_URI_TEST:', process.env.MONGODB_URI_TEST);
        console.log('JWT_SECRET:', process.env.JWT_SECRET);
        
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.MONGODB_URI_TEST).toBe('mongodb://localhost:27017/sas_test');
        expect(process.env.JWT_SECRET).toBe('test_jwt_secret_key_12345');
    });
});