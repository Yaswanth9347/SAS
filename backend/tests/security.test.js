// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('SAS Security Tests', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI_TEST, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('Should reject requests without authentication for protected routes', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .expect(401);

        expect(response.body.success).toBe(false);
    });

    test('Should reject invalid JWT tokens', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid-token')
            .expect(401);

        expect(response.body.success).toBe(false);
    });

    test('Should validate email format', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'invalid-email',
                password: '123456',
                collegeId: 'TEST001',
                department: 'CSE',
                year: 2,
                phone: '9876543210'
            })
            .expect(400);

        expect(response.body.success).toBe(false);
    });
});