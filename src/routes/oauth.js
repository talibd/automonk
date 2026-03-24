const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');
const { redis } = require('../config/redis');
const env = require('../config/env');
const logger = require('../utils/logger');

const router = express.Router();
const INSTAGRAM_GRAPH_API = 'https://graph.instagram.com/v21.0';

// ─── State helpers ────────────────────────────────────────────────────────────

const STATE_TTL = 600; // 10 minutes

function stateKey(token) { return `oauth:state:${token}`; }

async function getOAuthState(token) {
  const raw = await redis.get(stateKey(token));
  return raw ? JSON.parse(raw) : null;
}

async function setOAuthState(token, data) {
  await redis.setex(stateKey(token), STATE_TTL, JSON.stringify(data));
}

async function clearOAuthState(token) {
  await redis.del(stateKey(token));
}

// ─── Save credentials + notify operator via Telegram ─────────────────────────

async function saveAndNotify(state, accessToken, refreshToken, expiresAt, accountId) {
  await db.query(
    `INSERT INTO platform_accounts
       (client_id, platform, account_id, access_token, refresh_token, token_expiry, active)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE)
     ON CONFLICT (client_id, platform) DO UPDATE SET
       account_id    = EXCLUDED.account_id,
       access_token  = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expiry  = EXCLUDED.token_expiry,
       active        = TRUE,
       updated_at    = NOW()`,
    [
      state.clientId,
      state.platform,
      String(accountId),
      accessToken,
      refreshToken || null,
      expiresAt ? new Date(expiresAt).toISOString() : null,
    ]
  );

  await db.query(
    `UPDATE client_settings
     SET active_platforms = (
       SELECT array_agg(DISTINCT p.platform ORDER BY p.platform)
       FROM platform_accounts p
       WHERE p.client_id = $1 AND p.active = TRUE
     )
     WHERE client_id = $1`,
    [state.clientId]
  );

  const EMOJI = { instagram: '📸', linkedin: '💼', twitter: '🐦', threads: '🧵', facebook: '📘', youtube: '▶️' };
  const text = `${EMOJI[state.platform] || ''} ${state.platform} connected for ${state.clientName}!\n\nTo connect another platform run /connect again.`;

  await axios.post(
    `https://api.telegram.org/bot${env.telegram.bot_token}/sendMessage`,
    { chat_id: state.chatId, text }
  ).catch(err => logger.error('OAuth Telegram notify failed', { error: err.message }));

  logger.info('Platform connected via OAuth', { clientId: state.clientId, platform: state.platform });
}

// ─── HTML page helpers ────────────────────────────────────────────────────────

function htmlPage(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f1117;color:#f0f0f0}.box{text-align:center;max-width:420px;padding:2.5rem;background:#1a1d26;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.4)}h1{font-size:2rem;margin-bottom:.75rem}p{color:#9ca3af;line-height:1.5;margin:.5rem 0}form{text-align:left;margin-top:1rem}label{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;margin:.4rem 0;background:#0f1117;border-radius:10px;cursor:pointer;transition:background .15s}label:hover{background:#1e2433}input[type=radio]{width:1rem;height:1rem;accent-color:#f97316}button{display:block;width:100%;margin-top:1.25rem;padding:.85rem;background:#f97316;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;transition:opacity .15s}button:hover{opacity:.9}</style></head><body><div class="box">${body}</div></body></html>`;
}

function successPage(platform, clientName) {
  return htmlPage('Connected!', `<h1>✅ Connected!</h1><p>${platform} connected for <strong>${clientName}</strong>.</p><p style="margin-top:1rem;font-size:.9rem">You can close this tab.</p>`);
}

function errorPage(message) {
  return htmlPage('Error', `<h1>❌ Oops</h1><p>${message}</p><p style="margin-top:1rem;font-size:.9rem">Go back to Telegram and run /connect again.</p>`);
}

function selectionPage(accounts, state, platformLabel) {
  const options = accounts.map(a =>
    `<label><input type="radio" name="account_id" value="${a.id}" required> <span><strong>${a.name}</strong>${a.meta ? `<br><span style="color:#9ca3af;font-size:.92rem">${a.meta}</span>` : ''}</span></label>`
  ).join('');
  return htmlPage(
    `Select ${platformLabel} Account`,
    `<h1>Select Account</h1><p>Choose and verify which ${platformLabel} account to connect:</p>
    <form method="POST" action="/auth/meta/select">
      <input type="hidden" name="state" value="${state}">
      ${options}
      <button type="submit">Connect ✓</button>
    </form>`
  );
}

