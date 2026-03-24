const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');

const router = express.Router();

/**
 * POST /api/auth/token
 * Body: { username, password }
 * Returns a JWT for operator or client login.
 *
 * Phase 1: Simple operator token with hardcoded check via env.
 * Phase 5: Full auth with hashed passwords per user in DB.
 */
router.post('/token', async (req, res, next) => {
  try {
    const { username = 'operator', password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'password required', code: 'MISSING_FIELDS' });
    }

    // Operator auth (Phase 1: env-based)
    if (username === 'operator' && password === env.operator_password) {
      const token = jwt.sign(
        { role: 'operator', username: 'operator' },
        env.jwt.secret,
        { expiresIn: env.jwt.expires_in }
      );
      return res.json({ token, role: 'operator' });
    }

    return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
