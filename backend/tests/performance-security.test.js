// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('SAS Performance & Security Tests', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI_TEST, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('API response time should be reasonable', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
            .get('/api/test');
        
        const responseTime = Date.now() - startTime;
        
        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(1000); // Under 1 second
    });

    test('Should handle concurrent requests', async () => {
        const requests = Array(5).fill().map(() => 
            request(app).get('/api/test')
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
            expect(response.status).toBe(200);
        });
    });

    test('Should reject invalid JWT tokens', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid-token-here')
            .expect(401);

        expect(response.body.success).toBe(false);
    });

    test('Should validate email format', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'invalid-email-format',
                password: '123456',
                collegeId: 'TEST001',
                department: 'CSE',
                year: 2,
                phone: '9876543210'
            })
            .expect(400);

        expect(response.body.success).toBe(false);
    });

    test('Should require strong passwords', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test2@college.edu',
                password: '123', // Too short
                collegeId: 'TEST002',
                department: 'CSE',
                year: 2,
                phone: '9876543210'
            })
            .expect(400);

        expect(response.body.success).toBe(false);
    });
});