const request = require('supertest');
const app = require('../server'); // Export 'app' from server.js if not already exported

describe('Auth Endpoints', () => {
  it('should reject registration for non-AdNU emails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@gmail.com',
        password: 'password123',
        fullName: 'Test User',
        role: 'student'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });
});