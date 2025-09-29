// Manual environment setup
const { setupTestEnvironment } = require('./test-helpers');
setupTestEnvironment();

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('SAS Performance Tests', () => {
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

    test('Should handle multiple requests', async () => {
        const requests = Array(5).fill().map(() => 
            request(app).get('/api/test')
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
            expect(response.status).toBe(200);
        });
    });
});