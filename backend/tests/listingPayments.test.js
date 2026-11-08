const request = require('supertest');
const app = require('../server');

describe('Listing payment endpoints', () => {
  it('requires a seller token to read payment instructions', async () => {
    const res = await request(app).get('/api/listing-payments/example-product/instructions');
    expect(res.statusCode).toBe(401);
  });

  it('requires a seller token to submit a transfer proof', async () => {
    const res = await request(app).post('/api/listing-payments/example-product');
    expect(res.statusCode).toBe(401);
  });

  it('requires an administrator token to list submitted payments', async () => {
    const res = await request(app).get('/api/admin/listing-payments/pending');
    expect(res.statusCode).toBe(401);
  });
});
