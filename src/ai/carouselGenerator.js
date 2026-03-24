const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });

/**
 * Generates N quote-style carousel slides for a topic using Claude.
 *
 * @param {object} params
 * @param {string} params.topic
 * @param {number} params.slideCount
 * @param {string} params.clientName
 * @param {string} [params.niche]
 * @param {string} [params.toneOfVoice]
 * @returns {Promise<Array<{ slide_number: number, quote: string }>>}
 */
async function generateQuoteCarousel({ topic, slideCount, clientName, niche = '', toneOfVoice = 'professional' }) {
  const nicheCtx = niche ? `\nNiche/industry: ${niche}` : '';

  const prompt = `You are creating a ${slideCount}-slide quote carousel for "${clientName}" on the topic: "${topic}".${nicheCtx}
Tone: ${toneOfVoice}

Generate exactly ${slideCount} short, punchy, insightful quotes or statements about "${topic}".

Rules:
- Each quote must stand alone — no context needed from other slides
- Maximum 20 words per quote
- Vary the style: bold statements, rhetorical questions, contrarian takes, surprising facts
- Slide 1 must be the strongest hook — make someone stop scrolling
- Last slide should end with a powerful, memorable conclusion
- No filler words, no clichés, no generic advice
- Write in a ${toneOfVoice} tone
- Use **bold** to emphasize 1–3 key concept words per quote (e.g. "Ignoring **content creation** is ignoring **the future**.")
- Bold ONLY the most impactful nouns or phrases, never entire sentences

Return ONLY valid JSON array (no markdown, no explanation):
[
  { "slide_number": 1, "quote": "..." },
  { "slide_number": 2, "quote": "..." }
]`;

  logger.info('Generating quote carousel', { clientName, topic, slideCount });

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
    logger.error('Failed to parse carousel response', { text });
    throw new Error('Claude returned invalid JSON for carousel generation');
  }

  if (!Array.isArray(parsed) || parsed.length !== slideCount) {
    throw new Error(`Claude returned ${parsed?.length ?? 0} slides, expected ${slideCount}`);
  }

  logger.info('Quote carousel generated', { topic, slideCount });
  return parsed;
}

module.exports = { generateQuoteCarousel };
