const jwt = require('jsonwebtoken');

const ALLOWED_ROLES = new Set(['student', 'teacher', 'staff', 'admin']);

const isUsableSession = (payload) => {
  if (!payload || typeof payload.userId !== 'string' || !payload.userId) return false;
  if (payload.isVerified !== true) return false;
  if (!ALLOWED_ROLES.has(payload.role)) return false;
  if (payload.role === 'admin' && payload.isApproved !== true) return false;
  return true;
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = typeof authHeader === 'string' ? authHeader.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Access denied. A valid Bearer token is required.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!isUsableSession(verified)) {
      return res.status(401).json({
        error: 'Your session is no longer valid. Please sign in again.',
        code: 'SESSION_REAUTH_REQUIRED',
      });
    }

    req.user = verified;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Optional authentication remains available for non-sensitive routes.
// The marketplace routes now use verifyToken because AdNU Trade is school-only.
const optionalVerifyToken = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = typeof authHeader === 'string' ? authHeader.split(' ') : [];
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = isUsableSession(verified) ? verified : null;
  } catch (_error) {
    req.user = null;
  }
  return next();
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    return next();
  });
};

module.exports = { verifyToken, verifyAdmin, optionalVerifyToken };
