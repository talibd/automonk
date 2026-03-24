const { Worker } = require('bullmq');
const { createRedisClient } = require('../../config/redis');
const db = require('../../config/db');
const InstagramAdapter = require('../../adapters/instagram');
const FacebookAdapter = require('../../adapters/facebook');
const LinkedInAdapter = require('../../adapters/linkedin');
const TwitterAdapter = require('../../adapters/twitter');
const ThreadsAdapter = require('../../adapters/threads');
const YouTubeAdapter = require('../../adapters/youtube');
const logger = require('../../utils/logger');
const { resolvePlatformAccount } = require('../../platformAccounts/resolveAccount');

const ADAPTER_MAP = {
  instagram: InstagramAdapter,
  facebook:  FacebookAdapter,
  linkedin:  LinkedInAdapter,
  twitter:   TwitterAdapter,
  threads:   ThreadsAdapter,
  youtube:   YouTubeAdapter,
};

const connection = createRedisClient();

async function fetchAndSaveStats(variantId, platformPostId, platform) {
  const { rows: [variant] } = await db.query(
    'SELECT * FROM post_variants WHERE id = $1',
    [variantId]
  );

  if (!variant) {
    logger.warn('Stats worker: variant not found', { variantId });
    return;
  }

  const { rows: [account] } = await db.query(
    'SELECT * FROM platform_accounts WHERE client_id = $1 AND platform = $2 AND active = TRUE',
    [variant.client_id, platform]
  );

  if (!account) {
    logger.warn('Stats worker: no active account found', { clientId: variant.client_id, platform });
    return;
  }

  const AdapterClass = ADAPTER_MAP[platform];
  if (!AdapterClass) {
    logger.warn('Stats worker: no adapter for platform', { platform });
    return;
  }

  const resolvedAccount = await resolvePlatformAccount(account);
  const adapter = new AdapterClass(resolvedAccount);
  const stats = await adapter.fetchStats(platformPostId);

  await db.query(
    `INSERT INTO post_stats
       (post_variant_id, client_id, platform, likes, comments, shares, saves, reach, impressions, clicks, views)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      variantId,
      variant.client_id,
      platform,
      stats.likes,
      stats.comments,
      stats.shares,
      stats.saves,
      stats.reach,
      stats.impressions,
      stats.clicks,
      stats.views,
    ]
  );

  logger.info('Stats saved', { variantId, platform, stats });
}

const worker = new Worker(
  'stats',
  async (job) => {
    const { variantId, platformPostId, platform } = job.data;
    logger.info('Stats job started', { jobId: job.id, variantId, platform });

    await fetchAndSaveStats(variantId, platformPostId, platform);

    logger.info('Stats job completed', { jobId: job.id, variantId, platform });
  },
  {
    connection,
    concurrency: 3,
    lockDuration: 60000,
  }
);

worker.on('failed', (job, err) => {
  logger.error('Stats job failed', {
    jobId: job?.id,
    variantId: job?.data?.variantId,
    platform: job?.data?.platform,
    error: err.message,
  });
});

worker.on('error', (err) => {
  logger.error('Stats worker error', { error: err.message });
});

async function shutdown(signal) {
  logger.info(`Stats worker shutting down (${signal})`);
  await worker.close();
  process.exit(0);
}
process.once('SIGINT',  () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = worker;
