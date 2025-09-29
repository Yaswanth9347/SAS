// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

describe('SAS Basic API Tests', () => {
    beforeAll(async () => {
        console.log('Connecting to MongoDB:', process.env.MONGODB_URI_TEST);
        try {
            await mongoose.connect(process.env.MONGODB_URI_TEST, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ MongoDB connected for testing');
            await User.deleteMany({});
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            throw error;
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('Server should be running', async () => {
        const response = await request(app)
            .get('/api/test')
            .expect(200);

        expect(response.body.message).toBe('Backend is working!');
    });

    test('Should register a new user', async () => {
        const userData = {
            name: 'Test User',
            email: 'test@college.edu',
            password: '123456',
            collegeId: 'TEST001',
            department: 'CSE',
            year: 2,
            phone: '9876543210'
        };

        const response = await request(app)
            .post('/api/auth/register')
            .send(userData)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe(userData.email);
    });

    test('Should login with correct credentials', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@college.edu',
                password: '123456'
            })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
    });
});