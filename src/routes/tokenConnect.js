const express = require('express');
const axios   = require('axios');
const db      = require('../config/db');
const { redis } = require('../config/redis');
const env     = require('../config/env');
const logger  = require('../utils/logger');

const router = express.Router();

const PLATFORM_EMOJI = {
  instagram: '📸', facebook: '📘', threads: '🧵',
  linkedin: '💼', twitter: '🐦', youtube: '▶️',
};

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function page(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AutoMonk — Connect Account</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;
         background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;padding:24px}
    .card{background:#1a1d27;border:1px solid #2a2d3e;border-radius:16px;padding:40px;max-width:480px;width:100%}
    .logo{font-size:22px;font-weight:700;color:#f97316;margin-bottom:8px}
    h1{font-size:20px;font-weight:600;margin-bottom:6px}
    .sub{color:#94a3b8;font-size:14px;margin-bottom:28px}
    label{display:block;font-size:13px;font-weight:500;color:#94a3b8;margin-bottom:6px}
    input{width:100%;background:#0f1117;border:1px solid #2a2d3e;border-radius:10px;
          padding:12px 14px;color:#e2e8f0;font-size:14px;outline:none;transition:border .15s}
    input:focus{border-color:#f97316}
    .hint{font-size:12px;color:#64748b;margin-top:6px}
    .field{margin-bottom:20px}
    button{width:100%;background:#f97316;color:#fff;border:none;border-radius:10px;
           padding:14px;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;transition:opacity .15s}
    button:hover{opacity:.9}
    .error{background:#3b1111;border:1px solid #7f1d1d;border-radius:10px;padding:14px;
           color:#fca5a5;font-size:14px;margin-bottom:20px}
    .success-icon{font-size:56px;text-align:center;margin-bottom:16px}
    .success-title{font-size:22px;font-weight:700;text-align:center;margin-bottom:8px}
    .success-sub{color:#94a3b8;font-size:14px;text-align:center}
    .badge{display:inline-block;background:#1e293b;border-radius:6px;padding:2px 8px;font-size:13px;color:#94a3b8;margin-left:6px}
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
}

function formPage(token, clientName, platform, errorMsg = '') {
  const emoji = PLATFORM_EMOJI[platform] || '🔗';
  const isMetaPlatform = ['instagram', 'facebook', 'threads'].includes(platform);
  const accessTokenHint = platform === 'instagram'
    ? 'Recommended for Instagram: paste a Meta long-lived user access token with page and Instagram permissions. AutoMonk will resolve the Instagram Business account automatically.'
    : 'Your token is encrypted in transit and never logged.';

  return page(`
    <div class="logo">AutoMonk</div>
    <h1>${emoji} Connect ${platform} <span class="badge">${clientName}</span></h1>
    <p class="sub">Paste your access token below. This link is one-time use and expires in 15 minutes.</p>
    ${errorMsg ? `<div class="error">⚠️ ${errorMsg}</div>` : ''}
    <form method="POST" action="/connect/token/${token}">
      <div class="field">
        <label>Access Token *</label>
        <input type="password" name="access_token" placeholder="Paste your access token here" required autocomplete="off"/>
        <p class="hint">${accessTokenHint}</p>
      </div>
      ${!isMetaPlatform ? `
      <div class="field">
        <label>Account ID *</label>
        <input type="text" name="account_id" placeholder="Your ${platform} account or page ID" required autocomplete="off"/>
        <p class="hint">${platform === 'youtube' ? 'Your channel ID (starts with UC…)' : platform === 'linkedin' ? 'Format: urn:li:organization:12345' : platform === 'twitter' ? 'Your Twitter username (without @)' : 'Your account ID'}</p>
      </div>` : ''}
      <button type="submit">🔐 Connect ${platform}</button>
    </form>
  `);
}

function successPage(clientName, platform) {
  return page(`
    <div class="success-icon">✅</div>
    <div class="success-title">${platform} Connected!</div>
    <p class="success-sub">${PLATFORM_EMOJI[platform] || ''} <strong>${platform}</strong> has been connected for <strong>${clientName}</strong>.<br/><br/>You'll get a confirmation in Telegram. You can close this page.</p>
  `);
}

function errorPage(msg) {
  return page(`
    <div class="success-icon">❌</div>
    <div class="success-title">Something went wrong</div>
    <p class="success-sub">${msg}</p>
  `);
}

// ─── GET /connect/token/:token — serve the form ───────────────────────────────

router.get('/:token', async (req, res) => {
  try {
    const raw = await redis.get(`ct:${req.params.token}`);
    if (!raw) return res.status(410).send(errorPage('This link has expired or already been used. Run /connect in Telegram to get a new one.'));

    const { clientName, platform } = JSON.parse(raw);
    return res.send(formPage(req.params.token, clientName, platform));
  } catch (err) {
    logger.error('Token connect GET failed', { error: err.message });
    return res.status(500).send(errorPage('Server error. Please try again.'));
  }
});

// ─── POST /connect/token/:token — process the submission ─────────────────────

router.post('/:token', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const raw = await redis.get(`ct:${req.params.token}`);
    if (!raw) return res.status(410).send(errorPage('This link has expired or already been used. Run /connect in Telegram to get a new one.'));

    const { chatId, clientId, clientName, platform } = JSON.parse(raw);
    const accessToken = req.body.access_token?.trim();

    if (!accessToken) {
      const { clientName: cn, platform: pl } = JSON.parse(raw);
      return res.status(400).send(formPage(req.params.token, cn, pl, 'Access token is required.'));
    }

    let tokenToStore = accessToken;

    // For Meta platforms, auto-fetch the publish target from the Graph API
    let accountId = req.body.account_id?.trim();
    if (!accountId && ['instagram', 'facebook', 'threads'].includes(platform)) {
      try {
        if (platform === 'facebook') {
          const pagesRes = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
            params: { access_token: accessToken, fields: 'id,name,access_token' },
            timeout: 8000,
          });

          const page = pagesRes.data?.data?.[0];
          if (!page) {
            throw new Error('No Facebook Pages found for the supplied token');
          }

          accountId = String(page.id);
          tokenToStore = page.access_token || accessToken;
        } else if (platform === 'instagram') {
          const profileRes = await axios.get('https://graph.instagram.com/v21.0/me', {
            params: { access_token: accessToken, fields: 'id,username,name' },
            timeout: 8000,
          });

          if (!profileRes.data?.id) {
            throw new Error('No Instagram professional account found for the supplied token');
          }

          accountId = String(profileRes.data.id);
        } else {
          const pagesRes = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
            params: { access_token: accessToken, fields: 'id,name,instagram_business_account' },
            timeout: 8000,
          });

          const igAccount = (pagesRes.data?.data || [])
            .filter((page) => page.instagram_business_account)
            .map((page) => page.instagram_business_account)[0];

          if (!igAccount) {
            throw new Error('No Instagram Business account found for the supplied token');
          }

          accountId = String(igAccount.id);
        }

        logger.info('Auto-fetched Meta publish target', { accountId, platform });
      } catch (e) {
        logger.warn('Could not auto-fetch Meta account ID', { error: e.message });
        return res.status(400).send(formPage(req.params.token, clientName, platform,
          platform === 'instagram'
            ? 'Could not resolve an Instagram Business account from this token. Make sure it is a valid long-lived Meta token with access to the correct Page and Instagram account.'
            : 'Could not verify your token with Meta. Make sure it is a valid, unexpired access token.'));
      }
    }

    if (!accountId) {
      return res.status(400).send(formPage(req.params.token, clientName, platform, 'Account ID is required.'));
    }

    // Save to platform_accounts (upsert)
    await db.query(
      `INSERT INTO platform_accounts
         (client_id, platform, account_id, access_token, active, created_at, updated_at, nango_connection_id, nango_provider_config_key, nango_provider)
       VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW(), NULL, NULL, NULL)
       ON CONFLICT (client_id, platform)
       DO UPDATE SET account_id = EXCLUDED.account_id,
                     access_token = EXCLUDED.access_token,
                     active = TRUE,
                     nango_connection_id = NULL,
                     nango_provider_config_key = NULL,
                     nango_provider = NULL,
                     updated_at = NOW()`,
      [clientId, platform, accountId, tokenToStore]
    );

    // Sync active_platforms in client_settings
    await db.query(
      `UPDATE client_settings
       SET active_platforms = (
         SELECT array_agg(DISTINCT p.platform ORDER BY p.platform)
         FROM platform_accounts p
         WHERE p.client_id = $1 AND p.active = TRUE
       )
       WHERE client_id = $1`,
      [clientId]
    );

    // One-time use — delete the token
    await redis.del(`ct:${req.params.token}`);

    // Notify operator via Telegram
    try {
      await axios.post(
        `https://api.telegram.org/bot${env.telegram.bot_token}/sendMessage`,
        {
          chat_id: chatId,
          text: `✅ ${PLATFORM_EMOJI[platform] || ''} ${platform} connected for ${clientName}!\n\nAccount ID: ${accountId}\n\nReady to publish.`,
        }
      );
    } catch (e) {
      logger.error('Failed to send Telegram confirmation', { error: e.message });
    }

    return res.send(successPage(clientName, platform));
  } catch (err) {
    logger.error('Token connect POST failed', { error: err.message });
    return res.status(500).send(errorPage('Server error. Please try again.'));
  }
});

module.exports = router;
