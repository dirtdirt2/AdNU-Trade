const request = require('supertest');
const app = require('../server');

describe('Message Endpoints', () => {
  it('should require authentication to fetch messages', async () => {
    const fakeProductId = '123e4567-e89b-12d3-a456-426614174000';
    const res = await request(app)
      .get(`/api/messages/${fakeProductId}`);

    // Expecting 401 Unauthorized since no token was provided
    expect(res.statusCode).toEqual(401);
  });
});
describe('Private message unread state', () => {
  it('requires authentication to fetch unread message count', async () => {
    const res = await request(app).get('/api/messages/unread-count');
    expect(res.statusCode).toBe(401);
  });

  it('requires authentication to mark a conversation as read', async () => {
    const res = await request(app)
      .patch('/api/messages/read')
      .send({ productId: 'a-product', otherUserId: 'another-user' });
    expect(res.statusCode).toBe(401);
  });
});


describe('Message participant privacy', () => {
  it('does not select participant email addresses or university ID numbers', () => {
    const fs = require('fs');
    const path = require('path');
    const routeSource = fs.readFileSync(path.join(__dirname, '../routes/messages.js'), 'utf8');

    expect(routeSource).not.toMatch(/sender:\s*\{\s*select:\s*\{[^}]*email\s*:/s);
    expect(routeSource).not.toMatch(/receiver:\s*\{\s*select:\s*\{[^}]*email\s*:/s);
    expect(routeSource).not.toMatch(/idNumber\s*:/);
  });
});
