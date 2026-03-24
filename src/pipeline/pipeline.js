const path = require('path');
const db = require('../config/db');
const { generateIdeas } = require('../ai/ideaGenerator');
const { writeMasterScript } = require('../ai/scriptWriter');
const { adaptForPlatform } = require('../ai/platformAdapter');
const { generateQuoteCarousel } = require('../ai/carouselGenerator');
const { renderSlides } = require('../renderer/slideRenderer');
const { uploadSlides } = require('../storage/objectStorageClient');
const { enqueuePublish } = require('../queue/queues');
const { selectBestIdea } = require('./ideaSelector');
const { sendAlert } = require('../bot/alerts');
const { sendApprovalNotification } = require('../bot/notifications');
const logger = require('../utils/logger');

const CAROUSEL_QUOTE_TEMPLATE = path.resolve(__dirname, '../../templates/default/carousel-quote.js');

const TEMPLATE_PATHS = {
  'tweet-style':    path.resolve(__dirname, '../../templates/default/tweet-style.js'),
  'dark-minimal':   path.resolve(__dirname, '../../templates/default/dark-minimal.js'),
  'gradient-vivid': path.resolve(__dirname, '../../templates/default/gradient-vivid.js'),
  'clean-light':    path.resolve(__dirname, '../../templates/default/clean-light.js'),
  'bold-solid':     path.resolve(__dirname, '../../templates/default/bold-solid.js'),
};

/**
 * Full content pipeline for a single client.
 * Steps 1–7 (idea gen → scheduling). Step 8 (publish) happens via BullMQ at scheduled time.
 * @param {number} clientId
 */
async function runPipeline(clientId) {
  logger.info('Pipeline: starting', { clientId });

  // ── Load client settings ────────────────────────────────────────────────
  const settings = await getClientSettings(clientId);
  const strategy = await getLatestStrategy(clientId);
  const recentTopics = await getRecentTopics(clientId);

  // ── Step 1: Idea generation ─────────────────────────────────────────────
  logger.info('Pipeline: step 1 — idea generation', { clientId });

  let ideasResult;
  try {
    ideasResult = await generateIdeas({
      clientId,
      niche: settings.niche,
      toneOfVoice: settings.tone_of_voice,
      targetAudience: settings.target_audience,
      activePlatforms: settings.active_platforms,
      recentTopics,
      strategy,
    });
  } catch (err) {
    await sendAlert(`⚠️ Idea generation failed for client ${clientId}: ${err.message}`);
    throw err;
  }

  // ── Step 2: Auto topic selection ────────────────────────────────────────
  logger.info('Pipeline: step 2 — auto topic selection', { clientId });
  const selectedIdea = selectBestIdea(ideasResult.ideas, ideasResult.autoSelectedRank);

  // Create post record
  const post = await createPost(clientId, ideasResult.ideas, selectedIdea.rank);

  try {
    // ── Step 3: Master script ─────────────────────────────────────────────
    logger.info('Pipeline: step 3 — master script', { clientId, postId: post.id });
    await updatePostStatus(post.id, 'script_pending');

    const masterScript = await writeMasterScript({
      clientId,
      idea: selectedIdea,
      niche: settings.niche,
      toneOfVoice: settings.tone_of_voice,
      targetAudience: settings.target_audience,
      ctaPreferences: settings.cta_preferences,
      strategy,
    });

    await saveMasterScript(post.id, masterScript);
    await updatePostStatus(post.id, 'script_ready');

    // ── Step 4: Platform adaptation ───────────────────────────────────────
    logger.info('Pipeline: step 4 — platform adaptation', { clientId, postId: post.id });
    await updatePostStatus(post.id, 'adapting');

    const variants = [];
    for (const platform of settings.active_platforms) {
      if (platform === 'youtube') continue; // youtube handled separately (manual posting)

      const adaptedScript = await adaptForPlatform({
        clientId,
        platform,
        masterScript,
        toneOfVoice: settings.tone_of_voice,
        targetAudience: settings.target_audience,
        hashtagSets: settings.hashtag_sets,
        ctaPreferences: settings.cta_preferences,
      });

      const variantRow = await createVariant(post.id, clientId, platform, adaptedScript);
      variants.push({ ...variantRow, adaptedScript, platform });
    }

    // YouTube variant (if active)
    if (settings.active_platforms.includes('youtube')) {
      const ytScript = await adaptForPlatform({
        clientId,
        platform: 'youtube',
        masterScript,
        toneOfVoice: settings.tone_of_voice,
        targetAudience: settings.target_audience,
        hashtagSets: settings.hashtag_sets,
        ctaPreferences: settings.cta_preferences,
      });
      const ytVariant = await createVariant(post.id, clientId, 'youtube', ytScript);
      variants.push({ ...ytVariant, adaptedScript: ytScript, platform: 'youtube' });
    }

    await updatePostStatus(post.id, 'adapted');

    // ── Step 5: Approval gate ─────────────────────────────────────────────
    logger.info('Pipeline: step 5 — approval gate', { clientId, mode: settings.approval_mode });

    if (settings.approval_mode === 'supervised') {
      // Hold variants — operator approves from dashboard or Telegram
      for (const v of variants) {
        await updateVariantStatus(v.id, 'pending_approval');
      }
      await updatePostStatus(post.id, 'approval_pending');
      logger.info('Pipeline: post held for approval', { clientId, postId: post.id });

      // Notify operator via Telegram
      const { rows: [savedPost] } = await db.query('SELECT master_script FROM posts WHERE id = $1', [post.id]);
      await sendApprovalNotification(post.id, clientId, variants, savedPost?.master_script);

      return;
    }

    // Auto-publish: proceed directly to rendering
    await updatePostStatus(post.id, 'approved');

    // ── Steps 6 & 7: Render + Schedule ───────────────────────────────────
    await renderAndSchedule(clientId, post.id, variants, settings);

  } catch (err) {
    await updatePostStatus(post.id, 'failed');
    await sendAlert(`⚠️ Pipeline failed for client ${clientId} post ${post.id}: ${err.message}`);
    throw err;
  }
}

