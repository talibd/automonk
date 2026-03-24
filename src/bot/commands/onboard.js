const { Markup } = require('telegraf');
const db = require('../../config/db');
const { redis } = require('../../config/redis');
const { startClientCron } = require('../../scheduler/cron');
const logger = require('../../utils/logger');

function isQuestion(text) {
  const t = text.toLowerCase().trim();
  const questionWords = ['how', 'what', 'where', 'why', 'who', 'which', 'can i', 'do i'];
  return t.endsWith('?') || questionWords.some(w => t.startsWith(w));
}

const STATE_TTL = 30 * 60; // 30 minutes
const stateKey = (chatId) => `onboard:${chatId}`;

const ALL_PLATFORMS = ['instagram', 'linkedin', 'twitter', 'threads', 'facebook', 'youtube'];

const PLATFORM_EMOJI = {
  instagram: '📸', linkedin: '💼', twitter: '🐦',
  threads: '🧵', facebook: '📘', youtube: '▶️',
};

const FREQ_OPTIONS = [
  { label: 'Daily',        value: 'daily' },
  { label: 'Every 2 days', value: 'every_2_days' },
  { label: 'Weekly',       value: 'weekly' },
  { label: 'Manual only',  value: 'manual' },
];

const MODE_OPTIONS = [
  { label: '👀 Supervised — I approve each post', value: 'supervised' },
  { label: '⚡ Auto-publish — post automatically', value: 'auto' },
];

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

// ─── Step renderers ───────────────────────────────────────────────────────────

function platformKeyboard(selected) {
  const rows = [];
  for (let i = 0; i < ALL_PLATFORMS.length; i += 2) {
    const row = ALL_PLATFORMS.slice(i, i + 2).map(p => {
      const on = selected.includes(p);
      return Markup.button.callback(
        `${on ? '✅' : '⬜'} ${PLATFORM_EMOJI[p]} ${p}`,
        `ob_plat:${p}`
      );
    });
    rows.push(row);
  }
  rows.push([Markup.button.callback('✓ Done — confirm platforms', 'ob_plat_done')]);
  return Markup.inlineKeyboard(rows);
}

function freqKeyboard() {
  return Markup.inlineKeyboard(
    FREQ_OPTIONS.map(o => [Markup.button.callback(o.label, `ob_freq:${o.value}`)])
  );
}

function modeKeyboard() {
  return Markup.inlineKeyboard(
    MODE_OPTIONS.map(o => [Markup.button.callback(o.label, `ob_mode:${o.value}`)])
  );
}

function confirmText(s) {
  return [
    'Here\'s the summary — everything look good?',
    '',
    `Name:            ${s.name}`,
    `Niche:           ${s.niche}`,
    `Tone:            ${s.tone_of_voice}`,
    `Audience:        ${s.target_audience}`,
    `Platforms:       ${s.active_platforms.join(', ') || '(none)'}`,
    `Frequency:       ${s.idea_frequency}`,
    `Approval mode:   ${s.approval_mode}`,
  ].join('\n');
}

function confirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Create client', 'ob_confirm')],
    [Markup.button.callback('✏️ Start over',    'ob_cancel')],
  ]);
}

// ─── /onboard command ─────────────────────────────────────────────────────────

async function handleOnboard(ctx) {
  const chatId = String(ctx.chat.id);
  const existing = await getState(chatId);

  if (existing) {
    await clearState(chatId);
  }

  await setState(chatId, {
    step: 'name',
    name: null, niche: null, tone_of_voice: null, target_audience: null,
    active_platforms: [], idea_frequency: null, approval_mode: null,
  });

  await ctx.reply(
    "Let's onboard a new client.\n\nWhat's their name or brand?",
    { reply_markup: { force_reply: true } }
  );
}

// ─── Text input handler (returns true if consumed) ────────────────────────────

async function handleOnboardText(ctx) {
  const chatId = String(ctx.chat.id);
  const state = await getState(chatId);
  if (!state) return false;

  const text = ctx.message.text.trim();

  // Let questions pass through to the chat handler without eating wizard state
  if (isQuestion(text) && ['name','niche','tone','audience'].includes(state.step)) {
    return false;
  }

  switch (state.step) {
    case 'name':
      state.name = text;
      state.step = 'niche';
      await setState(chatId, state);
      await ctx.reply(`Great — ${text}!\n\nWhat's their niche or industry?\n(e.g. "fitness coaching", "B2B SaaS", "real estate")`);
      return true;

    case 'niche':
      state.niche = text;
      state.step = 'tone';
      await setState(chatId, state);
      await ctx.reply('What\'s their tone of voice?\n(e.g. "professional", "casual and motivational", "bold and direct")');
      return true;

    case 'tone':
      state.tone_of_voice = text;
      state.step = 'audience';
      await setState(chatId, state);
      await ctx.reply('Describe their target audience.\n(e.g. "busy professionals aged 30-45", "early-stage startup founders")');
      return true;

    case 'audience':
      state.target_audience = text;
      state.step = 'platforms';
      await setState(chatId, state);
      await ctx.reply(
        'Which platforms should we create content for?\nTap to toggle, then hit Done.',
        platformKeyboard(state.active_platforms)
      );
      return true;

    default:
      return false;
  }
}

