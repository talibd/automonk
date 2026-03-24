const express = require('express');
const axios = require('axios');
const db = require('../config/db');
const env = require('../config/env');
const { requireAuth, requireOperator } = require('../middleware/auth');
const logger = require('../utils/logger');
const {
  createConnectSession,
  discoverPlatformAccount,
  getConnection,
  getIntegrationId,
  verifyIncomingWebhookRequest,
} = require('../integrations/nango');

const router = express.Router();

function notifyText(platform, clientName, operation) {
  const label = operation === 'override' ? 'reconnected' : 'connected';
  return `${platform} ${label} for ${clientName}.`;
}

async function notifyTelegram(chatId, text) {
  const targetChatId = chatId || env.telegram.operator_chat_id;
  if (!targetChatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${env.telegram.bot_token}/sendMessage`, {
      chat_id: targetChatId,
      text,
    });
  } catch (err) {
    logger.error('Nango Telegram notify failed', { error: err.message });
  }
}

router.post('/connect-session', requireAuth, requireOperator, async (req, res, next) => {
  try {
    const clientId = parseInt(req.body.clientId || req.body.client_id, 10);
    const platform = String(req.body.platform || '').trim().toLowerCase();

    if (!clientId || !platform) {
      return res.status(400).json({ error: 'clientId and platform are required', code: 'MISSING_FIELDS' });
    }

    const integrationId = getIntegrationId(platform);
    if (!integrationId) {
      return res.status(400).json({ error: `Nango is not configured for ${platform}`, code: 'NANGO_NOT_CONFIGURED' });
    }

    const { rows: [client] } = await db.query('SELECT id, name FROM clients WHERE id = $1', [clientId]);
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
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', async (req, res, next) => {
  try {
    if (!verifyIncomingWebhookRequest(req.rawBody || '', req.headers)) {
      return res.status(401).json({ error: 'Invalid Nango webhook signature', code: 'INVALID_SIGNATURE' });
    }

    const body = req.body || {};
    if (body.type !== 'auth') {
      return res.status(204).send();
    }

    const tags = body.tags || body.endUser?.tags || body.end_user?.tags || body.connection?.tags || {};
    const clientId = parseInt(tags.client_id, 10);
    const clientName = tags.client_name || 'client';
    const platform = tags.platform;
    const chatId = tags.chat_id || null;

    if (!clientId || !platform) {
      logger.warn('Nango webhook missing routing tags', { body });
      return res.status(202).send();
    }

    if (body.operation === 'refresh' && body.success === false) {
      await db.query(
        `UPDATE platform_accounts
         SET active = FALSE, updated_at = NOW()
         WHERE client_id = $1 AND platform = $2 AND nango_connection_id = $3`,
        [clientId, platform, body.connectionId]
      );
      await notifyTelegram(chatId, `${platform} connection needs re-authentication for ${clientName}.`);
      return res.status(204).send();
    }

    if (!['creation', 'override'].includes(body.operation) || body.success !== true) {
      return res.status(204).send();
    }

    const connection = await getConnection(body.connectionId, body.providerConfigKey);
    const discovered = await discoverPlatformAccount(platform, connection);

    await db.query(
      `INSERT INTO platform_accounts
         (client_id, platform, account_id, access_token, refresh_token, token_expiry, active, nango_connection_id, nango_provider_config_key, nango_provider)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9)
       ON CONFLICT (client_id, platform) DO UPDATE SET
         account_id = EXCLUDED.account_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry = EXCLUDED.token_expiry,
         active = TRUE,
         nango_connection_id = EXCLUDED.nango_connection_id,
         nango_provider_config_key = EXCLUDED.nango_provider_config_key,
         nango_provider = EXCLUDED.nango_provider,
         updated_at = NOW()`,
      [
        clientId,
        platform,
        discovered.account_id,
        discovered.access_token,
        discovered.refresh_token,
        discovered.token_expiry,
        body.connectionId,
        body.providerConfigKey,
        body.provider || null,
      ]
    );

    await notifyTelegram(chatId, notifyText(platform, clientName, body.operation));
    return res.status(204).send();
  } catch (err) {
    logger.error('Nango webhook processing failed', { error: err.message, body: req.body });
    next(err);
  }
});

module.exports = router;
