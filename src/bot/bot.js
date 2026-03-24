const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const env = require('../config/env');
const db = require('../config/db');
const { setBotInstance } = require('./alerts');
const { setBot: setNotificationsBot } = require('./notifications');
const { handlePending } = require('./commands/pending');
const { handleApproveCommand, handleApproveCallback } = require('./commands/approve');
const { handleRejectCommand, handleRejectPromptCallback, handleRejectSkipCallback, handleRejectReasonText } = require('./commands/reject');
const { handleRun, handleRunText } = require('./commands/run');
const { handleChat } = require('./commands/chat');
const { handleResearch, handleResearchTopicCallback } = require('./commands/research');
const {
  handleOnboard, handleOnboardText,
  handlePlatformToggle, handlePlatformDone,
  handleFreqSelect, handleModeSelect,
  handleConfirm: handleOnboardConfirm,
  handleCancel:  handleOnboardCancel,
} = require('./commands/onboard');
const {
  handleConnect, handleClientSelect, handlePlatformSelect,
  handleConnectText,
  handleCancel: handleConnectCancel,
} = require('./commands/connect');
const { generateQuoteCarousel } = require('../ai/carouselGenerator');
const { renderSlides } = require('../renderer/slideRenderer');
const logger = require('../utils/logger');
const { resolvePlatformAccount } = require('../platformAccounts/resolveAccount');

const TWEET_STYLE_TEMPLATE = path.resolve(__dirname, '../../templates/default/tweet-style.js');

// ─── Shared carousel generator ────────────────────────────────────────────────
async function generateAndSendCarousel(ctx, topic, slideCount = 5) {
  const generatedSlides = await generateQuoteCarousel({
    topic, slideCount, clientName: '', niche: '', toneOfVoice: 'professional',
  });

  const slides = generatedSlides.map(s => ({ ...s, headline: s.quote, body: '' }));

  const pngBuffers = await renderSlides({
    slides,
    platform: 'instagram',
    templatePath: TWEET_STYLE_TEMPLATE,
    clientId: 0,
    context: { clientName: '', clientInitials: '', logoUrl: null, title: topic, totalSlides: slideCount },
  });

  const chunks = [];
  for (let i = 0; i < pngBuffers.length; i += 10) chunks.push(pngBuffers.slice(i, i + 10));

  for (const chunk of chunks) {
    if (chunk.length === 1) {
      await ctx.replyWithPhoto({ source: chunk[0] });
    } else {
      await ctx.replyWithMediaGroup(chunk.map(buf => ({ type: 'photo', media: { source: buf } })));
    }
  }

  logger.info('Carousel sent via Telegram', { topic, slideCount });
}

const bot = new Telegraf(env.telegram.bot_token);

// Register bot instance for alerts and notifications
setBotInstance(bot);
setNotificationsBot(bot);

// ─── Middleware: operator-only guard ─────────────────────────────────────────
bot.use((ctx, next) => {
  const chatId = String(ctx.chat?.id);
  if (chatId !== String(env.telegram.operator_chat_id)) {
    return ctx.reply('Unauthorized.');
  }
  return next();
});

// ─── /start & /help ──────────────────────────────────────────────────────────
const HELP_TEXT = [
  '<b>AutoMonk Control Panel</b>',
  '',
  '<b>Clients:</b>',
  '/onboard — add a new client (guided wizard)',
  '/connect — connect a platform account to a client',
  '',
  '<b>Approvals:</b>',
  '/pending — list posts awaiting approval',
  '/approve &lt;post_id&gt; — approve a post',
  '/reject &lt;post_id&gt; [reason] — reject a post',
  '',
  '<b>Pipeline:</b>',
  '/run &lt;client&gt; — trigger pipeline for a client',
  '/schedule — today\'s scheduled posts',
  '',
  '<b>Content:</b>',
  '/research &lt;topic&gt; — find viral content ideas (live web search)',
  '/carousel [slides] &lt;topic&gt; — generate carousel images (preview only)',
  '/post [slides] &lt;topic&gt; — generate carousel &amp; post to platforms',
  '',
  '<b>Stats:</b>',
  '/stats &lt;client_id&gt; — 7-day stats for a client',
  '/delete &lt;post_id&gt; — delete a post from platforms',
  '',
  'Or just chat — I know your full system.',
].join('\n');