// ─── Callback: toggle platform ────────────────────────────────────────────────

async function handlePlatformToggle(ctx) {
  const chatId = String(ctx.chat.id);
  const platform = ctx.match[1];
  await ctx.answerCbQuery();

  const state = await getState(chatId);
  if (!state || state.step !== 'platforms') return;

  const idx = state.active_platforms.indexOf(platform);
  if (idx === -1) state.active_platforms.push(platform);
  else state.active_platforms.splice(idx, 1);

  await setState(chatId, state);
  await ctx.editMessageReplyMarkup(platformKeyboard(state.active_platforms).reply_markup);
}

// ─── Callback: platforms done ─────────────────────────────────────────────────

async function handlePlatformDone(ctx) {
  const chatId = String(ctx.chat.id);
  await ctx.answerCbQuery();

  const state = await getState(chatId);
  if (!state) return;

  if (!state.active_platforms.length) {
    return ctx.answerCbQuery('Select at least one platform!', { show_alert: true });
  }

  state.step = 'frequency';
  await setState(chatId, state);

  await ctx.reply(
    `Platforms set: ${state.active_platforms.map(p => PLATFORM_EMOJI[p] + p).join(', ')}\n\nHow often should we generate content?`,
    freqKeyboard()
  );
}

// ─── Callback: select frequency ───────────────────────────────────────────────

async function handleFreqSelect(ctx) {
  const chatId = String(ctx.chat.id);
  const freq = ctx.match[1];
  await ctx.answerCbQuery();

  const state = await getState(chatId);
  if (!state) return;

  state.idea_frequency = freq;
  state.step = 'mode';
  await setState(chatId, state);

  await ctx.reply(
    `Frequency: ${freq}\n\nApproval mode?`,
    modeKeyboard()
  );
}

// ─── Callback: select approval mode ──────────────────────────────────────────

async function handleModeSelect(ctx) {
  const chatId = String(ctx.chat.id);
  const mode = ctx.match[1];
  await ctx.answerCbQuery();

  const state = await getState(chatId);
  if (!state) return;

  state.approval_mode = mode;
  state.step = 'confirm';
  await setState(chatId, state);

  await ctx.reply(confirmText(state), confirmKeyboard());
}

// ─── Callback: confirm → create client ───────────────────────────────────────

async function handleConfirm(ctx) {
  const chatId = String(ctx.chat.id);
  await ctx.answerCbQuery('Creating client...');

  const state = await getState(chatId);
  if (!state) return ctx.reply('Session expired. Run /onboard again.');

  const dbConn = await db.getClient();
  try {
    await dbConn.query('BEGIN');

    const { rows: [newClient] } = await dbConn.query(
      'INSERT INTO clients (name) VALUES ($1) RETURNING *',
      [state.name]
    );

    await dbConn.query(
      `INSERT INTO client_settings (
        client_id, active_platforms, niche, tone_of_voice, target_audience,
        hashtag_sets, cta_preferences, idea_frequency, approval_mode,
        weekly_optimization, posting_times
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        newClient.id,
        state.active_platforms,
        state.niche,
        state.tone_of_voice,
        state.target_audience,
        JSON.stringify({}),
        JSON.stringify({}),
        state.idea_frequency,
        state.approval_mode,
        true,
        JSON.stringify({}),
      ]
    );

    await dbConn.query('COMMIT');
    startClientCron(newClient.id, state.idea_frequency);
    await clearState(chatId);

    await ctx.editMessageText(
      `Client created!\n\n${state.name} is live. ID: #${newClient.id}\n\nYou can now connect platforms via the dashboard, or run the pipeline any time with:\n/run ${state.name.split(' ')[0].toLowerCase()}`
    );

    logger.info('Client created via Telegram', { clientId: newClient.id, name: state.name });
  } catch (err) {
    await dbConn.query('ROLLBACK');
    logger.error('Client creation failed', { error: err.message });
    await ctx.reply(`Failed to create client: ${err.message}`);
  } finally {
    dbConn.release();
  }
}

// ─── Callback: cancel ────────────────────────────────────────────────────────

async function handleCancel(ctx) {
  const chatId = String(ctx.chat.id);
  await ctx.answerCbQuery();
  await clearState(chatId);
  await ctx.editMessageText('Onboarding cancelled. Run /onboard whenever you\'re ready.');
}

module.exports = {
  handleOnboard,
  handleOnboardText,
  handlePlatformToggle,
  handlePlatformDone,
  handleFreqSelect,
  handleModeSelect,
  handleConfirm,
  handleCancel,
};
