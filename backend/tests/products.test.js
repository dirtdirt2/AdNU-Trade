const request = require('supertest');
const app = require('../server');

describe('Product Endpoints', () => {
  it('should reject product creation without authentication', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        title: 'Unauthorized Test Item',
        description: 'Should not be saved',
        price: 100,
        category: 'Books'
      });

    // Expect 401 Unauthorized because no Bearer token was provided
    expect(res.statusCode).toEqual(401);
  });

  it('should reject fetching a product with an invalid UUID format', async () => {
    const res = await request(app)
      .get('/api/products/invalid-uuid-123');

    // Expect 400 Bad Request or 404 Not Found depending on your route handling
    expect([400, 404]).toContain(res.statusCode);
  });
});