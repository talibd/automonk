const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });

/**
 * Generates 3 ranked content ideas for a client.
 *
 * @param {object} params
 * @param {number} params.clientId
 * @param {string} params.niche
 * @param {string} params.toneOfVoice
 * @param {string} params.targetAudience
 * @param {string[]} params.activePlatforms
 * @param {string[]} params.recentTopics  - topics covered in last 30 days
 * @param {object|null} params.strategy   - latest client_strategy JSON, or null
 * @returns {Promise<{ideas: object[], autoSelectedRank: number}>}
 */
async function generateIdeas({ clientId, niche, toneOfVoice, targetAudience, activePlatforms, recentTopics, strategy }) {
  const strategySection = strategy
    ? `\n\nCurrent content strategy:\n${JSON.stringify(strategy)}`
    : '\n\nNo strategy yet — this is a new client. Default to broad educational evergreen topics.';

  const recentSection = recentTopics.length
    ? `\n\nRecent topics to avoid repeating:\n${recentTopics.map(t => `- ${t}`).join('\n')}`
    : '';

  const prompt = `You are generating content ideas for a social media content automation system.

Client details:
- Niche: ${niche}
- Tone of voice: ${toneOfVoice}
- Target audience: ${targetAudience}
- Active platforms: ${activePlatforms.join(', ')}
${recentSection}${strategySection}

Generate exactly 3 distinct content ideas. Each idea must work as a 10-slide carousel.
Rank them 1–3 by predicted engagement for this client's platform mix.

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "ideas": [
    {
      "rank": 1,
      "title": "short punchy title",
      "hook": "opening hook line for slide 1 (max 15 words)",
      "angle": "the specific framing that makes this unique",
      "why": "why this topic resonates with the target audience right now",
      "platform_fit": {
        "instagram": "high",
        "linkedin": "medium"
      }
    }
  ],
  "auto_selected_rank": 1
}

Only include platforms from the active_platforms list in platform_fit.
Values for platform_fit: "high", "medium", "low".`;

  logger.info('Generating ideas', { clientId, niche });

  const message = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    logger.error('Failed to parse idea generation response', { clientId, text });
    throw new Error('Claude returned invalid JSON for idea generation');
  }

  if (!Array.isArray(parsed.ideas) || parsed.ideas.length !== 3) {
    throw new Error('Claude did not return exactly 3 ideas');
  }

  logger.info('Ideas generated', { clientId, autoSelected: parsed.auto_selected_rank });
  return {
    ideas: parsed.ideas,
    autoSelectedRank: parsed.auto_selected_rank,
  };
}

module.exports = { generateIdeas };
