// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const School = require('../models/School');

describe('SAS Integration Tests', () => {
    let adminToken;
    let schoolId;

    beforeAll(async () => {
        console.log('Connecting to MongoDB:', process.env.MONGODB_URI_TEST);
        await mongoose.connect(process.env.MONGODB_URI_TEST, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        await User.deleteMany({});
        await School.deleteMany({});

        // Create admin user directly in database to ensure role is set
        const adminUser = await User.create({
            name: 'Integration Admin',
            username: 'integration_admin',
            email: 'integration_admin@sas.org',
            password: 'admin123',
            collegeId: 'INTADM001',
            department: 'ADMIN',
            year: 4,
            phone: '1111111111',
            role: 'admin'
        });

        // Login to get token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'integration_admin',
                password: 'admin123'
            });

        adminToken = loginResponse.body.token;
        console.log('✅ Admin user created and logged in');
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('Complete school creation workflow', async () => {
        // Create school
        const schoolData = {
            name: 'Integration Test School',
            address: {
                street: 'Test Street',
                city: 'Test City',
                state: 'Test State',
                pincode: '500001'
            },
            contactPerson: {
                name: 'Test Principal',
                position: 'Principal',
                phone: '9876543210',
                email: 'principal@test.edu'
            },
            totalClasses: 10,
            availableClasses: 10,
            grades: ['6', '7', '8']
        };

        const createResponse = await request(app)
            .post('/api/schools')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(schoolData)
            .expect(201);

        expect(createResponse.body.success).toBe(true);
        schoolId = createResponse.body.data._id;

        // Get all schools
        const getResponse = await request(app)
            .get('/api/schools')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

        expect(getResponse.body.success).toBe(true);
        expect(getResponse.body.data.length).toBe(1);
        expect(getResponse.body.data[0].name).toBe(schoolData.name);
    });
});