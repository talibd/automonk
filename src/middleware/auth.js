const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Verifies JWT and attaches decoded payload to req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, env.jwt.secret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}

/**
 * Only operator role can access this route.
 */
function requireOperator(req, res, next) {
  if (req.user?.role !== 'operator') {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }
  next();
}

/**
 * Clients can only access their own data.
 * Operators can access any client's data.
 */
function requireClientAccess(req, res, next) {
  if (req.user?.role === 'operator') return next();

  const clientId = parseInt(
    req.params.clientId || req.query.clientId || req.body?.clientId,
    10
  );
  if (req.user?.clientId !== clientId) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }
  next();
}

module.exports = { requireAuth, requireOperator, requireClientAccess };