/**
 * Renders all variants and schedules their BullMQ publish jobs.
 * Called both from runPipeline (auto mode) and from the approval endpoint (supervised mode).
 */
async function renderAndSchedule(clientId, postId, variants, settings) {
  logger.info('Pipeline: step 6 — rendering', { clientId, postId });
  const { rows: [postRow] } = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);

  await db.query('UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2', ['rendering', postId]);

  const templatePath = await getTemplatePath(clientId);

  for (const variant of variants) {
    // YouTube uses manual upload — render slides but don't auto-publish
    const slidesToRender = getSlidesForPlatform(variant.platform, variant.adaptedScript, postRow.master_script);

    let imageUrls = [];

    if (slidesToRender.length > 0) {
      const pngBuffers = await renderSlides({
        slides: slidesToRender,
        platform: variant.platform,
        templatePath,
        clientId,
      });

      imageUrls = await uploadSlides(pngBuffers, clientId, postId, variant.platform);
    }

    await db.query(
      `UPDATE post_variants SET image_urls = $1, status = 'approved', updated_at = NOW() WHERE id = $2`,
      [imageUrls, variant.id]
    );

    if (variant.platform === 'youtube') {
      // Mark youtube variant as ready for manual upload
      await db.query(
        `UPDATE post_variants SET status = 'scheduled', updated_at = NOW() WHERE id = $1`,
        [variant.id]
      );
      await sendAlert(
        `📦 YouTube package ready for client ${clientId}.\nPost ID: ${postId}\nCheck dashboard to copy and upload.`
      );
      continue;
    }

    // Schedule publish
    const scheduledAt = getScheduledTime(variant.platform, settings.posting_times);
    await scheduleVariant(variant.id, clientId, variant.platform, scheduledAt, imageUrls, variant.adaptedScript);
  }

  await db.query('UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2', ['scheduled', postId]);
  logger.info('Pipeline: all variants scheduled', { clientId, postId });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getClientSettings(clientId) {
  const { rows } = await db.query(
    'SELECT * FROM client_settings WHERE client_id = $1',
    [clientId]
  );
  if (!rows.length) throw new Error(`No settings found for client ${clientId}`);
  return rows[0];
}

