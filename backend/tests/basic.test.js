const request = require('supertest');
const app = require('../server');

describe('SAS Basic Tests (No DB)', () => {
    test('Server health check should work', async () => {
        const response = await request(app)
            .get('/api/test')
            .expect(200);

        expect(response.body.message).toBe('Backend is working!');
    });

    test('API health endpoint should work', async () => {
        const response = await request(app)
            .get('/api/health')
            .expect(200);

    // API returns lowercase 'ok'
    expect(response.body.status).toBe('ok');
    });

    test('Should serve frontend for unknown routes', async () => {
        const response = await request(app)
            .get('/unknown-route')
            .expect(200);

        // Should return HTML (frontend)
        expect(response.headers['content-type']).toMatch(/html/);
    });
});