bot.start((ctx) => ctx.reply(HELP_TEXT, { parse_mode: 'HTML' }));
bot.help ((ctx) => ctx.reply(HELP_TEXT, { parse_mode: 'HTML' }));

// ─── Approval commands ────────────────────────────────────────────────────────
bot.command('pending',  handlePending);
bot.command('approve',  handleApproveCommand);
bot.command('reject',   handleRejectCommand);
bot.command('run',      handleRun);

// ─── Onboarding command ───────────────────────────────────────────────────────
bot.command('onboard',  handleOnboard);

// ─── Connect platform command ─────────────────────────────────────────────────
bot.command('connect',  handleConnect);

// ─── Research viral content ───────────────────────────────────────────────────
bot.command('research', handleResearch);

// ─── Research topic → generate carousel callback ──────────────────────────────
bot.action(/^rc_topic:(\d+)$/, async (ctx) => {
  await handleResearchTopicCallback(ctx, generateAndSendCarousel);
});

// ─── Approval inline callbacks ────────────────────────────────────────────────
bot.action(/^approve:(\d+)$/,       handleApproveCallback);
bot.action(/^reject_prompt:(\d+)$/, handleRejectPromptCallback);
bot.action(/^reject_skip:(\d+)$/,   handleRejectSkipCallback);

// ─── Onboarding inline callbacks ─────────────────────────────────────────────
bot.action(/^ob_plat:(.+)$/,        handlePlatformToggle);
bot.action('ob_plat_done',          handlePlatformDone);
bot.action(/^ob_freq:(.+)$/,        handleFreqSelect);
bot.action(/^ob_mode:(.+)$/,        handleModeSelect);
bot.action('ob_confirm',            handleOnboardConfirm);
bot.action('ob_cancel',             handleOnboardCancel);

// ─── Connect platform inline callbacks ───────────────────────────────────────
bot.action(/^cn_client:(\d+):(.+)$/, handleClientSelect);
bot.action(/^cn_plat:(.+)$/,         handlePlatformSelect);
bot.action('cn_cancel',               handleConnectCancel);

// ─── /carousel [slide_count] <topic> ─────────────────────────────────────────
bot.command('carousel', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);

  if (parts.length < 2) {
    return ctx.reply('Usage: /carousel [slides] <topic>\n\nExamples:\n/carousel top 5 biceps exercises\n/carousel 7 the future of AI in marketing');
  }

  let slideCount = 5;
  let topicParts = parts.slice(1);

  if (/^\d+$/.test(topicParts[0])) {
    const n = parseInt(topicParts[0], 10);
    if (n >= 1 && n <= 20) { slideCount = n; topicParts = topicParts.slice(1); }
  }

  const topic = topicParts.join(' ');
  if (!topic) return ctx.reply('Please provide a topic.');

  await ctx.reply(`Generating ${slideCount}-slide carousel on "${topic}"...\n\nThis may take a moment.`);

  try {
    await generateAndSendCarousel(ctx, topic, slideCount);
  } catch (err) {
    logger.error('Carousel command failed', { topic, error: err.message });
    await ctx.reply(`Failed to generate carousel: ${err.message}`);
  }
});