async function exchangeInstagramLongLivedToken(shortLivedToken) {
  try {
    const { data } = await axios.get('https://graph.instagram.com/access_token', {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: env.oauth.instagram_app_secret,
        access_token: shortLivedToken,
      },
    });
    return data;
  } catch (err) {
    const errorMessage =
      err.response?.data?.error_message ||
      err.response?.data?.error?.message ||
      err.message;

    logger.warn('Instagram long-lived token exchange failed; using short-lived token', {
      error: errorMessage,
    });

    return null;
  }
}

async function getInstagramProfile(accessToken, fallbackUserId) {
  try {
    const { data } = await axios.get(`${INSTAGRAM_GRAPH_API}/me`, {
      params: {
        fields: 'id,username,name',
        access_token: accessToken,
      },
    });
    return data;
  } catch (err) {
    const errorMessage =
      err.response?.data?.error_message ||
      err.response?.data?.error?.message ||
      err.message;

    logger.warn('Instagram profile lookup failed; using token exchange user_id', {
      error: errorMessage,
      fallbackUserId,
    });

    if (!fallbackUserId) throw err;
    return { id: fallbackUserId };
  }
}

// ─── Meta (Instagram / Facebook / Threads) ───────────────────────────────────

const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
].join(',');

const META_SCOPES = [
  'instagram_basic',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_manage_insights',
  'instagram_content_publish',
].join(',');

