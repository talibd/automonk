const crypto = require('crypto');
const express = require('express');
const env = require('../config/env');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const { sendAlert } = require('../bot/alerts');

const router = express.Router();
const DEDUPE_TTL_SECONDS = 30 * 24 * 60 * 60;

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function normalizeClientPayload(body = {}) {
  const client = body.client || body.data || {};
  const submittedAt = body.submittedAt || client.submittedAt || client.timestamp || body.timestamp || '';
  const email = client.email || client.bestEmailAddress || '';
  const whatsappNumber = client.whatsappNumber || client.phone || '';
  const instagramHandle = client.instagramHandle || '';
  const fullNamePreferredUsername = client.fullNamePreferredUsername || client.name || '';
  const nicheMarket = client.nicheMarket || client.niche || '';
  const accountGoal = client.accountGoal || '';
  const templateSelection = client.templateSelection || '';
  const dedupeKey = body.dedupeKey || [email, whatsappNumber, instagramHandle, submittedAt].join('|');

  return {
    submittedAt,
    dedupeKey,
    client: {
      fullNamePreferredUsername,
      whatsappNumber,
      email,
      instagramHandle,
      nicheMarket,
      accountGoal,
      templateSelection,
    },
    raw: body,
  };
}

function buildTelegramMessage(payload) {
  const { client, submittedAt } = payload;
  const lines = [
    'New client form submission received.',
    `Name: ${client.fullNamePreferredUsername || 'N/A'}`,
    `Email: ${client.email || 'N/A'}`,
    `WhatsApp: ${client.whatsappNumber || 'N/A'}`,
    `Instagram: ${client.instagramHandle || 'N/A'}`,
    `Niche: ${client.nicheMarket || 'N/A'}`,
    `Goal: ${client.accountGoal || 'N/A'}`,
    `Template: ${client.templateSelection || 'N/A'}`,
    `Submitted: ${submittedAt || 'N/A'}`,
  ];

  return lines.join('\n');
}

router.post('/google-sheet-client', async (req, res, next) => {
  try {
    const expectedSecret = env.webhooks.google_sheet_secret;
    if (!expectedSecret) {
      logger.error('Google Sheet webhook secret is not configured');
      return res.status(503).json({ error: 'Webhook not configured', code: 'WEBHOOK_NOT_CONFIGURED' });
    }

    const receivedSecret = req.headers['x-automonk-webhook-secret'];
    if (!timingSafeEqual(receivedSecret, expectedSecret)) {
      return res.status(401).json({ error: 'Invalid webhook secret', code: 'INVALID_WEBHOOK_SECRET' });
    }

    const payload = normalizeClientPayload(req.body);
    if (!payload.dedupeKey || payload.dedupeKey === '|||') {
      return res.status(400).json({ error: 'Missing dedupe key', code: 'MISSING_DEDUPE_KEY' });
    }

    const redisKey = `webhook:google-sheet-client:${payload.dedupeKey}`;
    const inserted = await redis.set(redisKey, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
    if (inserted !== 'OK') {
      return res.status(202).json({ ok: true, duplicate: true });
    }

    await sendAlert(buildTelegramMessage(payload));

    logger.info('Google Sheet client webhook processed', {
      email: payload.client.email,
      instagramHandle: payload.client.instagramHandle,
      submittedAt: payload.submittedAt,
    });

    return res.status(202).json({ ok: true });
  } catch (err) {
    logger.error('Google Sheet webhook processing failed', {
      error: err.message,
      body: req.body,
    });
    next(err);
  }
});

module.exports = router;
