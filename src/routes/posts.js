const express = require('express');
const db = require('../config/db');
const { requireAuth, requireOperator, requireClientAccess } = require('../middleware/auth');
const { renderAndSchedule, createManualPost } = require('../pipeline/pipeline');
const { generateQuoteCarousel } = require('../ai/carouselGenerator');
const { resolvePlatformAccount } = require('../platformAccounts/resolveAccount');

const router = express.Router();
router.use(requireAuth, requireClientAccess);

// GET /api/posts?clientId=1&status=posted&page=1&limit=20
router.get('/', async (req, res, next) => {
  try {
    const { clientId, status } = req.query;
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const effectiveClientId = req.user.role === 'operator'
      ? (clientId || null)
      : req.user.clientId;

    if (req.user.role !== 'operator' && !effectiveClientId) {
      return res.status(400).json({ error: 'clientId required', code: 'MISSING_FIELDS' });
    }

    const conditions = [];
    const values = [];
    let idx = 1;

    if (effectiveClientId) {
      conditions.push(`p.client_id = $${idx++}`);
      values.push(effectiveClientId);
    }

    if (status) {
      conditions.push(`p.status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: posts } = await db.query(
      `SELECT p.*,
              json_agg(pv.*) AS variants
       FROM posts p
       LEFT JOIN post_variants pv ON pv.post_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const { rows: [count] } = await db.query(
      `SELECT COUNT(*) FROM posts p ${whereClause}`,
      values
    );

    res.json({
      posts,
      total: parseInt(count.count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) { next(err); }
});

// POST /api/posts/preview — generate slide quotes via Claude (no render, no DB write)
router.post('/preview', requireOperator, async (req, res, next) => {
  try {
    const { topic, slideCount, clientId } = req.body;

    if (!topic?.trim() || !slideCount) {
      return res.status(400).json({ error: 'topic and slideCount are required', code: 'MISSING_FIELDS' });
    }
    const count = parseInt(slideCount, 10);
    if (isNaN(count) || count < 1 || count > 20) {
      return res.status(400).json({ error: 'slideCount must be 1–20', code: 'INVALID_SLIDE_COUNT' });
    }

    let clientName = '', niche = '', toneOfVoice = 'professional';
    if (clientId) {
      const { rows: [client] } = await db.query('SELECT name FROM clients WHERE id = $1', [clientId]);
      if (client) clientName = client.name;
      const { rows: [settings] } = await db.query(
        'SELECT niche, tone_of_voice FROM client_settings WHERE client_id = $1', [clientId]
      );
      if (settings) { niche = settings.niche || ''; toneOfVoice = settings.tone_of_voice || 'professional'; }
    }

    const slides = await generateQuoteCarousel({ topic: topic.trim(), slideCount: count, clientName, niche, toneOfVoice });
    res.json({ slides });
  } catch (err) { next(err); }
});

// POST /api/posts/manual — schedule a quote carousel (slides pre-generated or AI-generated)
router.post('/manual', requireOperator, async (req, res, next) => {
  try {
    const { clientId, topic, slideCount, platforms, scheduledAt, slides, templateName } = req.body;

    if (!clientId || !topic?.trim() || !slideCount || !platforms?.length || !scheduledAt) {
      return res.status(400).json({ error: 'clientId, topic, slideCount, platforms and scheduledAt are required', code: 'MISSING_FIELDS' });
    }

    const count = parseInt(slideCount, 10);
    if (isNaN(count) || count < 1 || count > 20) {
      return res.status(400).json({ error: 'slideCount must be between 1 and 20', code: 'INVALID_SLIDE_COUNT' });
    }

    const VALID_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads'];
    if (platforms.some(p => !VALID_PLATFORMS.includes(p))) {
      return res.status(400).json({ error: 'Invalid platform', code: 'INVALID_PLATFORM' });
    }

    if (new Date(scheduledAt) <= new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be in the future', code: 'INVALID_SCHEDULE' });
    }

    const post = await createManualPost({ clientId, topic: topic.trim(), slideCount: count, platforms, scheduledAt, slides, templateName });
    res.status(201).json({ ok: true, postId: post.id });
  } catch (err) { next(err); }
});

// GET /api/posts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [post] } = await db.query(
      `SELECT p.*, json_agg(pv.*) AS variants
       FROM posts p
       LEFT JOIN post_variants pv ON pv.post_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );

    if (!post) return res.status(404).json({ error: 'Post not found', code: 'NOT_FOUND' });

    res.json(post);
  } catch (err) { next(err); }
});

// POST /api/posts/:id/approve — operator approves a supervised post
router.post('/:id/approve', requireOperator, async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);

    const { rows: [post] } = await db.query(
      'SELECT * FROM posts WHERE id = $1',
      [postId]
    );

    if (!post) return res.status(404).json({ error: 'Post not found', code: 'NOT_FOUND' });
    if (post.status !== 'approval_pending') {
      return res.status(400).json({ error: 'Post is not pending approval', code: 'INVALID_STATE' });
    }

    // Load pending variants and settings
    const { rows: variants } = await db.query(
      'SELECT * FROM post_variants WHERE post_id = $1 AND status = $2',
      [postId, 'pending_approval']
    );

    const { rows: [settings] } = await db.query(
      'SELECT * FROM client_settings WHERE client_id = $1',
      [post.client_id]
    );

    // Trigger render + schedule
    const variantsWithScript = variants.map(v => ({
      ...v,
      adaptedScript: v.adapted_script,
    }));

    await renderAndSchedule(post.client_id, postId, variantsWithScript, settings);

    res.json({ ok: true, message: 'Post approved and scheduled for rendering' });
  } catch (err) { next(err); }
});

// POST /api/posts/:id/reject — operator rejects a supervised post
router.post('/:id/reject', requireOperator, async (req, res, next) => {
  try {
    const postId = parseInt(req.params.id, 10);

    await db.query(
      `UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [postId]
    );

    await db.query(
      `UPDATE post_variants SET status = 'draft', updated_at = NOW() WHERE post_id = $1`,
      [postId]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/posts/:postId/variants/:variantId/delete — delete from platforms
router.post('/:postId/variants/:variantId/delete', requireOperator, async (req, res, next) => {
  try {
    const variantId = parseInt(req.params.variantId, 10);

    const { rows: [variant] } = await db.query(
      'SELECT * FROM post_variants WHERE id = $1',
      [variantId]
    );

    if (!variant) return res.status(404).json({ error: 'Variant not found', code: 'NOT_FOUND' });

    if (variant.platform !== 'youtube' && variant.platform_post_id) {
      const { rows: [account] } = await db.query(
        'SELECT * FROM platform_accounts WHERE client_id = $1 AND platform = $2 AND active = TRUE',
        [variant.client_id, variant.platform]
      );

      if (account) {
        try {
          const AdapterClass = require(`../adapters/${variant.platform}`);
          const resolvedAccount = await resolvePlatformAccount(account);
          const adapter = new AdapterClass(resolvedAccount);
          await adapter.deletePost(variant.platform_post_id);
        } catch (err) {
          // Log but don't fail — still mark as deleted in DB
        }
      }
    }

    await db.query(
      `UPDATE post_variants SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [variantId]
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
