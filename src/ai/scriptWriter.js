const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });

/**
 * Writes a 10-slide master script for the selected idea.
 *
 * @param {object} params
 * @param {number} params.clientId
 * @param {object} params.idea         - the selected idea object from generateIdeas
 * @param {string} params.niche
 * @param {string} params.toneOfVoice
 * @param {string} params.targetAudience
 * @param {object} params.ctaPreferences - { platform: ctaText }
 * @param {object|null} params.strategy
 * @returns {Promise<object>} masterScript with slides array
 */
async function writeMasterScript({ clientId, idea, niche, toneOfVoice, targetAudience, ctaPreferences, strategy }) {
  const strategySection = strategy
    ? `\n\nContent strategy guidance:\n${JSON.stringify(strategy)}`
    : '';

  // Use the first CTA found, master script uses a generic CTA; adapters apply platform-specific ones
  const genericCta = Object.values(ctaPreferences)[0] || 'Follow for more';

  const prompt = `You are writing a 10-slide educational carousel script for social media.

Client details:
- Niche: ${niche}
- Tone of voice: ${toneOfVoice}
- Target audience: ${targetAudience}
- CTA: ${genericCta}
${strategySection}

Topic to write about:
- Title: ${idea.title}
- Hook: ${idea.hook}
- Angle: ${idea.angle}

Write a 10-slide master script following this structure:
- Slide 1: Hook headline (grab attention, create curiosity or urgency)
- Slides 2–8: Key educational points (one clear point per slide, actionable)
- Slide 9: Summary / main takeaway
- Slide 10: CTA slide

Rules:
- Tone: ${toneOfVoice}
- Each slide has a headline (max 10 words) and body text (max 40 words)
- No filler, no fluff — every word earns its place
- Slide 1 hook must make someone stop scrolling
- Slides 2–8 must each teach one specific thing
- CTA on slide 10 must be exactly: "${genericCta}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "${idea.title}",
  "hook": "${idea.hook}",
  "slides": [
    {
      "slide_number": 1,
      "headline": "...",
      "body": "..."
    }
  ]
}`;

  logger.info('Writing master script', { clientId, title: idea.title });

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
    logger.error('Failed to parse script response', { clientId, text });
    throw new Error('Claude returned invalid JSON for script writing');
  }

  if (!Array.isArray(parsed.slides) || parsed.slides.length !== 10) {
    throw new Error('Claude did not return exactly 10 slides');
  }

  logger.info('Master script written', { clientId, title: parsed.title });
  return parsed;
}

module.exports = { writeMasterScript };
