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

  it('should require authentication to browse the marketplace', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(401);
  });

  it('should require authentication to view individual product details', async () => {
    const res = await request(app).get('/api/products/invalid-uuid-123');
    expect(res.statusCode).toEqual(401);
  });
});