// ─── /schedule — today's scheduled posts ─────────────────────────────────────
bot.command('schedule', async (ctx) => {
  try {
    const { rows } = await db.query(
      `SELECT s.scheduled_at, c.name AS client, pv.platform,
              p.master_script->>'title' AS topic
       FROM schedules s
       JOIN clients c ON c.id = s.client_id
       JOIN post_variants pv ON pv.id = s.post_variant_id
       JOIN posts p ON p.id = pv.post_id
       WHERE s.scheduled_at::date = CURRENT_DATE AND s.status = 'pending'
       ORDER BY s.scheduled_at ASC`
    );

    if (!rows.length) return ctx.reply('No posts scheduled for today.');

    const lines = rows.map(r => {
      const time = new Date(r.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${time} — ${r.client} → ${r.platform} — "${r.topic || 'Untitled'}"`;
    });
    ctx.reply(`📅 Today's schedule:\n\n${lines.join('\n')}`);
  } catch (err) {
    logger.error('Schedule command failed', { error: err.message });
    ctx.reply('Failed to fetch schedule.');
  }
});

// ─── /post [slides] <topic> — generate carousel & post to client's platforms ─
bot.command('post', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);

  if (parts.length < 2) {
    return ctx.reply('Usage: /post [slides] <topic>\n\nGenerates a carousel and posts it to your client\'s connected platforms.\n\nExamples:\n/post top 5 biceps exercises\n/post 7 the future of AI in marketing');
  }

  let slideCount = 5;
  let topicParts = parts.slice(1);

  if (/^\d+$/.test(topicParts[0])) {
    const n = parseInt(topicParts[0], 10);
    if (n >= 1 && n <= 20) { slideCount = n; topicParts = topicParts.slice(1); }
  }

  const topic = topicParts.join(' ');
  if (!topic) return ctx.reply('Please provide a topic.');

  // Find the client — for now pick the first active client with connected platforms
  const { rows: clients } = await db.query(
    `SELECT c.id, c.name, cs.active_platforms
     FROM clients c
     JOIN client_settings cs ON cs.client_id = c.id
     WHERE c.archived = FALSE
     ORDER BY c.name LIMIT 10`
  );

  if (!clients.length) return ctx.reply('No active clients. Run /onboard first.');

  // Filter to clients that have connected platform accounts
  const clientsWithAccounts = [];
  for (const client of clients) {
    const { rows: accounts } = await db.query(
      `SELECT platform FROM platform_accounts WHERE client_id = $1 AND active = TRUE`,
      [client.id]
    );
    if (accounts.length > 0) {
      clientsWithAccounts.push({ ...client, connectedPlatforms: accounts.map(a => a.platform) });
    }
  }

  if (!clientsWithAccounts.length) {
    return ctx.reply('No clients have connected platforms yet. Run /connect to link a platform first.');
  }

  const buttons = clientsWithAccounts.map(c =>
    [Markup.button.callback(`${c.name} (${c.connectedPlatforms.join(', ')})`, `post_client:${c.id}:${slideCount}:${encodeURIComponent(topic)}`)]
  );
  return ctx.reply('Which client should this post go to?', Markup.inlineKeyboard(buttons));
});

bot.action(/^post_client:(\d+):(\d+):(.+)$/, async (ctx) => {
  const clientId = parseInt(ctx.match[1], 10);
  const slideCount = parseInt(ctx.match[2], 10);
  const topic = decodeURIComponent(ctx.match[3]);
  await ctx.answerCbQuery();

  const { rows: [client] } = await db.query(
    'SELECT c.id, c.name FROM clients c WHERE c.id = $1', [clientId]
  );
  if (!client) return ctx.editMessageText('Client not found.');

  const { rows: accounts } = await db.query(
    'SELECT platform FROM platform_accounts WHERE client_id = $1 AND active = TRUE', [clientId]
  );
  client.connectedPlatforms = accounts.map(a => a.platform);

  await ctx.editMessageText(`Posting to ${client.name}...`);
  await executePost(ctx, client, topic, slideCount);
});

async function executePost(ctx, client, topic, slideCount) {
  const platforms = client.connectedPlatforms.filter(p => p !== 'youtube');
  if (!platforms.length) {
    return ctx.reply(`${client.name} has no auto-publishable platforms connected (only YouTube, which requires manual upload).`);
  }

  await ctx.reply(`Creating ${slideCount}-slide carousel on "${topic}" and posting to ${client.name}'s ${platforms.join(', ')}...\n\nThis may take a moment.`);

  try {
    const { createManualPost } = require('../pipeline/pipeline');
    const scheduledAt = new Date(Date.now() + 60 * 1000); // 1 minute from now

    const post = await createManualPost({
      clientId: client.id,
      topic,
      slideCount,
      platforms,
      scheduledAt,
    });

    await ctx.reply(`✅ Post #${post.id} created for ${client.name}!\n\nPlatforms: ${platforms.join(', ')}\nScheduled: in ~1 minute\n\nYou'll get a confirmation once it goes live.`);
  } catch (err) {
    logger.error('Post command failed', { topic, clientId: client.id, error: err.message });
    await ctx.reply(`Failed to create post: ${err.message}`);
  }
}

// ─── /stats [client_id] ──────────────────────────────────────────────────────
// NOTE: registered before bot.on('text') so it isn't shadowed by the text handler
bot.command('stats', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const clientId = parseInt(parts[1], 10);

  if (!clientId) {
    return ctx.reply('Usage: /stats [client_id]');
  }

  try {
    const { rows } = await db.query(
      `SELECT pv.platform,
              SUM(ps.likes) AS likes,
              SUM(ps.reach) AS reach,
              SUM(ps.impressions) AS impressions,
              COUNT(pv.id) AS posts
       FROM post_variants pv
       JOIN post_stats ps ON ps.post_variant_id = pv.id
       WHERE pv.client_id = $1
         AND ps.fetched_at > NOW() - INTERVAL '7 days'
       GROUP BY pv.platform`,
      [clientId]
    );

    if (!rows.length) {
      return ctx.reply(`No stats found for client ${clientId} in the last 7 days.`);
    }

    const lines = rows.map(r =>
      `${r.platform}: ${r.posts} posts | ${r.reach} reach | ${r.likes} likes`
    );
    ctx.reply(`📊 7-day stats for client ${clientId}:\n\n${lines.join('\n')}`);
  } catch (err) {
    logger.error('Stats command failed', { clientId, error: err.message });
    ctx.reply('Failed to fetch stats.');
  }
});

