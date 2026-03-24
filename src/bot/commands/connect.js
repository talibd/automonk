const crypto = require('crypto');
const { Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../../config/db');
const { redis } = require('../../config/redis');
const env = require('../../config/env');
const { createConnectSession, isNangoPlatformConfigured } = require('../../integrations/nango');

const anthropic = new Anthropic({ apiKey: env.anthropic.api_key });

// Platform-specific guidance shown when operator asks a question mid-wizard
const PLATFORM_GUIDE = {
  instagram: `How to connect Instagram:
• Recommended: use the built-in OAuth flow. It now uses Instagram Business Login directly, so AutoMonk discovers the account ID and token automatically.
• Requirements: the Instagram account must be a professional account (Business or Creator), and your Instagram app must have the callback URL configured in Meta.`,

  facebook: `How to get Facebook credentials:
• Page ID: Open your Facebook Page → About → scroll down to find "Page ID" (numeric).
• Access Token: Meta for Developers → Graph API Explorer → select your app → generate a Page Access Token with pages_manage_posts + pages_read_engagement permissions.`,

  linkedin: `How to get LinkedIn credentials:
• Organization URN: LinkedIn Developer Portal → your app → find the organization ID. Format: urn:li:organization:XXXXXXX
• Access Token: LinkedIn Developer Portal → Your App → Auth → OAuth 2.0 tools → request a token with w_member_social + r_organization_social scopes.`,

  twitter: `How to get Twitter/X credentials:
• Account ID (handle): Just your Twitter username without the @ sign (e.g. acmecorp).
• Access Token: developer.twitter.com → Your App → Keys and Tokens → generate Access Token and Secret. Combine as TOKEN:SECRET.`,

  threads: `How to get Threads credentials:
• User ID: Same as your connected Instagram numeric user ID (Threads shares the Meta platform).
• Access Token: Use the same Meta/Instagram token that has threads_basic + threads_content_publish permissions.`,

  youtube: `How to get YouTube credentials:
• Channel ID: Go to your YouTube channel → About → Share → Copy channel ID. Starts with UC...
• Access Token: Google Cloud Console → Enable YouTube Data API v3 → OAuth 2.0 credentials → authorise with https://www.googleapis.com/auth/youtube.upload scope.`,
};

function isQuestion(text) {
  const t = text.toLowerCase().trim();
  const questionWords = ['how', 'what', 'where', 'why', 'who', 'which', 'can i', 'do i', 'where do', 'how do', 'how can'];
  return t.endsWith('?') || questionWords.some(w => t.startsWith(w));
}

async function answerMidWizard(ctx, state, question) {
  const guide = state.platform ? PLATFORM_GUIDE[state.platform] : '';
  const stepLabel = {
    account_id:    `account ID for ${state.platform}`,
    access_token:  `access token for ${state.platform}`,
    refresh_token: `refresh token for ${state.platform}`,
    token_expiry:  'token expiry date',
  }[state.step] || 'the current field';

  const system = `You are AutoMonk's helpful assistant. The operator is connecting a ${state.platform || 'social media'} account for their client "${state.client_name || 'a client'}". They are currently being asked to provide the ${stepLabel}.

Platform guide:
${guide}

Answer their question clearly and concisely. After answering, remind them to paste the value when they have it. Keep it under 120 words.`;

  await ctx.sendChatAction('typing');
  const resp = await anthropic.messages.create({
    model: env.anthropic.model,
    max_tokens: 300,
    system,
    messages: [{ role: 'user', content: question }],
  });

  await ctx.reply(resp.content[0]?.text?.trim() ?? "Check the platform's developer portal for credentials.");
}

const STATE_TTL = 30 * 60;
const stateKey  = (chatId) => `connect:${chatId}`;

// ─── OAuth helpers ────────────────────────────────────────────────────────────

function isOAuthConfigured(platform) {
  const o = env.oauth;
  if (platform === 'instagram') return !!(o.instagram_app_id && o.instagram_app_secret);
  if (['facebook', 'threads'].includes(platform)) return !!(o.meta_app_id && o.meta_app_secret);
  if (platform === 'linkedin') return !!(o.linkedin_client_id && o.linkedin_client_secret);
  if (platform === 'twitter')  return !!(o.twitter_client_id && o.twitter_client_secret);
  if (platform === 'youtube')  return !!(o.google_client_id && o.google_client_secret);
  return false;
}

function oauthPath(platform) {
  if (platform === 'instagram') return 'instagram';
  if (['facebook', 'threads'].includes(platform)) return 'meta';
  if (platform === 'linkedin') return 'linkedin';
  if (platform === 'twitter')  return 'twitter';
  if (platform === 'youtube')  return 'google';
  return null;
}

function prefersAccessTokenFlow(platform) {
  return false;
}

const PLATFORMS = ['instagram', 'linkedin', 'twitter', 'threads', 'facebook', 'youtube'];
const PLATFORM_EMOJI = {
  instagram: '📸', linkedin: '💼', twitter: '🐦',
  threads: '🧵', facebook: '📘', youtube: '▶️',
};

// ─── State helpers ────────────────────────────────────────────────────────────

async function getState(chatId) {
  const raw = await redis.get(stateKey(chatId));
  return raw ? JSON.parse(raw) : null;
}
async function setState(chatId, state) {
  await redis.setex(stateKey(chatId), STATE_TTL, JSON.stringify(state));
}
async function clearState(chatId) {
  await redis.del(stateKey(chatId));
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

async function sendPlatformPicker(ctx, clientId, clientName, { edit = false } = {}) {
  const { rows: existing } = await db.query(
    `SELECT platform, active FROM platform_accounts WHERE client_id = $1`,
    [clientId]
  );
  const existingMap = Object.fromEntries(existing.map(r => [r.platform, r.active]));

  const buttons = PLATFORMS.map(p => {
    const tag = existingMap[p] !== undefined
      ? (existingMap[p] ? ' ✅' : ' ⚠️')
      : '';
    return [Markup.button.callback(`${PLATFORM_EMOJI[p]} ${p}${tag}`, `cn_plat:${p}`)];
  });
  buttons.push([Markup.button.callback('✕ Cancel', 'cn_cancel')]);

  const text   = `${clientName} — select a platform to connect:`;
  const markup = Markup.inlineKeyboard(buttons);
  return edit ? ctx.editMessageText(text, markup) : ctx.reply(text, markup);
}

async function sendPlatformConnect(ctx, chatId, state, platform, { edit = false } = {}) {
  state.platform = platform;
  const send = (text, markup) => edit ? ctx.editMessageText(text, markup) : ctx.reply(text, markup);

  if (prefersAccessTokenFlow(platform)) {
    const formToken = crypto.randomBytes(24).toString('hex');
    await redis.setex(
      `ct:${formToken}`,
      900,
      JSON.stringify({ chatId, clientId: state.client_id, clientName: state.client_name, platform })
    );
    await clearState(chatId);

    const formUrl = `${env.app_url}/connect/token/${formToken}?ngrok-skip-browser-warning=true`;
    return send(
      `${PLATFORM_EMOJI[platform]} Connect ${platform} for ${state.client_name}\n\nInstagram now defaults to access-token auth. Open the secure link below, paste your Meta long-lived token, and AutoMonk will resolve the Instagram Business account automatically.\n\n⏱ Link expires in 15 minutes.`,
      Markup.inlineKeyboard([
        [Markup.button.url('Paste Instagram Access Token', formUrl)],
        [Markup.button.callback('« Back', `cn_client:${state.client_id}:${encodeURIComponent(state.client_name)}`)],
      ])
    );
  }

  if (platform !== 'instagram' && isNangoPlatformConfigured(platform)) {
    const session = await createConnectSession({
      platform,
      clientId: state.client_id,
      clientName: state.client_name,
      chatId,
    });
    await clearState(chatId);

    return send(
      `${PLATFORM_EMOJI[platform]} Connect ${platform} for ${state.client_name}\n\nOpen the secure authorization link below and finish the provider login in Nango. AutoMonk will save the connection as soon as Nango sends the completion webhook.\n\nCopyable link:\n${session.connect_link}`,
      Markup.inlineKeyboard([
        [Markup.button.url('Connect with Nango', session.connect_link)],
        [Markup.button.callback('« Back', `cn_client:${state.client_id}:${encodeURIComponent(state.client_name)}`)],
      ])
    );
  }

  if (isOAuthConfigured(platform)) {
    const oauthToken = crypto.randomBytes(24).toString('hex');
    await redis.setex(
      `oauth:state:${oauthToken}`,
      600, // 10 min
      JSON.stringify({ chatId, clientId: state.client_id, clientName: state.client_name, platform })
    );
    await clearState(chatId);

    const path = oauthPath(platform);
    const oauthUrl = `${env.app_url}/auth/${path}/start?state=${oauthToken}&ngrok-skip-browser-warning=true`;
    const providerLabel = platform === 'instagram'
      ? 'Instagram'
      : ['facebook', 'threads'].includes(platform)
        ? 'Meta'
        : platform[0].toUpperCase() + platform.slice(1);

    return send(
      `${PLATFORM_EMOJI[platform]} Connect ${platform} for ${state.client_name}\n\nOpen the secure authorization link below and approve access. The account will be connected automatically after login.\n\nCopyable link:\n${oauthUrl}\n\n⏱ Link expires in 10 minutes.`,
      Markup.inlineKeyboard([
        [Markup.button.url(`🔐 Continue with ${providerLabel}`, oauthUrl)],
        [Markup.button.callback('« Back', `cn_client:${state.client_id}:${encodeURIComponent(state.client_name)}`)],
      ])
    );
  }

  // Fallback for platforms still using manual token entry
  const formToken = crypto.randomBytes(24).toString('hex');
  await redis.setex(
    `ct:${formToken}`,
    900, // 15 min
    JSON.stringify({ chatId, clientId: state.client_id, clientName: state.client_name, platform })
  );
  await clearState(chatId);

  const formUrl = `${env.app_url}/connect/token/${formToken}?ngrok-skip-browser-warning=true`;
  return send(
    `${PLATFORM_EMOJI[platform]} Connect ${platform} for ${state.client_name}\n\nOpen the secure link below and paste your access token — the account will be connected automatically.\n\n⏱ Link expires in 15 minutes.`,
    Markup.inlineKeyboard([
      [Markup.button.url('🔐 Enter Access Token', formUrl)],
      [Markup.button.callback('« Back', `cn_client:${state.client_id}:${encodeURIComponent(state.client_name)}`)],
    ])
  );
}

// ─── /connect [client] [platform] ────────────────────────────────────────────

async function handleConnect(ctx) {
  const chatId = String(ctx.chat.id);
  await clearState(chatId);

  const { rows: clients } = await db.query(
    `SELECT id, name FROM clients WHERE archived = FALSE ORDER BY name`
  );
  if (!clients.length) return ctx.reply('No active clients yet. Run /onboard to add one first.');

  // Parse optional inline args: /connect [clientName] [platform]
  const parts       = ctx.message.text.trim().split(/\s+/).slice(1);
  const clientArg   = parts[0]?.toLowerCase();
  const platformArg = parts[1]?.toLowerCase();

  if (clientArg) {
    const match = clients.find(c => c.name.toLowerCase().includes(clientArg));
    if (!match) {
      const list = clients.map(c => `• ${c.name}`).join('\n');
      return ctx.reply(`No client found matching "${parts[0]}".\n\nAvailable:\n${list}`);
    }

    const state = {
      step: 'platform',
      client_id: match.id, client_name: match.name,
      platform: null, account_id: null,
      access_token: null, refresh_token: null, token_expiry: null,
    };

    if (platformArg) {
      const platform = PLATFORMS.find(p => p.startsWith(platformArg));
      if (!platform) return ctx.reply(`Unknown platform "${parts[1]}". Options: ${PLATFORMS.join(', ')}`);
      return sendPlatformConnect(ctx, chatId, state, platform);
    }

    await setState(chatId, state);
    return sendPlatformPicker(ctx, match.id, match.name);
  }

  // Default: show client list
  await setState(chatId, {
    step: 'client',
    client_id: null, client_name: null,
    platform: null, account_id: null,
    access_token: null, refresh_token: null, token_expiry: null,
  });

  const buttons = clients.map(c => [
    Markup.button.callback(c.name, `cn_client:${c.id}:${encodeURIComponent(c.name)}`),
  ]);
  buttons.push([Markup.button.callback('✕ Cancel', 'cn_cancel')]);
  await ctx.reply('Which client are you connecting a platform for?', Markup.inlineKeyboard(buttons));
}

// ─── Callback: select client ──────────────────────────────────────────────────

async function handleClientSelect(ctx) {
  const chatId     = String(ctx.chat.id);
  const clientId   = parseInt(ctx.match[1], 10);
  const clientName = decodeURIComponent(ctx.match[2]);
  await ctx.answerCbQuery();

  const state = await getState(chatId);
  if (!state) return ctx.reply('Session expired. Run /connect again.');

  state.client_id   = clientId;
  state.client_name = clientName;
  state.step        = 'platform';
  await setState(chatId, state);

  return sendPlatformPicker(ctx, clientId, clientName, { edit: true });
}

// ─── Callback: select platform ────────────────────────────────────────────────

async function handlePlatformSelect(ctx) {
  const chatId   = String(ctx.chat.id);
  const platform = ctx.match[1];
  await ctx.answerCbQuery();

  const state = await getState(chatId);
  if (!state) return ctx.reply('Session expired. Run /connect again.');

  return sendPlatformConnect(ctx, chatId, state, platform, { edit: true });
}

// ─── Text handler (returns true if consumed) ──────────────────────────────────

async function handleConnectText(ctx) {
  const chatId = String(ctx.chat.id);
  const state  = await getState(chatId);
  if (!state) return false;

  // Answer questions about connecting platforms without consuming the session
  const text = ctx.message.text.trim();
  if (isQuestion(text)) {
    await answerMidWizard(ctx, state, text);
    return true;
  }

  return false;
}


// ─── Callback: cancel ─────────────────────────────────────────────────────────

async function handleCancel(ctx) {
  const chatId = String(ctx.chat.id);
  await ctx.answerCbQuery();
  await clearState(chatId);
  await ctx.editMessageText('Connection cancelled. Run /connect whenever you\'re ready.');
}

module.exports = {
  handleConnect,
  handleClientSelect,
  handlePlatformSelect,
  handleConnectText,
  handleCancel,
};
