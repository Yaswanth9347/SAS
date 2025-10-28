const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

// Ensure test env variables
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/sas_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';
process.env.PORT = process.env.PORT || '5001';

/**
 * Tests for password change flow
 * - Verifies old password must be correct
 * - Prevents reusing the same password
 * - Allows changing to a new password and logging in with it
 */
describe('Auth: Change Password Flow', () => {
  let token;
  const username = 'changepwuser';
  const email = 'changepw@college.edu';
  const oldPassword = 'oldpass1';
  const newPassword = 'newpass7';

  beforeAll(async () => {
    // Connect to test DB and clear users
    await mongoose.connect(process.env.MONGODB_URI_TEST, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await User.deleteMany({});

    // Register a user
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Change PW User',
        username,
        email,
        password: oldPassword,
        collegeId: 'CPW001',
        department: 'CSE',
        year: 2,
        phone: '9000000001',
      })
      .expect(200);

    expect(reg.body.success).toBe(true);
    token = reg.body.token;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('Rejects change when current password is wrong', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'incorrect', newPassword: 'another7' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  test('Rejects change when new password equals current', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword: oldPassword })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/must be different/i);
  });

  test('Allows change with correct current password and new login works', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPassword, newPassword })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Login with old password should fail
    const failLogin = await request(app)
      .post('/api/auth/login')
      .send({ username, password: oldPassword });
    expect(failLogin.status).toBe(401);

    // Login with new password should succeed
    const okLogin = await request(app)
      .post('/api/auth/login')
      .send({ username, password: newPassword })
      .expect(200);
    expect(okLogin.body.success).toBe(true);
    expect(okLogin.body.token).toBeTruthy();
  });
});
