const crypto = require('crypto');
const express = require('express');
const db = require('../config/db');
const { requireAuth, requireOperator } = require('../middleware/auth');
const { startClientCron, stopClientCron } = require('../scheduler/cron');
const { redis } = require('../config/redis');
const env = require('../config/env');
const { createConnectSession, getIntegrationId } = require('../integrations/nango');

const router = express.Router();
router.use(requireAuth, requireOperator);

// GET /api/clients
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, cs.active_platforms, cs.niche, cs.approval_mode, cs.idea_frequency
       FROM clients c
       LEFT JOIN client_settings cs ON cs.client_id = c.id
       WHERE c.archived = FALSE
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [client] } = await db.query(
      `SELECT c.*, cs.*
       FROM clients c
       LEFT JOIN client_settings cs ON cs.client_id = c.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
    res.json(client);
  } catch (err) { next(err); }
});

// POST /api/clients — create a new client
router.post('/', async (req, res, next) => {
  const dbClient = await db.getClient();
  try {
    const { name, settings = {} } = req.body;
    if (!name) return res.status(400).json({ error: 'name required', code: 'MISSING_FIELDS' });

    await dbClient.query('BEGIN');

    const { rows: [client] } = await dbClient.query(
      'INSERT INTO clients (name) VALUES ($1) RETURNING *',
      [name]
    );

    await dbClient.query(
      `INSERT INTO client_settings (
        client_id, active_platforms, niche, tone_of_voice, target_audience,
        hashtag_sets, cta_preferences, idea_frequency, approval_mode,
        weekly_optimization, posting_times
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        client.id,
        settings.active_platforms || [],
        settings.niche || '',
        settings.tone_of_voice || '',
        settings.target_audience || '',
        JSON.stringify(settings.hashtag_sets || {}),
        JSON.stringify(settings.cta_preferences || {}),
        settings.idea_frequency || 'daily',
        'supervised',  // always starts supervised
        settings.weekly_optimization !== false,
        JSON.stringify(settings.posting_times || {}),
      ]
    );

    await dbClient.query('COMMIT');

    // Start the cron for this client
    startClientCron(client.id, settings.idea_frequency || 'daily');

    res.status(201).json(client);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    next(err);
  } finally {
    dbClient.release();
  }
});

