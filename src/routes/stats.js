const express = require('express');
const db = require('../config/db');
const { requireAuth, requireOperator, requireClientAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/stats/overview — aggregate stats across all clients (operator only)
router.get('/overview', requireOperator, async (req, res, next) => {
  try {
    const [{ rows: [counts] }, { rows: [weekStats] }, { rows: clients }] = await Promise.all([
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM clients WHERE archived = FALSE)::int AS total_clients,
          (SELECT COUNT(*) FROM posts WHERE created_at > NOW() - INTERVAL '7 days')::int AS posts_this_week,
          (SELECT COUNT(*) FROM posts WHERE status = 'posted' AND created_at > NOW() - INTERVAL '7 days')::int AS posted_this_week,
          (SELECT COUNT(*) FROM posts WHERE status = 'approval_pending')::int AS pending_approval
      `),
      db.query(`
        SELECT
          COALESCE(SUM(ps.reach), 0)::int       AS total_reach,
          COALESCE(SUM(ps.impressions), 0)::int  AS total_impressions,
          COALESCE(SUM(ps.likes), 0)::int        AS total_likes,
          COALESCE(SUM(ps.comments), 0)::int     AS total_comments
        FROM post_stats ps
        WHERE ps.fetched_at > NOW() - INTERVAL '7 days'
      `),
      db.query(`
        SELECT c.id, c.name, cs.approval_mode, cs.active_platforms,
               (SELECT MAX(p.created_at) FROM posts p WHERE p.client_id = c.id) AS last_post_at
        FROM clients c
        JOIN client_settings cs ON cs.client_id = c.id
        WHERE c.archived = FALSE
        ORDER BY c.name
      `),
    ]);

    const successRate = counts.posts_this_week > 0
      ? Math.round((counts.posted_this_week / counts.posts_this_week) * 100)
      : 0;

    res.json({
      total_clients: counts.total_clients,
      posts_this_week: counts.posts_this_week,
      success_rate: successRate,
      pending_approval: counts.pending_approval,
      total_reach: weekStats.total_reach,
      total_impressions: weekStats.total_impressions,
      total_likes: weekStats.total_likes,
      total_comments: weekStats.total_comments,
      clients,
    });
  } catch (err) { next(err); }
});

// GET /api/stats/clients/:id — per-client stats with time series
router.get('/clients/:id', requireClientAccess, async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));

    const [{ rows: totals }, { rows: byPlatform }, { rows: timeSeries }, { rows: topPosts }] =
      await Promise.all([
        // Total engagement
        db.query(
          `SELECT
             COALESCE(SUM(likes), 0)::int       AS likes,
             COALESCE(SUM(comments), 0)::int    AS comments,
             COALESCE(SUM(shares), 0)::int      AS shares,
             COALESCE(SUM(saves), 0)::int       AS saves,
             COALESCE(SUM(reach), 0)::int       AS reach,
             COALESCE(SUM(impressions), 0)::int AS impressions,
             COALESCE(SUM(views), 0)::int       AS views
           FROM post_stats
           WHERE client_id = $1 AND fetched_at > NOW() - INTERVAL '${days} days'`,
          [clientId]
        ),
        // By platform
        db.query(
          `SELECT platform,
             COALESCE(SUM(likes), 0)::int       AS likes,
             COALESCE(SUM(comments), 0)::int    AS comments,
             COALESCE(SUM(shares), 0)::int      AS shares,
             COALESCE(SUM(reach), 0)::int       AS reach,
             COALESCE(SUM(impressions), 0)::int AS impressions
           FROM post_stats
           WHERE client_id = $1 AND fetched_at > NOW() - INTERVAL '${days} days'
           GROUP BY platform`,
          [clientId]
        ),
        // Daily reach time series
        db.query(
          `SELECT DATE(fetched_at) AS date,
                  platform,
                  COALESCE(SUM(reach), 0)::int AS reach,
                  COALESCE(SUM(impressions), 0)::int AS impressions,
                  COALESCE(SUM(likes), 0)::int AS likes
           FROM post_stats
           WHERE client_id = $1 AND fetched_at > NOW() - INTERVAL '${days} days'
           GROUP BY DATE(fetched_at), platform
           ORDER BY date ASC`,
          [clientId]
        ),
        // Top posts
        db.query(
          `SELECT pv.id, pv.platform, pv.posted_at, pv.platform_post_id,
                  p.master_script->>'title' AS title,
                  ps.likes, ps.comments, ps.shares, ps.reach, ps.impressions, ps.views,
                  pv.image_urls
           FROM post_stats ps
           JOIN post_variants pv ON pv.id = ps.post_variant_id
           JOIN posts p ON p.id = pv.post_id
           WHERE ps.client_id = $1 AND ps.fetched_at > NOW() - INTERVAL '${days} days'
           ORDER BY (ps.likes + ps.comments + ps.shares) DESC
           LIMIT 10`,
          [clientId]
        ),
      ]);

    res.json({ totals: totals[0], by_platform: byPlatform, time_series: timeSeries, top_posts: topPosts });
  } catch (err) { next(err); }
});

module.exports = router;
