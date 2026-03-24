const Anthropic = require('@anthropic-ai/sdk');
const { Markup } = require('telegraf');
const env = require('../../config/env');
const db = require('../../config/db');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });
const TOPICS_TTL = 30 * 60; // 30 min

function topicsKey(chatId) { return `rc_topics:${chatId}`; }

async function handleResearch(ctx) {
  const parts = ctx.message.text.trim().split(/\s+/);

  if (parts.length < 2) {
    return ctx.reply(
      'Usage: /research <client or topic>\n\nExamples:\n/research gymbroke\n/research fat loss tips'
    );
  }

  const query = parts.slice(1).join(' ');
  await ctx.reply(`🔍 Finding viral carousel ideas for "${query}"...`);
  await ctx.sendChatAction('typing');

  try {
    // Try to match first word to a client and pull their niche
    const { rows } = await db.query(
      `SELECT c.name, cs.niche FROM clients c
       LEFT JOIN client_settings cs ON cs.client_id = c.id
       WHERE c.archived = FALSE AND c.name ILIKE $1
       LIMIT 1`,
      [`%${parts[1]}%`]
    );

    const matched = rows[0];
    const niche = matched?.niche || query;
    const clientLabel = matched ? `${matched.name} (${niche})` : query;

    const response = await client.messages.create({
      model: env.anthropic.model,
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [
        {
          role: 'user',
          content: `Search for what's currently going viral on Instagram and social media in the "${niche}" niche.

I need exactly 6 carousel post ideas that would get high saves and shares right now. Carousels are slide-based educational or inspirational posts (like "5 mistakes", "how to", "reasons why", "before vs after" etc).

Return ONLY this format, nothing else:

TOPIC: <carousel title — catchy, under 8 words>
WHY: <one sentence on why it's viral right now>

TOPIC: <carousel title>
WHY: <one sentence>

(repeat 6 times)`,
        },
      ],
    });

    const raw = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // Parse TOPIC: lines
    const topicMatches = [...raw.matchAll(/TOPIC:\s*(.+)/g)];
    const whyMatches   = [...raw.matchAll(/WHY:\s*(.+)/g)];

    if (!topicMatches.length) {
      return ctx.reply('Could not parse topic ideas — try a more specific query.');
    }

    const topics = topicMatches.map((m, i) => ({
      title: m[1].trim(),
      why:   whyMatches[i]?.[1]?.trim() || '',
    }));

    // Store topics in Redis so callback can retrieve them
    const chatId = String(ctx.chat.id);
    await redis.setex(topicsKey(chatId), TOPICS_TTL, JSON.stringify(topics));

    // Build message
    const lines = topics.map((t, i) =>
      `${i + 1}. ${t.title}\n    ↳ ${t.why}`
    );

    const msg = `🎠 Viral carousel ideas for ${clientLabel}:\n\n${lines.join('\n\n')}\n\nTap a topic to generate it:`;

    // One button per topic
    const buttons = topics.map((t, i) =>
      [Markup.button.callback(`🎠 ${i + 1}. ${t.title.slice(0, 40)}`, `rc_topic:${i}`)]
    );

    await ctx.reply(
      msg.length > 4000 ? msg.slice(0, 3997) + '…' : msg,
      Markup.inlineKeyboard(buttons)
    );

    logger.info('Research completed', { query, topics: topics.length });
  } catch (err) {
    logger.error('Research command failed', { query, error: err.message });
    await ctx.reply(`Research failed: ${err.message}`);
  }
}

async function handleResearchTopicCallback(ctx, generateCarousel) {
  const index = parseInt(ctx.match[1], 10);
  const chatId = String(ctx.chat.id);

  await ctx.answerCbQuery('Generating carousel...');

  const raw = await redis.get(topicsKey(chatId));
  if (!raw) {
    return ctx.reply('Session expired — run /research again.');
  }

  const topics = JSON.parse(raw);
  const topic = topics[index];
  if (!topic) {
    return ctx.reply('Topic not found — run /research again.');
  }

  await ctx.reply(`Generating carousel: "${topic.title}"\n\nThis may take a moment...`);
  await generateCarousel(ctx, topic.title);
}

module.exports = { handleResearch, handleResearchTopicCallback };