// ─── /delete [post_id] ────────────────────────────────────────────────────────
bot.command('delete', async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const postId = parseInt(parts[1], 10);

  if (!postId) return ctx.reply('Usage: /delete [post_id]');

  const { rows: variants } = await db.query(
    `SELECT id, platform, platform_post_id FROM post_variants
     WHERE post_id = $1 AND status = 'posted'`,
    [postId]
  );

  if (!variants.length) {
    return ctx.reply(`No live variants found for post ${postId}.`);
  }

  const platformButtons = variants.map(v =>
    Markup.button.callback(v.platform, `del_platform:${postId}:${v.id}`)
  );

  await ctx.reply(
    `Delete post ${postId} from:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🗑 Delete from ALL', `del_all:${postId}`)],
      platformButtons,
    ])
  );
});

// ─── Delete from all platforms ────────────────────────────────────────────────
bot.action(/^del_all:(\d+)$/, async (ctx) => {
  const postId = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery('Deleting from all platforms...');

  const { rows: variants } = await db.query(
    `SELECT id, platform, platform_post_id, client_id FROM post_variants
     WHERE post_id = $1 AND status = 'posted'`,
    [postId]
  );

  const results = await deleteVariants(variants);
  await ctx.editMessageText(formatDeleteResults(postId, results));
});

// ─── Delete from a single platform ───────────────────────────────────────────
bot.action(/^del_platform:(\d+):(\d+)$/, async (ctx) => {
  const postId = parseInt(ctx.match[1], 10);
  const variantId = parseInt(ctx.match[2], 10);
  await ctx.answerCbQuery('Deleting...');

  const { rows: [variant] } = await db.query(
    `SELECT id, platform, platform_post_id, client_id FROM post_variants WHERE id = $1`,
    [variantId]
  );

  if (!variant) return ctx.editMessageText('Variant not found.');

  const results = await deleteVariants([variant]);
  await ctx.editMessageText(formatDeleteResults(postId, results));
});

async function deleteVariants(variants) {
  const results = [];

  for (const variant of variants) {
    try {
      const { rows: [account] } = await db.query(
        'SELECT * FROM platform_accounts WHERE client_id = $1 AND platform = $2 AND active = TRUE',
        [variant.client_id, variant.platform]
      );

      if (account && variant.platform_post_id && variant.platform !== 'youtube') {
        const AdapterClass = require(`../adapters/${variant.platform}`);
        const resolvedAccount = await resolvePlatformAccount(account);
        const adapter = new AdapterClass(resolvedAccount);
        await adapter.deletePost(variant.platform_post_id);
      }

      await db.query(
        `UPDATE post_variants SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [variant.id]
      );

      results.push({ platform: variant.platform, ok: true });
    } catch (err) {
      logger.error('Delete failed', { variantId: variant.id, platform: variant.platform, error: err.message });
      results.push({ platform: variant.platform, ok: false, error: err.message });
    }
  }

  return results;
}

function formatDeleteResults(postId, results) {
  const lines = results.map(r =>
    r.ok ? `✅ ${r.platform}: deleted` : `❌ ${r.platform}: ${r.error}`
  );
  return `Post ${postId} delete results:\n${lines.join('\n')}`;
}

// ─── General text: connect → onboarding → rejection reason → chat fallback ───
// Must be last so all bot.command() handlers above take priority
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  if (await handleRunText(ctx))          return;
  if (await handleConnectText(ctx))      return;
  if (await handleOnboardText(ctx))      return;
  if (await handleRejectReasonText(ctx)) return;
  await handleChat(ctx);
});

module.exports = bot;