router.get('/instagram/start', async (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).send(errorPage('Missing state parameter.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.status(400).send(errorPage('Link expired. Run /connect again.'));

  const params = new URLSearchParams({
    client_id: env.oauth.instagram_app_id,
    redirect_uri: `${env.app_url}/auth/instagram/callback`,
    scope: INSTAGRAM_SCOPES,
    response_type: 'code',
    state,
  });

  res.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
});

router.get('/instagram/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(errorPage(`Instagram OAuth error: ${req.query.error_description || error}`));
  if (!code || !state) return res.send(errorPage('Missing code or state.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.send(errorPage('Link expired. Run /connect again.'));

  try {
    const { data: shortToken } = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: env.oauth.instagram_app_id,
        client_secret: env.oauth.instagram_app_secret,
        grant_type: 'authorization_code',
        redirect_uri: `${env.app_url}/auth/instagram/callback`,
        code: String(code).replace('#_', ''),
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const longToken = await exchangeInstagramLongLivedToken(shortToken.access_token);
    const accessToken = longToken?.access_token || shortToken.access_token;

    const profile = await getInstagramProfile(accessToken, shortToken.user_id);

    const expiresAt = (longToken?.expires_in || shortToken.expires_in)
      ? Date.now() + (longToken?.expires_in || shortToken.expires_in) * 1000
      : null;

    await saveAndNotify(
      oauthState,
      accessToken,
      null,
      expiresAt,
      profile.id
    );
    await clearOAuthState(state);
    return res.send(successPage('Instagram', oauthState.clientName));
  } catch (err) {
    logger.error('Instagram OAuth callback failed', {
      error: err.message,
      response: err.response?.data || null,
    });
    const msg =
      err.response?.data?.error_message ||
      err.response?.data?.error?.message ||
      err.message;
    return res.send(errorPage(`Connection failed: ${msg}`));
  }
});

router.get('/meta/start', async (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).send(errorPage('Missing state parameter.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.status(400).send(errorPage('Link expired. Run /connect again.'));

  const params = new URLSearchParams({
    client_id:     env.oauth.meta_app_id,
    redirect_uri:  `${env.app_url}/auth/meta/callback`,
    scope:         META_SCOPES,
    response_type: 'code',
    state,
  });
  res.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params}`);
});

router.get('/meta/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(errorPage(`Meta OAuth error: ${req.query.error_description || error}`));
  if (!code || !state) return res.send(errorPage('Missing code or state.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.send(errorPage('Link expired. Run /connect again.'));

  try {
    // Exchange code for short-lived token
    const { data: shortToken } = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: {
        client_id:     env.oauth.meta_app_id,
        client_secret: env.oauth.meta_app_secret,
        redirect_uri:  `${env.app_url}/auth/meta/callback`,
        code,
      },
    });

    // Extend to long-lived token (60 days)
    const { data: longToken } = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: {
        grant_type:        'fb_exchange_token',
        client_id:         env.oauth.meta_app_id,
        client_secret:     env.oauth.meta_app_secret,
        fb_exchange_token: shortToken.access_token,
      },
    });

    const userToken = longToken.access_token;
    const { platform } = oauthState;

    if (platform === 'instagram' || platform === 'threads') {
      // Fetch pages with linked Instagram business accounts
      const { data: pagesData } = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
        params: {
          access_token: userToken,
          fields: 'id,name,instagram_business_account{id,username,name}',
        },
      });

      const igAccounts = (pagesData.data || [])
        .filter(p => p.instagram_business_account)
        .map((p) => ({
          id: p.instagram_business_account.id,
          name: p.instagram_business_account.username
            ? `@${p.instagram_business_account.username}`
            : (p.instagram_business_account.name || p.name),
          meta: `Facebook Page: ${p.name} • Instagram ID: ${p.instagram_business_account.id}`,
        }));

      if (!igAccounts.length) {
        return res.send(errorPage('No Instagram Business accounts found linked to your Facebook pages.'));
      }

      if (igAccounts.length === 1) {
        await saveAndNotify(oauthState, userToken, null, null, igAccounts[0].id);
        await clearOAuthState(state);
        return res.send(successPage(platform === 'threads' ? 'Threads' : 'Instagram', oauthState.clientName));
      }

      // Multiple accounts — show selection UI
      oauthState.accounts = igAccounts;
      oauthState.userToken = userToken;
      await setOAuthState(state, oauthState);
      return res.send(selectionPage(igAccounts, state, platform === 'threads' ? 'Threads' : 'Instagram'));

    } else {
      // Facebook Pages
      const { data: pagesData } = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
        params: { access_token: userToken, fields: 'id,name,access_token' },
      });

      const pages = pagesData.data || [];
      if (!pages.length) return res.send(errorPage('No Facebook Pages found on your account.'));

      if (pages.length === 1) {
        await saveAndNotify(oauthState, pages[0].access_token, null, null, pages[0].id);
        await clearOAuthState(state);
        return res.send(successPage('Facebook', oauthState.clientName));
      }

      oauthState.accounts = pages.map(p => ({ id: p.id, name: p.name, token: p.access_token }));
      oauthState.userToken = userToken;
      await setOAuthState(state, oauthState);
      return res.send(selectionPage(oauthState.accounts, state, 'Facebook'));
    }
  } catch (err) {
    logger.error('Meta OAuth callback failed', { error: err.message });
    const msg = err.response?.data?.error?.message || err.message;
    return res.send(errorPage(`Connection failed: ${msg}`));
  }
});

router.post('/meta/select', express.urlencoded({ extended: false }), async (req, res) => {
  const { state, account_id } = req.body;
  if (!state || !account_id) return res.send(errorPage('Missing selection.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.send(errorPage('Link expired. Run /connect again.'));

  try {
    const account = (oauthState.accounts || []).find(a => String(a.id) === String(account_id));
    if (!account) return res.send(errorPage('Invalid selection.'));

    // Facebook pages have per-page token; Instagram/Threads accounts use user token
    const token = account.token || oauthState.userToken;
    await saveAndNotify(oauthState, token, null, null, account.id);
    await clearOAuthState(state);
    return res.send(successPage(oauthState.platform, oauthState.clientName));
  } catch (err) {
    logger.error('Meta account selection failed', { error: err.message });
    return res.send(errorPage(err.message));
  }
});

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

router.get('/linkedin/start', async (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).send(errorPage('Missing state parameter.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.status(400).send(errorPage('Link expired. Run /connect again.'));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     env.oauth.linkedin_client_id,
    redirect_uri:  `${env.app_url}/auth/linkedin/callback`,
    state,
    scope:         'w_member_social r_organization_social',
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

router.get('/linkedin/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(errorPage(`LinkedIn OAuth error: ${req.query.error_description || error}`));
  if (!code || !state) return res.send(errorPage('Missing code or state.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.send(errorPage('Link expired. Run /connect again.'));

  try {
    const { data: tokenData } = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${env.app_url}/auth/linkedin/callback`,
        client_id:     env.oauth.linkedin_client_id,
        client_secret: env.oauth.linkedin_client_secret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Get member URN via OpenID Connect userinfo
    const { data: profile } = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const urn = `urn:li:person:${profile.sub}`;
    const expiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null;

    await saveAndNotify(
      oauthState,
      tokenData.access_token,
      tokenData.refresh_token || null,
      expiresAt,
      urn
    );
    await clearOAuthState(state);
    return res.send(successPage('LinkedIn', oauthState.clientName));
  } catch (err) {
    logger.error('LinkedIn OAuth callback failed', { error: err.message });
    const msg = err.response?.data?.error_description || err.message;
    return res.send(errorPage(`Connection failed: ${msg}`));
  }
});

// ─── Twitter / X (OAuth 2.0 + PKCE) ─────────────────────────────────────────

router.get('/twitter/start', async (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).send(errorPage('Missing state parameter.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.status(400).send(errorPage('Link expired. Run /connect again.'));

  // Generate PKCE pair
  const codeVerifier  = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  oauthState.pkceVerifier = codeVerifier;
  await setOAuthState(state, oauthState);

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             env.oauth.twitter_client_id,
    redirect_uri:          `${env.app_url}/auth/twitter/callback`,
    scope:                 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });
  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
});

