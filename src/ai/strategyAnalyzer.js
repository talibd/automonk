const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/db');
const env = require('../config/env');
const { sendAlert } = require('../bot/alerts');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });

/**
 * Runs weekly strategy analysis for a single client:
 * 1. Fetches last 7 days of post stats from the database
 * 2. Calls Claude to generate an updated content strategy
 * 3. Saves a new versioned entry in client_strategy
 * 4. Sends a weekly Telegram summary to the operator
 *
 * @param {number} clientId
 */
async function analyzeAndUpdateStrategy(clientId) {
  logger.info('Strategy analysis: starting', { clientId });

  const settings = await getClientSettings(clientId);
  const recentStats = await getRecentStats(clientId);
  const currentStrategy = await getCurrentStrategy(clientId);

  if (recentStats.length === 0) {
    logger.info('Strategy analysis: no stats data yet, skipping', { clientId });
    await sendAlert(
      `📊 Weekly report — Client ${clientId}\nNo post stats available yet. Strategy unchanged.`
    );
    return;
  }

  const newStrategy = await generateStrategy({ clientId, settings, recentStats, currentStrategy });
  const version = await saveStrategy(clientId, newStrategy);

  await sendWeeklySummary(clientId, recentStats, newStrategy, version);

  logger.info('Strategy analysis: complete', { clientId, version });
}

// ─── Data fetchers ─────────────────────────────────────────────────────────

async function getClientSettings(clientId) {
  const { rows: [s] } = await db.query(
    'SELECT * FROM client_settings WHERE client_id = $1',
    [clientId]
  );
  if (!s) throw new Error(`No settings for client ${clientId}`);
  return s;
}

async function getRecentStats(clientId) {
  const { rows } = await db.query(
    `SELECT
       COALESCE(p.master_script->>'title', 'Untitled') AS title,
       pv.platform,
       ps.likes,
       ps.comments,
       ps.shares,
       ps.saves,
       ps.reach,
       ps.impressions,
       ps.views,
       pv.posted_at
     FROM post_stats ps
     JOIN post_variants pv ON pv.id = ps.post_variant_id
     JOIN posts p ON p.id = pv.post_id
     WHERE ps.client_id = $1
       AND ps.fetched_at > NOW() - INTERVAL '7 days'
     ORDER BY pv.posted_at DESC`,
    [clientId]
  );
  return rows;
}

async function getCurrentStrategy(clientId) {
  const { rows } = await db.query(
    'SELECT strategy, version FROM client_strategy WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [clientId]
  );
  return rows.length ? rows[0] : null;
}

// ─── Claude analysis ──────────────────────────────────────────────────────

async function generateStrategy({ clientId, settings, recentStats, currentStrategy }) {
  const prompt = buildStrategyPrompt({ settings, recentStats, currentStrategy });

  logger.info('Strategy analysis: calling Claude', { clientId });

  const message = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    logger.error('Strategy analysis: Claude returned invalid JSON', { clientId, text });
    throw new Error('Claude returned invalid JSON for strategy analysis');
  }

  return parsed;
}

function buildStrategyPrompt({ settings, recentStats, currentStrategy }) {
  const statsLines = recentStats.map(
    (r) =>
      `- "${r.title}" (${r.platform}): ${r.likes} likes, ${r.comments} comments, ` +
      `${r.shares} shares, ${r.views || r.impressions} views/impressions`
  );

  const currentStr = currentStrategy
    ? `\n\nCurrent strategy (v${currentStrategy.version}):\n${JSON.stringify(currentStrategy.strategy)}`
    : '\n\nNo previous strategy — this is the first analysis.';

  const platforms = (settings.active_platforms || []).join(', ');

  return `You are analyzing weekly social media performance for a content automation client.

Client profile:
- Niche: ${settings.niche}
- Tone of voice: ${settings.tone_of_voice}
- Target audience: ${settings.target_audience}
- Active platforms: ${platforms}
${currentStr}

Last 7 days performance data:
${statsLines.join('\n') || '(no data)'}

Analyze the data and return an updated content strategy. Identify what is working and what should change.

Return ONLY valid JSON (no markdown, no explanation):
{
  "top_performing_themes": ["theme1", "theme2", "theme3"],
  "worst_performing_themes": ["theme1"],
  "platform_insights": {
    "instagram": {
      "engagement_level": "high|medium|low",
      "recommendation": "one sentence on what to do more or less of"
    }
  },
  "content_recommendations": {
    "increase": ["specific content type or theme to do more of"],
    "decrease": ["specific content type or theme to do less of"]
  },
  "ideal_posting_patterns": {
    "instagram": "best time/frequency recommendation"
  },
  "overall_strategy": "2-3 sentence strategy summary for the coming week"
}

Only include active platforms in platform_insights and ideal_posting_patterns.`;
}

// ─── Persistence ──────────────────────────────────────────────────────────

async function saveStrategy(clientId, strategy) {
  const { rows } = await db.query(
    'SELECT COALESCE(MAX(version), 0) AS max_version FROM client_strategy WHERE client_id = $1',
    [clientId]
  );
  const version = rows[0].max_version + 1;

  await db.query(
    'INSERT INTO client_strategy (client_id, version, strategy) VALUES ($1, $2, $3)',
    [clientId, version, JSON.stringify(strategy)]
  );

  return version;
}

// ─── Telegram summary ────────────────────────────────────────────────────

async function sendWeeklySummary(clientId, recentStats, strategy, version) {
  const totalLikes = recentStats.reduce((s, r) => s + (r.likes || 0), 0);
  const totalComments = recentStats.reduce((s, r) => s + (r.comments || 0), 0);
  const totalShares = recentStats.reduce((s, r) => s + (r.shares || 0), 0);
  const totalViews = recentStats.reduce((s, r) => s + (r.views || r.impressions || 0), 0);
  const uniquePosts = new Set(recentStats.map((r) => r.title)).size;

  const topThemes = (strategy.top_performing_themes || []).slice(0, 3).join(', ') || 'N/A';
  const recommendations = (strategy.content_recommendations?.increase || []).slice(0, 2).join(', ') || 'N/A';

  const summary =
    `📊 <b>Weekly Report — Client ${clientId}</b>\n\n` +
    `Posts tracked: ${uniquePosts}\n` +
    `Total likes: ${totalLikes}\n` +
    `Total comments: ${totalComments}\n` +
    `Total shares: ${totalShares}\n` +
    `Total views/impressions: ${totalViews}\n\n` +
    `🏆 Top themes: ${topThemes}\n` +
    `📈 Focus on: ${recommendations}\n\n` +
    `💡 <b>Strategy v${version}:</b> ${strategy.overall_strategy || 'Updated.'}`;

  await sendAlert(summary);
}

module.exports = { analyzeAndUpdateStrategy };