// PATCH /api/clients/:id/settings — update client settings
router.patch('/:id/settings', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const updates = req.body;

    // Build SET clause dynamically from allowed fields
    const allowed = [
      'active_platforms', 'niche', 'tone_of_voice', 'target_audience',
      'hashtag_sets', 'cta_preferences', 'idea_frequency', 'approval_mode',
      'weekly_optimization', 'posting_times',
    ];

    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in updates) {
        const val = ['hashtag_sets', 'cta_preferences', 'posting_times'].includes(key)
          ? JSON.stringify(updates[key])
          : updates[key];
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ error: 'No valid fields to update', code: 'MISSING_FIELDS' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(clientId);

    await db.query(
      `UPDATE client_settings SET ${setClauses.join(', ')} WHERE client_id = $${idx}`,
      values
    );

    // Restart cron if frequency changed
    if (updates.idea_frequency) {
      startClientCron(clientId, updates.idea_frequency);
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/clients/:id — archive client
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query('UPDATE clients SET archived = TRUE WHERE id = $1', [req.params.id]);
    stopClientCron(parseInt(req.params.id, 10));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /api/clients/:id/strategy — latest versioned strategy
router.get('/:id/strategy', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT version, strategy, created_at
       FROM client_strategy
       WHERE client_id = $1
       ORDER BY version DESC
       LIMIT 5`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─── Platform account management ──────────────────────────────────────────

// GET /api/clients/:id/platform-accounts
router.get('/:id/platform-accounts', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, platform, account_id, token_expiry, template_path, active, created_at, updated_at,
              nango_connection_id, nango_provider_config_key, nango_provider
       FROM platform_accounts
       WHERE client_id = $1
       ORDER BY platform`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/clients/:id/platform-accounts — add or replace a platform account
router.post('/:id/platform-accounts', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const {
      platform,
      account_id,
      access_token,
      refresh_token,
      token_expiry,
      template_path,
      nango_connection_id,
      nango_provider_config_key,
      nango_provider,
    } = req.body;

    if (!platform || !account_id || (!access_token && !nango_connection_id)) {
      return res.status(400).json({
        error: 'platform, account_id and either access_token or nango_connection_id required',
        code: 'MISSING_FIELDS',
      });
    }

    const VALID_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads', 'youtube'];
    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}`, code: 'INVALID_PLATFORM' });
    }

    const { rows: [account] } = await db.query(
      `INSERT INTO platform_accounts
         (client_id, platform, account_id, access_token, refresh_token, token_expiry, template_path, active,
          nango_connection_id, nango_provider_config_key, nango_provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10)
       ON CONFLICT (client_id, platform)
       DO UPDATE SET
         account_id    = EXCLUDED.account_id,
         access_token  = COALESCE(EXCLUDED.access_token, platform_accounts.access_token),
         refresh_token = COALESCE(EXCLUDED.refresh_token, platform_accounts.refresh_token),
         token_expiry  = COALESCE(EXCLUDED.token_expiry, platform_accounts.token_expiry),
         template_path = COALESCE(EXCLUDED.template_path, platform_accounts.template_path),
         nango_connection_id = EXCLUDED.nango_connection_id,
         nango_provider_config_key = EXCLUDED.nango_provider_config_key,
         nango_provider = EXCLUDED.nango_provider,
         active        = TRUE,
         updated_at    = NOW()
       RETURNING id, platform, account_id, token_expiry, template_path, active,
                 nango_connection_id, nango_provider_config_key, nango_provider`,
      [
        clientId,
        platform,
        account_id,
        access_token || null,
        refresh_token || null,
        token_expiry || null,
        template_path || null,
        nango_connection_id || null,
        nango_provider_config_key || null,
        nango_provider || null,
      ]
    );

    res.status(201).json(account);
  } catch (err) { next(err); }
});

router.post('/:id/platform-accounts/connect-session', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const platform = String(req.body.platform || '').trim().toLowerCase();

    if (!platform) {
      return res.status(400).json({ error: 'platform required', code: 'MISSING_FIELDS' });
    }

    const integrationId = getIntegrationId(platform);
    if (!integrationId) {
      return res.status(400).json({ error: `Nango is not configured for ${platform}`, code: 'NANGO_NOT_CONFIGURED' });
    }

    const { rows: [client] } = await db.query(
      'SELECT id, name FROM clients WHERE id = $1',
      [clientId]
    );
    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
    }

    const { rows: [existing] } = await db.query(
      `SELECT nango_connection_id
       FROM platform_accounts
       WHERE client_id = $1 AND platform = $2 AND nango_provider_config_key = $3`,
      [clientId, platform, integrationId]
    );

    const session = await createConnectSession({
      platform,
      clientId: client.id,
      clientName: client.name,
      reconnectConnectionId: existing?.nango_connection_id || null,
    });

    res.status(201).json(session);
  } catch (err) { next(err); }
});

function isOAuthConfigured(platform) {
  const o = env.oauth;
  if (platform === 'instagram') return !!(o.instagram_app_id && o.instagram_app_secret);
  if (['facebook', 'threads'].includes(platform)) return !!(o.meta_app_id && o.meta_app_secret);
  if (platform === 'linkedin') return !!(o.linkedin_client_id && o.linkedin_client_secret);
  if (platform === 'twitter') return !!(o.twitter_client_id && o.twitter_client_secret);
  if (platform === 'youtube') return !!(o.google_client_id && o.google_client_secret);
  return false;
}

function oauthPath(platform) {
  if (platform === 'instagram') return 'instagram';
  if (['facebook', 'threads'].includes(platform)) return 'meta';
  if (platform === 'linkedin') return 'linkedin';
  if (platform === 'twitter') return 'twitter';
  if (platform === 'youtube') return 'google';
  return null;
}

router.post('/:id/platform-accounts/oauth-link', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const platform = String(req.body.platform || '').trim().toLowerCase();

    if (!platform) {
      return res.status(400).json({ error: 'platform required', code: 'MISSING_FIELDS' });
    }

    if (!isOAuthConfigured(platform)) {
      return res.status(400).json({ error: `OAuth is not configured for ${platform}`, code: 'OAUTH_NOT_CONFIGURED' });
    }

    const path = oauthPath(platform);
    if (!path) {
      return res.status(400).json({ error: `Unsupported OAuth platform ${platform}`, code: 'INVALID_PLATFORM' });
    }

    const { rows: [client] } = await db.query(
      'SELECT id, name FROM clients WHERE id = $1',
      [clientId]
    );
    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
    }

    const oauthToken = crypto.randomBytes(24).toString('hex');
    await redis.setex(
      `oauth:state:${oauthToken}`,
      600,
      JSON.stringify({ clientId: client.id, clientName: client.name, platform })
    );

    res.status(201).json({
      url: `${env.app_url}/auth/${path}/start?state=${oauthToken}&ngrok-skip-browser-warning=true`,
    });
  } catch (err) { next(err); }
});

// PATCH /api/clients/:id/platform-accounts/:platform — toggle active, update template_path
router.patch('/:id/platform-accounts/:platform', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const { platform } = req.params;
    const {
      active,
      template_path,
      account_id,
      access_token,
      refresh_token,
      token_expiry,
      nango_connection_id,
      nango_provider_config_key,
      nango_provider,
    } = req.body;

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (active !== undefined) {
      setClauses.push(`active = $${idx++}`);
      values.push(Boolean(active));
    }
    if (account_id !== undefined) {
      setClauses.push(`account_id = $${idx++}`);
      values.push(account_id);
    }
    if (access_token !== undefined) {
      setClauses.push(`access_token = $${idx++}`);
      values.push(access_token);
    }
    if (refresh_token !== undefined) {
      setClauses.push(`refresh_token = $${idx++}`);
      values.push(refresh_token);
    }
    if (token_expiry !== undefined) {
      setClauses.push(`token_expiry = $${idx++}`);
      values.push(token_expiry);
    }
    if (template_path !== undefined) {
      setClauses.push(`template_path = $${idx++}`);
      values.push(template_path);
    }
    if (nango_connection_id !== undefined) {
      setClauses.push(`nango_connection_id = $${idx++}`);
      values.push(nango_connection_id);
    }
    if (nango_provider_config_key !== undefined) {
      setClauses.push(`nango_provider_config_key = $${idx++}`);
      values.push(nango_provider_config_key);
    }
    if (nango_provider !== undefined) {
      setClauses.push(`nango_provider = $${idx++}`);
      values.push(nango_provider);
    }

    if (
      access_token !== undefined &&
      nango_connection_id === undefined &&
      nango_provider_config_key === undefined &&
      nango_provider === undefined
    ) {
      setClauses.push(`nango_connection_id = NULL`);
      setClauses.push(`nango_provider_config_key = NULL`);
      setClauses.push(`nango_provider = NULL`);
    }

    if (!setClauses.length) {
      return res.status(400).json({ error: 'No valid fields to update', code: 'MISSING_FIELDS' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(clientId, platform);

    const { rowCount } = await db.query(
      `UPDATE platform_accounts
       SET ${setClauses.join(', ')}
       WHERE client_id = $${idx++} AND platform = $${idx}`,
      values
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Platform account not found', code: 'NOT_FOUND' });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/clients/:id/platform-accounts/:platform — remove platform account
router.delete('/:id/platform-accounts/:platform', async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM platform_accounts WHERE client_id = $1 AND platform = $2',
      [req.params.id, req.params.platform]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
