const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');

describe('Verified session middleware', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'test-only-secret'; });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  const invoke = (payload) => {
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });
    return { req, res, nextCalled };
  };

  it('rejects tokens created before the verified-session claim was introduced', () => {
    const result = invoke({ userId: 'user-1', role: 'student' });
    expect(result.res.statusCode).toBe(401);
    expect(result.res.body.code).toBe('SESSION_REAUTH_REQUIRED');
    expect(result.nextCalled).toBe(false);
  });

  it('accepts a verified student session', () => {
    const result = invoke({ userId: 'user-1', role: 'student', isVerified: true, isApproved: true });
    expect(result.nextCalled).toBe(true);
    expect(result.req.user.userId).toBe('user-1');
  });

  it('rejects an unapproved admin session', () => {
    const result = invoke({ userId: 'admin-1', role: 'admin', isVerified: true, isApproved: false });
    expect(result.res.statusCode).toBe(401);
    expect(result.nextCalled).toBe(false);
  });

  it('rejects tokens with an unsupported account role', () => {
    const result = invoke({ userId: 'user-1', role: 'superuser', isVerified: true, isApproved: true });
    expect(result.res.statusCode).toBe(401);
    expect(result.nextCalled).toBe(false);
  });

});