async function getLatestStrategy(clientId) {
  const { rows } = await db.query(
    'SELECT strategy FROM client_strategy WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [clientId]
  );
  return rows.length ? rows[0].strategy : null;
}

async function getRecentTopics(clientId, days = 30) {
  const { rows } = await db.query(
    `SELECT master_script->>'title' as title
     FROM posts
     WHERE client_id = $1
       AND created_at > NOW() - INTERVAL '${days} days'
       AND master_script IS NOT NULL`,
    [clientId]
  );
  return rows.map(r => r.title).filter(Boolean);
}

async function createPost(clientId, ideas, selectedRank) {
  const { rows: [post] } = await db.query(
    `INSERT INTO posts (client_id, ideas, selected_idea_rank, status)
     VALUES ($1, $2, $3, 'idea_ready')
     RETURNING *`,
    [clientId, JSON.stringify(ideas), selectedRank]
  );
  return post;
}

async function saveMasterScript(postId, masterScript) {
  await db.query(
    `UPDATE posts SET master_script = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(masterScript), postId]
  );
}

async function updatePostStatus(postId, status) {
  await db.query(
    'UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, postId]
  );
}

async function createVariant(postId, clientId, platform, adaptedScript) {
  const contentType = adaptedScript.content_type || 'carousel';
  const { rows: [variant] } = await db.query(
    `INSERT INTO post_variants (post_id, client_id, platform, content_type, adapted_script, status)
     VALUES ($1,$2,$3,$4,$5,'draft')
     RETURNING *`,
    [postId, clientId, platform, contentType, JSON.stringify(adaptedScript)]
  );
  return variant;
}

async function updateVariantStatus(variantId, status) {
  await db.query(
    'UPDATE post_variants SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, variantId]
  );
}

async function getTemplatePath(clientId) {
  const { rows } = await db.query(
    `SELECT template_path FROM platform_accounts
     WHERE client_id = $1 AND template_path IS NOT NULL LIMIT 1`,
    [clientId]
  );
  return rows.length ? rows[0].template_path : null;
}

function getSlidesForPlatform(platform, adaptedScript, masterScript) {
  if (['instagram', 'facebook', 'linkedin', 'youtube'].includes(platform)) {
    return adaptedScript.slides || masterScript?.slides || [];
  }
  // Twitter/Threads: single image (slide 1 only)
  const slides = adaptedScript.slides || masterScript?.slides || [];
  return slides.slice(0, 1);
}

function getScheduledTime(platform, postingTimes) {
  const timeStr = postingTimes[platform]; // e.g. "19:00"
  if (!timeStr) {
    // Default: 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000);
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);
  // If the time has already passed today, schedule for tomorrow
  if (scheduled <= new Date()) {
    scheduled.setDate(scheduled.getDate() + 1);
  }
  return scheduled;
}

async function scheduleVariant(variantId, clientId, platform, scheduledAt, imageUrls, adaptedScript) {
  // Update variant with final image URLs and scheduled time
  await db.query(
    `UPDATE post_variants
     SET image_urls = $1, adapted_script = $2, scheduled_at = $3, status = 'scheduled', updated_at = NOW()
     WHERE id = $4`,
    [imageUrls, JSON.stringify(adaptedScript), scheduledAt, variantId]
  );

  // Enqueue BullMQ publish job
  const job = await enqueuePublish(variantId, clientId, platform, scheduledAt);

  // Save schedule record
  await db.query(
    `INSERT INTO schedules (client_id, post_variant_id, scheduled_at, bull_job_id, status)
     VALUES ($1,$2,$3,$4,'pending')`,
    [clientId, variantId, scheduledAt, job.id]
  );

  logger.info('Variant scheduled', { variantId, platform, scheduledAt });
}

/**
 * Creates a quote-style carousel post by generating slide content with Claude,
 * rendering slide images, and scheduling for all selected platforms.
 *
 * @param {object} params
 * @param {number} params.clientId
 * @param {string} params.topic       - the carousel topic
 * @param {number} params.slideCount  - number of slides to generate (3–10)
 * @param {string[]} params.platforms
 * @param {string} params.scheduledAt - ISO datetime string
 */
async function createManualPost({ clientId, topic, slideCount, platforms, scheduledAt, slides: preGeneratedSlides, templateName }) {
  logger.info('Manual carousel: creating', { clientId, topic, slideCount, platforms });

  // Load client name + logo + settings for context
  const { rows: [clientRow] } = await db.query(
    'SELECT name, logo_url FROM clients WHERE id = $1',
    [clientId]
  );
  if (!clientRow) throw new Error(`Client ${clientId} not found`);

  const { rows: [settings] } = await db.query(
    'SELECT niche, tone_of_voice FROM client_settings WHERE client_id = $1',
    [clientId]
  );

  // Use pre-generated slides (from dashboard editor) or generate via Claude
  const generatedSlides = preGeneratedSlides || await generateQuoteCarousel({
    topic,
    slideCount,
    clientName: clientRow.name,
    niche: settings?.niche || '',
    toneOfVoice: settings?.tone_of_voice || 'professional',
  });

  // Each slide has { slide_number, quote }; add headline/body aliases for compatibility
  const slides = generatedSlides.map(s => ({ ...s, headline: s.quote, body: '' }));

  const masterScript = { title: topic, slides, cta: '', hashtags: [] };

  const { rows: [post] } = await db.query(
    `INSERT INTO posts (client_id, ideas, master_script, status)
     VALUES ($1, '[]', $2, 'approved')
     RETURNING *`,
    [clientId, JSON.stringify(masterScript)]
  );

  try {
    // Build client branding context for the template
    const initials = clientRow.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const context = {
      clientName: clientRow.name,
      clientInitials: initials,
      logoUrl: clientRow.logo_url || null,
      title: topic,
      totalSlides: slideCount,
    };

    const scheduledAtDate = new Date(scheduledAt);

    for (const platform of platforms) {
      const isMultiSlide = ['instagram', 'facebook', 'linkedin'].includes(platform);
      const contentType = isMultiSlide ? 'carousel' : 'static_image';
      const slidesToRender = isMultiSlide ? slides : slides.slice(0, 1);
      const adaptedScript = { title: topic, slides, cta: '', hashtags: [], content_type: contentType };

      const { rows: [variant] } = await db.query(
        `INSERT INTO post_variants (post_id, client_id, platform, content_type, adapted_script, status)
         VALUES ($1, $2, $3, $4, $5, 'approved')
         RETURNING *`,
        [post.id, clientId, platform, contentType, JSON.stringify(adaptedScript)]
      );

      const resolvedTemplatePath = (templateName && TEMPLATE_PATHS[templateName])
        ? TEMPLATE_PATHS[templateName]
        : TEMPLATE_PATHS['tweet-style'];

      const pngBuffers = await renderSlides({
        slides: slidesToRender,
        platform,
        templatePath: resolvedTemplatePath,
        clientId,
        context,
      });
      const imageUrls = await uploadSlides(pngBuffers, clientId, post.id, platform);

      await scheduleVariant(variant.id, clientId, platform, scheduledAtDate, imageUrls, adaptedScript);
    }

    await db.query(`UPDATE posts SET status = 'scheduled', updated_at = NOW() WHERE id = $1`, [post.id]);
    logger.info('Manual carousel: scheduled', { clientId, postId: post.id });
    return post;
  } catch (err) {
    await db.query(`UPDATE posts SET status = 'failed', updated_at = NOW() WHERE id = $1`, [post.id]);
    await sendAlert(`⚠️ Manual carousel failed for client ${clientId}: ${err.message}`);
    throw err;
  }
}

module.exports = { runPipeline, renderAndSchedule, createManualPost };
