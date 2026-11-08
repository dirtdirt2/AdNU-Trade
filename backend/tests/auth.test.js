const request = require('supertest');
const app = require('../server'); // Export 'app' from server.js if not already exported

describe('Auth Endpoints', () => {
  it('should reject registration for non-AdNU emails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        idNumber: '123456789',
        first: 'Test',
        last: 'User',
        email: 'user@gmail.com',
        password: 'password123',
        role: 'student'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });
  it('should not expose the removed development token endpoint', async () => {
    const res = await request(app).get('/api/auth/dev-token/any-user-id');
    expect(res.statusCode).toBe(404);
  });

  it('should return a clear unavailable response when Google OAuth is not configured', async () => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return;
    const res = await request(app).get('/api/auth/google');
    expect(res.statusCode).toBe(503);
  });

});