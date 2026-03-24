const { Worker } = require('bullmq');
const { createRedisClient } = require('../../config/redis');
const { runPipeline } = require('../../pipeline/pipeline');
const logger = require('../../utils/logger');

const connection = createRedisClient();

const worker = new Worker(
  'pipeline',
  async (job) => {
    const { clientId } = job.data;
    logger.info('Pipeline job started', { jobId: job.id, clientId });

    await runPipeline(clientId);

    logger.info('Pipeline job completed', { jobId: job.id, clientId });
  },
  {
    connection,
    concurrency: 2,        // max 2 pipeline runs at once
    lockDuration: 300000,  // 5 minutes — pipeline can take a while
  }
);

worker.on('failed', (job, err) => {
  logger.error('Pipeline job failed', {
    jobId: job?.id,
    clientId: job?.data?.clientId,
    error: err.message,
    stack: err.stack,
  });
});

worker.on('error', (err) => {
  logger.error('Pipeline worker error', { error: err.message });
});

async function shutdown(signal) {
  logger.info(`Pipeline worker shutting down (${signal})`);
  await worker.close();
  process.exit(0);
}
process.once('SIGINT',  () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = worker;
