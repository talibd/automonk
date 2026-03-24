const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: env.anthropic.api_key });

// Platform-specific constraints from PRD section 14
const PLATFORM_LIMITS = {
  instagram: { textLimit: 2200, imageSize: '1080x1080', hashtagLimit: 30 },
  facebook:  { textLimit: 63206, imageSize: '1080x1080', hashtagLimit: null },
  linkedin:  { textLimit: 3000, imageSize: '1200x628',  hashtagLimit: 5 },
  twitter:   { textLimit: 280,  imageSize: '1200x675',  hashtagLimit: 3 },
  threads:   { textLimit: 500,  imageSize: '1080x1080', hashtagLimit: 0 },
  youtube:   { textLimit: 500,  imageSize: '1080x1080', hashtagLimit: 0 },
};

const CONTENT_TYPES = {
  instagram: 'carousel',
  facebook:  'carousel',
  linkedin:  'carousel',
  twitter:   'static_image',
  threads:   'static_image',
  youtube:   'youtube_package',
};

/**
 * Adapts a master script for a specific platform.
 *
 * @param {object} params
 * @param {number} params.clientId
 * @param {string} params.platform
 * @param {object} params.masterScript
 * @param {string} params.toneOfVoice
 * @param {string} params.targetAudience
 * @param {object} params.hashtagSets       - { platform: { primary: [], niche: [] } }
 * @param {object} params.ctaPreferences    - { platform: ctaText }
 * @returns {Promise<object>} adaptedScript
 */
async function adaptForPlatform({ clientId, platform, masterScript, toneOfVoice, targetAudience, hashtagSets, ctaPreferences }) {
  const limits = PLATFORM_LIMITS[platform];
  const contentType = CONTENT_TYPES[platform];
  const cta = ctaPreferences[platform] || ctaPreferences[Object.keys(ctaPreferences)[0]] || 'Follow for more';
  const hashtags = buildHashtagString(platform, hashtagSets);

  let prompt;

  if (platform === 'youtube') {
    prompt = buildYouTubePrompt({ masterScript, cta, limits });
  } else if (['twitter', 'threads'].includes(platform)) {
    prompt = buildShortFormPrompt({ platform, masterScript, toneOfVoice, targetAudience, cta, hashtags, limits });
  } else {
    prompt = buildCarouselPrompt({ platform, masterScript, toneOfVoice, cta, hashtags, limits });
  }

  logger.info('Adapting script for platform', { clientId, platform });

  // Short-form and YouTube output is tiny; only carousel needs full budget
  const maxTokens = ['twitter', 'threads', 'youtube'].includes(platform) ? 512 : 2048;

  const message = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    logger.error('Failed to parse adaptation response', { clientId, platform, text });
    throw new Error(`Claude returned invalid JSON for ${platform} adaptation`);
  }

  parsed.platform = platform;
  parsed.content_type = contentType;

  logger.info('Platform adaptation complete', { clientId, platform });
  return parsed;
}

function buildCarouselPrompt({ platform, masterScript, toneOfVoice, cta, hashtags, limits }) {
  return `Adapt this 10-slide carousel script for ${platform}.

Master script:
${JSON.stringify(masterScript)}

Platform: ${platform}
Tone: ${toneOfVoice}
Caption character limit: ${limits.textLimit}
CTA: ${cta}
${hashtags ? `Hashtags to append: ${hashtags}` : 'No hashtags for this platform.'}

Rules:
- Keep all 10 slides — only adjust wording for the ${platform} audience
- LinkedIn: more professional tone, remove casual language
- Facebook: add slightly more warmth and conversational elements
- Caption: write a compelling caption for the carousel post (include CTA, add hashtags at end if provided)
- Caption must be under ${limits.textLimit} characters including hashtags

Return ONLY valid JSON (no markdown):
{
  "slides": [same structure as master, 10 slides],
  "caption": "full post caption with CTA and hashtags"
}`;
}

function buildShortFormPrompt({ platform, masterScript, toneOfVoice, targetAudience, cta, hashtags, limits }) {
  return `Adapt this carousel content for ${platform} as a single image post.

Master script:
${JSON.stringify(masterScript)}

Platform: ${platform}
Character limit: ${limits.textLimit}
Tone: ${toneOfVoice}
Audience: ${targetAudience}
CTA: ${cta}
${hashtags ? `Hashtags: ${hashtags}` : 'No hashtags.'}

Rules:
- Take the hook from slide 1 and the key takeaway from slide 9
- Write a punchy post text under ${limits.textLimit} characters
- Include the CTA naturally
- ${platform === 'twitter' ? 'Twitter: be direct and punchy. 2-3 hashtags max at end.' : 'Threads: conversational, no hashtags.'}
- The image will be slide 1 of the carousel (hook visual)

Return ONLY valid JSON (no markdown):
{
  "text": "full post text including CTA${hashtags ? ' and hashtags' : ''}",
  "image_slide": 1
}`;
}

function buildYouTubePrompt({ masterScript, cta, limits }) {
  return `Adapt this content as a YouTube community post.

Master script:
${JSON.stringify(masterScript)}

Character limit: ${limits.textLimit} characters
CTA: ${cta}

Rules:
- Write hook headline + key takeaway rewritten for YouTube audience
- Max ${limits.textLimit} characters
- YouTube CTA: "${cta}"
- No hashtags in YouTube community posts
- All 10 slide images will be attached (operator uploads manually)

Return ONLY valid JSON (no markdown):
{
  "community_post_text": "hook + takeaway + CTA, under ${limits.textLimit} chars",
  "image_slides": [1,2,3,4,5,6,7,8,9,10]
}`;
}

function buildHashtagString(platform, hashtagSets) {
  const sets = hashtagSets[platform];
  if (!sets) return '';
  const allTags = [...(sets.primary || []), ...(sets.niche || [])];
  return allTags.join(' ');
}

module.exports = { adaptForPlatform, CONTENT_TYPES };
