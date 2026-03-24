const express = require('express');
const db = require('../config/db');
const { requireAuth, requireOperator } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireOperator);

// GET /api/schedules?days=7&clientId=1
router.get('/', async (req, res, next) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
    const { clientId } = req.query;

    const conditions = [`s.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '${days} days'`];
    const values = [];
    let idx = 1;

    if (clientId) {
      conditions.push(`s.client_id = $${idx++}`);
      values.push(parseInt(clientId, 10));
    }

    const { rows } = await db.query(
      `SELECT
         s.id,
         s.client_id,
         s.post_variant_id,
         s.scheduled_at,
         s.status       AS schedule_status,
         s.bull_job_id,
         c.name         AS client_name,
         pv.platform,
         pv.content_type,
         pv.status      AS variant_status,
         pv.image_urls,
         p.master_script->>'title' AS post_title
       FROM schedules s
       JOIN clients c    ON c.id = s.client_id
       JOIN post_variants pv ON pv.id = s.post_variant_id
       JOIN posts p      ON p.id = pv.post_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.scheduled_at ASC`,
      values
    );

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
