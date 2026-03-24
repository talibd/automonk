const { Worker } = require('bullmq');
const { createRedisClient } = require('../../config/redis');
const db = require('../../config/db');
const { publishVariant } = require('../../pipeline/publisher');
const logger = require('../../utils/logger');

const connection = createRedisClient();

const worker = new Worker(
  'publish',
  async (job) => {
    const { variantId, clientId, platform } = job.data;
    logger.info('Publish job started', { jobId: job.id, variantId, platform });

    await db.query(
      `UPDATE schedules
       SET status = 'processing'
       WHERE post_variant_id = $1 AND status = 'pending'`,
      [variantId]
    );

    await publishVariant(variantId, clientId, platform);

    logger.info('Publish job completed', { jobId: job.id, variantId, platform });
  },
  {
    connection,
    concurrency: 5,       // up to 5 concurrent publishes
    lockDuration: 60000,  // 1 minute
  }
);

worker.on('failed', (job, err) => {
  const variantId = job?.data?.variantId;

  if (variantId) {
    db.query(
      `UPDATE schedules
       SET status = 'failed'
       WHERE post_variant_id = $1 AND status IN ('pending', 'processing')`,
      [variantId]
    ).catch((updateErr) => {
      logger.error('Failed to mark schedule as failed', {
        variantId,
        error: updateErr.message,
      });
    });
  }

  logger.error('Publish job failed', {
    jobId: job?.id,
    variantId,
    platform: job?.data?.platform,
    error: err.message,
  });
});

worker.on('error', (err) => {
  logger.error('Publish worker error', { error: err.message });
});

async function shutdown(signal) {
  logger.info(`Publish worker shutting down (${signal})`);
  await worker.close();
  process.exit(0);
}
process.once('SIGINT',  () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = worker;
