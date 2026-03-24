const { Worker } = require('bullmq');
const { createRedisClient } = require('../../config/redis');
const { analyzeAndUpdateStrategy } = require('../../ai/strategyAnalyzer');
const logger = require('../../utils/logger');

const connection = createRedisClient();

const worker = new Worker(
  'weekly-opt',
  async (job) => {
    const { clientId } = job.data;
    logger.info('Weekly optimization job started', { jobId: job.id, clientId });

    await analyzeAndUpdateStrategy(clientId);

    logger.info('Weekly optimization job completed', { jobId: job.id, clientId });
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 120000, // 2 minutes per client
  }
);

worker.on('failed', (job, err) => {
  logger.error('Weekly optimization job failed', {
    jobId: job?.id,
    clientId: job?.data?.clientId,
    error: err.message,
  });
});

worker.on('error', (err) => {
  logger.error('Weekly optimization worker error', { error: err.message });
});

async function shutdown(signal) {
  logger.info(`Weekly optimization worker shutting down (${signal})`);
  await worker.close();
  process.exit(0);
}
process.once('SIGINT',  () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = worker;