router.get('/twitter/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(errorPage(`Twitter OAuth error: ${req.query.error_description || error}`));
  if (!code || !state) return res.send(errorPage('Missing code or state.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.send(errorPage('Link expired. Run /connect again.'));

  try {
    const basicAuth = Buffer.from(
      `${env.oauth.twitter_client_id}:${env.oauth.twitter_client_secret}`
    ).toString('base64');

    const { data: tokenData } = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type:    'authorization_code',
        client_id:     env.oauth.twitter_client_id,
        redirect_uri:  `${env.app_url}/auth/twitter/callback`,
        code_verifier: oauthState.pkceVerifier,
      }).toString(),
      {
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          Authorization:   `Basic ${basicAuth}`,
        },
      }
    );

    // Get Twitter username
    const { data: userInfo } = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const handle = userInfo.data?.username || '';

    // Store as JSON so TwitterAdapter can detect oauth2 mode
    const credsJson = JSON.stringify({
      oauth2:        true,
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at:    tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    });

    await saveAndNotify(oauthState, credsJson, null, null, handle);
    await clearOAuthState(state);
    return res.send(successPage('Twitter/X', oauthState.clientName));
  } catch (err) {
    logger.error('Twitter OAuth callback failed', { error: err.message });
    const msg = err.response?.data?.error_description || err.message;
    return res.send(errorPage(`Connection failed: ${msg}`));
  }
});

// ─── Google / YouTube ─────────────────────────────────────────────────────────

router.get('/google/start', async (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).send(errorPage('Missing state parameter.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.status(400).send(errorPage('Link expired. Run /connect again.'));

  const params = new URLSearchParams({
    client_id:     env.oauth.google_client_id,
    redirect_uri:  `${env.app_url}/auth/google/callback`,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(errorPage(`Google OAuth error: ${req.query.error_description || error}`));
  if (!code || !state) return res.send(errorPage('Missing code or state.'));

  const oauthState = await getOAuthState(state);
  if (!oauthState) return res.send(errorPage('Link expired. Run /connect again.'));

  try {
    const { data: tokenData } = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id:     env.oauth.google_client_id,
        client_secret: env.oauth.google_client_secret,
        redirect_uri:  `${env.app_url}/auth/google/callback`,
        grant_type:    'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Get YouTube channel ID
    const { data: channelData } = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels',
      {
        params:  { part: 'snippet', mine: true },
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    const channelId = channelData.items?.[0]?.id || '';
    const expiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null;

    await saveAndNotify(
      oauthState,
      tokenData.access_token,
      tokenData.refresh_token || null,
      expiresAt,
      channelId
    );
    await clearOAuthState(state);
    return res.send(successPage('YouTube', oauthState.clientName));
  } catch (err) {
    logger.error('Google OAuth callback failed', { error: err.message });
    const msg = err.response?.data?.error_description || err.message;
    return res.send(errorPage(`Connection failed: ${msg}`));
  }
});

module.exports = router;
