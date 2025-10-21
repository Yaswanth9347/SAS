// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
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
            username: 'testuser',
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
                username: 'testuser',
                password: '123456'
            })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
    });
});

describe('Role-based access control tests', () => {
    let adminToken, volunteerToken, expiredToken;
    beforeAll(() => {
        adminToken = jwt.sign({ id: 'admin-id', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        volunteerToken = jwt.sign({ id: 'volunteer-id', role: 'volunteer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        expiredToken = jwt.sign({ id: 'user', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '-1h' });
    });

    test('Volunteer cannot access admin route returns 403', async () => {
        const res = await request(app)
            .get('/api/admin/')
            .set('Authorization', `Bearer ${volunteerToken}`);
        expect(res.status).toBe(403);
    });

    test('Admin can access admin route returns 200', async () => {
        const res = await request(app)
            .get('/api/admin/')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('Volunteer can access volunteer route returns 200', async () => {
        const res = await request(app)
            .get('/api/volunteers/')
            .set('Authorization', `Bearer ${volunteerToken}`);
        expect(res.status).toBe(200);
    });

    test('Expired token results in 401 Unauthorized', async () => {
        const res = await request(app)
            .get('/api/volunteers/')
            .set('Authorization', `Bearer ${expiredToken}`);
        expect(res.status).toBe(401);
    });
});