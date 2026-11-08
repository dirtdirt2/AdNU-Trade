const request = require('supertest');
const app = require('../server');

describe('Notification Endpoints', () => {
  it('requires authentication to fetch the notification feed', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.statusCode).toBe(401);
  });

  it('requires authentication to fetch the unread notification count', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.statusCode).toBe(401);
  });

  it('requires authentication to mark notifications as read', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.statusCode).toBe(401);
  });
});
