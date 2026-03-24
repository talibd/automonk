const { Queue } = require('bullmq');
const { createRedisClient } = require('../config/redis');

const connection = createRedisClient();

// One queue per major stage so they can be scaled independently
const queues = {
  pipeline:   new Queue('pipeline',   { connection }),
  publish:    new Queue('publish',    { connection }),
  stats:      new Queue('stats',      { connection }),
  weeklyOpt:  new Queue('weekly-opt', { connection }),
};

/**
 * Add a pipeline job for a client.
 * The pipeline worker will run all steps: idea → script → adapt → approval gate → render → schedule.
 * @param {number} clientId
 * @param {object} [opts] - BullMQ job options
 */
async function enqueuePipeline(clientId, opts = {}) {
  return queues.pipeline.add(
    'run-pipeline',
    { clientId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: 100,
      removeOnFail: 200,
      ...opts,
    }
  );
}

/**
 * Schedule a publish job for a specific variant at a specific time.
 * @param {number} variantId
 * @param {number} clientId
 * @param {string} platform
 * @param {Date}   scheduledAt
 */
async function enqueuePublish(variantId, clientId, platform, scheduledAt) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  return queues.publish.add(
    'publish-variant',
    { variantId, clientId, platform },
    {
      delay,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: 200,
      removeOnFail: 500,
      jobId: `publish_${variantId}`,
    }
  );
}

/**
 * Enqueue a stats fetch job for a variant.
 * Delayed by 24 hours after posting to allow stats to accumulate.
 * @param {number} variantId
 * @param {string} platformPostId
 * @param {string} platform
 */
async function enqueueStatsFetch(variantId, platformPostId, platform) {
  return queues.stats.add(
    'fetch-stats',
    { variantId, platformPostId, platform },
    {
      delay: 24 * 60 * 60 * 1000, // 24 hours after posting
      attempts: 2,
      backoff: { type: 'fixed', delay: 60000 },
      removeOnComplete: 500,
      removeOnFail: 500,
      jobId: `stats_${variantId}`,
    }
  );
}

/**
 * Enqueue a weekly optimization job for a client.
 * @param {number} clientId
 */
async function enqueueWeeklyOpt(clientId) {
  return queues.weeklyOpt.add(
    'weekly-opt',
    { clientId },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 60000 },
      removeOnComplete: 50,
      removeOnFail: 100,
      jobId: `weekly-opt_${clientId}`,
    }
  );
}

module.exports = { queues, enqueuePipeline, enqueuePublish, enqueueStatsFetch, enqueueWeeklyOpt };
