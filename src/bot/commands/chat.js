const Anthropic = require('@anthropic-ai/sdk');
const env = require('../../config/env');
const db = require('../../config/db');
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });

// Per-chat conversation history (resets on bot restart)
const history = new Map();
const MAX_TURNS = 6;

// Cache live context for 60s to avoid hitting DB on every message
let _liveContextCache = null;
let _liveContextExpiry = 0;

async function fetchLiveContext() {
  const now = Date.now();
  if (_liveContextCache && now < _liveContextExpiry) return _liveContextCache;

  try {
    const [clientsRes, pendingRes, scheduledRes, statsRes] = await Promise.all([
      // All active clients with settings
      db.query(`
        SELECT c.id, c.name, cs.approval_mode, cs.active_platforms,
               cs.niche, cs.idea_frequency,
               COUNT(p.id) FILTER (WHERE p.created_at > NOW() - INTERVAL '7 days') AS posts_this_week,
               COUNT(p.id) FILTER (WHERE p.status = 'approval_pending') AS pending,
               COUNT(p.id) FILTER (WHERE p.status = 'scheduled') AS scheduled_count,
               MAX(p.created_at) AS last_post_at
        FROM clients c
        LEFT JOIN client_settings cs ON cs.client_id = c.id
        LEFT JOIN posts p ON p.client_id = c.id
        WHERE c.archived = FALSE
        GROUP BY c.id, c.name, cs.approval_mode, cs.active_platforms, cs.niche, cs.idea_frequency
        ORDER BY c.name
      `),
      // Posts pending approval
      db.query(`
        SELECT p.id, c.name AS client, p.master_script->>'title' AS topic, p.created_at
        FROM posts p JOIN clients c ON c.id = p.client_id
        WHERE p.status = 'approval_pending'
        ORDER BY p.created_at ASC
      `),
      // Today's scheduled posts
      db.query(`
        SELECT s.scheduled_at, c.name AS client, pv.platform
        FROM schedules s
        JOIN clients c ON c.id = s.client_id
        JOIN post_variants pv ON pv.id = s.post_variant_id
        WHERE s.scheduled_at::date = CURRENT_DATE AND s.status = 'pending'
        ORDER BY s.scheduled_at ASC
        LIMIT 20
      `),
      // 7-day publish stats
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'posted') AS published,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled
        FROM post_variants
        WHERE created_at > NOW() - INTERVAL '7 days'
      `),
    ]);

    const clients = clientsRes.rows;
    const pending = pendingRes.rows;
    const scheduled = scheduledRes.rows;
    const stats = statsRes.rows[0] || {};

    const clientLines = clients.map(c =>
      `  - ${c.name} (ID:${c.id}) | mode:${c.approval_mode} | platforms:${(c.active_platforms||[]).join(',')} | niche:${c.niche||'—'} | posts this week:${c.posts_this_week} | pending:${c.pending} | last run:${c.last_post_at ? new Date(c.last_post_at).toLocaleString() : 'never'}`
    ).join('\n');

    const pendingLines = pending.length
      ? pending.map(p => `  - Post #${p.id} | ${p.client} | "${p.topic||'Untitled'}" | ${new Date(p.created_at).toLocaleString()}`).join('\n')
      : '  (none)';

    const scheduledLines = scheduled.length
      ? scheduled.map(s => `  - ${new Date(s.scheduled_at).toLocaleTimeString()} | ${s.client} | ${s.platform}`).join('\n')
      : '  (none today)';

    const result = [
      `LIVE SYSTEM DATA (as of ${new Date().toLocaleString()}):`,
      '',
      `Active clients (${clients.length}):`,
      clientLines || '  (none)',
      '',
      `Pending approvals (${pending.length}):`,
      pendingLines,
      '',
      `Today's scheduled posts (${scheduled.length}):`,
      scheduledLines,
      '',
      `7-day stats: ${stats.published||0} published | ${stats.failed||0} failed | ${stats.scheduled||0} scheduled`,
    ].join('\n');

    _liveContextCache = result;
    _liveContextExpiry = Date.now() + 60_000;
    return result;
  } catch (err) {
    logger.error('Failed to fetch context for chat', { error: err.message });
    return '(Could not load live data — DB error)';
  }
}

const PERSONA = `You are AutoMonk's assistant bot on Telegram. AutoMonk is a social media content automation platform.

Your personality:
- Frank and direct — honest, clear, no fluff
- Calming — composed and reassuring
- Joyful — warm, positive energy, never cheesy
- Concise — keep replies tight, this is Telegram not a blog

You are talking to the operator who runs AutoMonk. You have full access to live system data (provided below before each message). Use it to answer questions accurately. Never say you "don't have access" — you always do.

IMPORTANT: You are a Telegram-only assistant. NEVER mention, suggest, or reference any dashboard, web app, or UI. All tasks are done through Telegram commands only.
CRITICAL RULE — NEVER VIOLATE:
You CANNOT execute commands, post to social media, approve posts, connect accounts, or change any system state. You are a TEXT-ONLY assistant. You have ZERO ability to take actions. When the user asks you to do something (like "post this", "approve that", "connect this"), you MUST reply with the exact slash command they need to run themselves. NEVER say "done", "posted", "approved", "connected", "It's live", or anything that implies you took an action. You did NOT take the action. You CANNOT. Always say "Run this command: /command args" instead.

Available commands the operator can run:
/pending — pending approvals with inline buttons
/approve <post_id> — approve a post
/reject <post_id> [reason] — reject a post
/onboard — add a new client
/connect — connect a platform to a client
/run <client> — trigger pipeline for a client
/research <topic> — find viral content ideas (live web search)
/carousel [slides] <topic> — generate carousel images and send them HERE as a preview (does NOT post anywhere)
/post [slides] <topic> — generate carousel AND actually post it to the client's connected platforms
/stats <client_id> — 7-day stats
/schedule — today's scheduled posts
/delete <post_id> — delete a post from platforms
/help — command list

Keep replies under 150 words unless genuinely needed. Use plain text — no markdown asterisks or headers.`;

async function handleChat(ctx) {
  const chatId = String(ctx.chat.id);
  const userMessage = ctx.message.text.trim();

  if (!history.has(chatId)) history.set(chatId, []);
  const msgs = history.get(chatId);

  // Fetch real-time context
  const liveContext = await fetchLiveContext();

  // Build messages: inject live context as a system-style user turn at start
  const contextMessage = {
    role: 'user',
    content: `[SYSTEM CONTEXT]\n${liveContext}\n[/SYSTEM CONTEXT]\n\nOperator says: ${userMessage}`,
  };

  // For history, store the plain user message (not with context prefix)
  msgs.push({ role: 'user', content: userMessage });

  // Trim history
  while (msgs.length > MAX_TURNS * 2) msgs.shift();

  // Build the messages array: past history (without context) + current with context
  const pastHistory = msgs.slice(0, -1); // everything except current message
  const messagesForApi = [...pastHistory, contextMessage];

  try {
    await ctx.sendChatAction('typing');

    const response = await client.messages.create({
      model: env.anthropic.model,
      max_tokens: 400,
      system: PERSONA,
      messages: messagesForApi,
    });

    const reply = response.content[0]?.text?.trim() ?? "Drawing a blank — try again?";

    msgs.push({ role: 'assistant', content: reply });

    await ctx.reply(reply);
    logger.info('Chat response sent', { chatId, userMessage: userMessage.slice(0, 50) });
  } catch (err) {
    logger.error('Chat handler failed', { error: err.message });
    await ctx.reply("Something went sideways on my end. Give it another shot.");
  }
}

module.exports = { handleChat };
