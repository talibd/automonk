const db = require('../config/db');
const InstagramAdapter = require('../adapters/instagram');
const FacebookAdapter = require('../adapters/facebook');
const LinkedInAdapter = require('../adapters/linkedin');
const TwitterAdapter = require('../adapters/twitter');
const ThreadsAdapter = require('../adapters/threads');
const { sendAlert } = require('../bot/alerts');
const { enqueueStatsFetch } = require('../queue/queues');
const logger = require('../utils/logger');
const { resolvePlatformAccount } = require('../platformAccounts/resolveAccount');

const ADAPTER_MAP = {
  instagram: InstagramAdapter,
  facebook:  FacebookAdapter,
  linkedin:  LinkedInAdapter,
  twitter:   TwitterAdapter,
  threads:   ThreadsAdapter,
  // youtube: manual posting — not in publish queue
};

/**
 * Publishes a single post variant to its platform.
 * Called by the publish BullMQ worker.
 *
 * @param {number} variantId
 * @param {number} clientId
 * @param {string} platform
 */
async function publishVariant(variantId, clientId, platform) {
  // Load variant
  const { rows: [variant] } = await db.query(
    'SELECT * FROM post_variants WHERE id = $1 AND client_id = $2',
    [variantId, clientId]
  );

  if (!variant) throw new Error(`Variant ${variantId} not found`);
  if (variant.status === 'posted') {
    logger.info('Variant already posted, skipping', { variantId });
    return;
  }

  // Load platform account (credentials)
  const { rows: [account] } = await db.query(
    'SELECT * FROM platform_accounts WHERE client_id = $1 AND platform = $2 AND active = TRUE',
    [clientId, platform]
  );

  if (!account) {
    throw new Error(`No active ${platform} account for client ${clientId}`);
  }

  // Validate credentials before publishing
  const AdapterClass = ADAPTER_MAP[platform];
  if (!AdapterClass) {
    throw new Error(`No adapter implemented for platform: ${platform}`);
  }

  const resolvedAccount = await resolvePlatformAccount(account);
  const adapter = new AdapterClass(resolvedAccount);
  const isValid = await adapter.validateCredentials();

  if (!isValid) {
    await sendAlert(`🔑 ${platform} token expired for client ${clientId}. Please reconnect in the dashboard.`);
    await db.query(
      'UPDATE platform_accounts SET active = FALSE WHERE id = $1',
      [account.id]
    );
    throw new Error(`${platform} credentials invalid for client ${clientId}`);
  }

  // Mark as posting
  await db.query(
    'UPDATE post_variants SET status = $1, updated_at = NOW() WHERE id = $2',
    ['posted', variantId]  // optimistic — set before API call to prevent double-post on retry
  );

  let platformPostId;
  try {
    platformPostId = await adapter.publish(variant);
  } catch (err) {
    logger.error('Platform publish request failed', {
      clientId,
      variantId,
      platform,
      error: err.message,
      response: err.response?.data || null,
    });

    // Roll back status to scheduled so it can be retried
    await db.query(
      'UPDATE post_variants SET status = $1, updated_at = NOW() WHERE id = $2',
      ['failed', variantId]
    );
    await sendAlert(`❌ Failed to publish ${platform} post for client ${clientId}: ${err.message}`);
    throw err;
  }

  // Save platform post ID and posted timestamp
  await db.query(
    `UPDATE post_variants SET platform_post_id = $1, posted_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [platformPostId, variantId]
  );

  // Update schedule record
  await db.query(
    `UPDATE schedules SET status = 'completed' WHERE post_variant_id = $1`,
    [variantId]
  );

  // Queue stats fetch (runs 24h after posting)
  await enqueueStatsFetch(variantId, platformPostId, platform);

  // Check if all variants for this post are now posted
  await checkPostCompletion(variant.post_id, clientId);

  logger.info('Variant published', { variantId, platform, platformPostId });
}

async function checkPostCompletion(postId, clientId) {
  const { rows } = await db.query(
    `SELECT status FROM post_variants
     WHERE post_id = $1 AND platform != 'youtube'`,
    [postId]
  );

  const allDone = rows.every(r => ['posted', 'failed', 'deleted'].includes(r.status));
  if (!allDone) return;

  const anyFailed = rows.some(r => r.status === 'failed');
  await db.query(
    'UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2',
    [anyFailed ? 'posted' : 'posted', postId]
  );

  // Step 9: Confirmation
  const postedPlatforms = rows.filter(r => r.status === 'posted').length;
  await sendAlert(`✅ Post published for client ${clientId}. ${postedPlatforms} platform(s) live.`);
}

module.exports = { publishVariant };
