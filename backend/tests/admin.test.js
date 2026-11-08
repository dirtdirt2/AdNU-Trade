const request = require('supertest');
const app = require('../server');

describe('Admin Endpoints', () => {
  it('should block unauthenticated users from accessing pending admin products', async () => {
    const res = await request(app)
      .get('/api/admin/products/pending');

    // Expecting 401 Unauthorized because no token was provided
    expect([401, 403]).toContain(res.statusCode);
  });
});