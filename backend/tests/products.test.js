
const request = require('supertest');
const app = require('../server');

describe('Product Endpoints', () => {
  const testProductId = '00000000-0000-4000-8000-000000000000';

  it('should allow guests to browse the public marketplace', async () => {
    const res = await request(app).get('/api/products');

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should allow guests to request product details', async () => {
    const res = await request(app).get(`/api/products/${testProductId}`);

    // The test UUID does not exist, but authentication is no longer required.
    expect(res.statusCode).toEqual(404);
    expect(res.body.error).toEqual('Product not found.');
  });

  it('should still require authentication to create products', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({
        title: 'Unauthorized Test Item',
        description: 'Should not be saved',
        price: 100,
        category: 'Books',
      });

    expect(res.statusCode).toEqual(401);
  });

  it('should still require authentication to view personal listings', async () => {
    const res = await request(app).get('/api/products/my-listings');

    expect(res.statusCode).toEqual(401);
  });

  it('should still require authentication to purchase products', async () => {
    const res = await request(app).post(`/api/products/${testProductId}/buy`);

    expect(res.statusCode).toEqual(401);
  });
});
