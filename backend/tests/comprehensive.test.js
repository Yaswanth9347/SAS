// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const School = require('../models/School');

describe('SAS Comprehensive Tests', () => {
    let volunteerToken;
    let adminToken;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI_TEST, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        // Clear existing data
        await User.deleteMany({});
        await School.deleteMany({});

        // Create admin user directly in database (more reliable)
        const adminUser = await User.create({
            name: 'Test Admin',
            username: 'admin',
            email: 'admin@sas.org',
            password: 'admin123',
            collegeId: 'ADMIN001',
            department: 'ADMIN',
            year: 4,
            phone: '9999999999',
            role: 'admin'
        });

        // Login as admin to get token
        const adminLoginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'admin',
                password: 'admin123'
            });
        
        if (adminLoginResponse.body.token) {
            adminToken = adminLoginResponse.body.token;
            console.log('✅ Admin token obtained successfully');
        } else {
            console.log('❌ Admin login failed:', adminLoginResponse.body);
            // Fallback: create a simple token manually for testing
            const jwt = require('jsonwebtoken');
            adminToken = jwt.sign(
                { id: adminUser._id, role: 'admin' }, 
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
            );
        }

        // Create volunteer user
        const volunteerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test Volunteer',
                username: 'volunteer',
                email: 'volunteer@college.edu',
                password: '123456',
                collegeId: 'VOL001',
                department: 'CSE',
                year: 2,
                phone: '8888888888'
            });
        volunteerToken = volunteerResponse.body.token;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('Volunteer registration and login', async () => {
        const userData = {
            name: 'New Volunteer',
            username: 'newvolunteer',
            email: 'newvolunteer@college.edu',
            password: '123456',
            collegeId: 'NEWVOL001',
            department: 'ECE',
            year: 3,
            phone: '7777777777'
        };

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(userData)
            .expect(200);

        expect(registerResponse.body.success).toBe(true);
        expect(registerResponse.body.user.email).toBe(userData.email);

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                username: userData.username,
                password: userData.password
            })
            .expect(200);

        expect(loginResponse.body.success).toBe(true);
        expect(loginResponse.body.token).toBeDefined();
    });

    test('School management (admin only)', async () => {
        // Volunteer should not be able to create schools
        const volunteerAttempt = await request(app)
            .post('/api/schools')
            .set('Authorization', `Bearer ${volunteerToken}`)
            .send({
                name: 'Test School',
                totalClasses: 10,
                availableClasses: 10
            })
            .expect(403);

        expect(volunteerAttempt.body.success).toBe(false);

        // Admin should be able to create schools
        const schoolData = {
            name: 'Comprehensive Test School',
            address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                pincode: '500001'
            },
            contactPerson: {
                name: 'Test Principal',
                position: 'Principal',
                phone: '6666666666'
            },
            totalClasses: 12,
            availableClasses: 12,
            grades: ['6', '7', '8']
        };

        console.log('Using admin token:', adminToken ? 'Token exists' : 'No token');

        const createResponse = await request(app)
            .post('/api/schools')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(schoolData);

        // Check response status and handle accordingly
        if (createResponse.status === 201) {
            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.data.name).toBe(schoolData.name);
        } else {
            console.log('School creation failed:', createResponse.status, createResponse.body);
            // If admin token doesn't work, skip this assertion for now
            expect(createResponse.status).toBe(201); // This will fail but we'll see the actual error
        }

        // Both admin and volunteer should be able to view schools
        const viewResponse = await request(app)
            .get('/api/schools')
            .set('Authorization', `Bearer ${volunteerToken}`)
            .expect(200);

        expect(viewResponse.body.success).toBe(true);
        expect(viewResponse.body.data.length).toBeGreaterThan(0);
    });

    test('User profile management', async () => {
        const profileResponse = await request(app)
            .get('/api/volunteers/profile')
            .set('Authorization', `Bearer ${volunteerToken}`)
            .expect(200);

        expect(profileResponse.body.success).toBe(true);
        expect(profileResponse.body.data.email).toBe('volunteer@college.edu');
    });
});