require('./config/env');
const logger = require('./utils/logger');
const { startAllClientCrons } = require('./scheduler/cron');
const { ensureBucket } = require('./storage/minioClient');
const { recoverScheduledPublishes } = require('./queue/recoverScheduledPublishes');

// Import workers to register them
require('./queue/workers/pipelineWorker');
require('./queue/workers/publishWorker');
require('./queue/workers/statsWorker');
require('./queue/workers/weeklyOptWorker');

let recoveryTimer = null;

async function start() {
  logger.info('AutoMonk worker starting');
  await ensureBucket();
  await startAllClientCrons();
  const recoveredCount = await recoverScheduledPublishes();
  logger.info('Scheduled publish recovery complete', { recoveredCount });

  recoveryTimer = setInterval(async () => {
    try {
      const count = await recoverScheduledPublishes();
      if (count > 0) {
        logger.warn('Recovered overdue scheduled publishes', { count });
      }
    } catch (err) {
      logger.error('Scheduled publish recovery failed', { error: err.message });
    }
  }, 60 * 1000);
  logger.info('AutoMonk worker ready — pipeline, publish, stats, and weekly-opt workers active');
}

start().catch(err => {
  logger.error('Worker failed to start', { error: err.message });
  process.exit(1);
});

process.once('SIGINT', () => {
  if (recoveryTimer) clearInterval(recoveryTimer);
});

process.once('SIGTERM', () => {
  if (recoveryTimer) clearInterval(recoveryTimer);
});
