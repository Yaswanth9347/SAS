// Test helper functions and setup
function setupTestEnvironment() {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/sas_test';
    process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
    process.env.JWT_EXPIRE = '30d';
    process.env.PORT = '5001';
    
    console.log('✅ Test environment manually configured');
}

// Helper to clear database collections
async function clearDatabase() {
    const mongoose = require('mongoose');
    const collections = mongoose.connection.collections;

    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
}

// Helper to create test admin user
async function createTestAdmin() {
    const User = require('../models/User');
    const request = require('supertest');
    const app = require('../server');

    // Create admin user directly
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

    // Login to get token
    const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
            username: 'admin',
            password: 'admin123'
        });

    return loginResponse.body.token;
}

// Helper to create test volunteer user
async function createTestVolunteer() {
    const request = require('supertest');
    const app = require('../server');

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

    return volunteerResponse.body.token;
}

module.exports = { 
    setupTestEnvironment, 
    clearDatabase, 
    createTestAdmin, 
    createTestVolunteer 
};