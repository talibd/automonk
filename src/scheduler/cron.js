const cron = require('node-cron');
const db = require('../config/db');
const { enqueuePipeline, enqueueWeeklyOpt } = require('../queue/queues');
const logger = require('../utils/logger');

// Map idea_frequency setting to cron expressions
const FREQUENCY_CRONS = {
  daily:       '0 6 * * *',       // 6:00 AM every day
  every_2_days:'0 6 */2 * *',     // 6:00 AM every 2 days
  weekly:      '0 6 * * 1',       // 6:00 AM every Monday
};

// Track running cron tasks per client
const clientCrons = new Map();

/**
 * Load all active clients and start their cron jobs.
 * Called once at worker startup.
 */
async function startAllClientCrons() {
  const { rows: clients } = await db.query(
    `SELECT c.id, cs.idea_frequency
     FROM clients c
     JOIN client_settings cs ON cs.client_id = c.id
     WHERE c.archived = FALSE`
  );

  for (const client of clients) {
    startClientCron(client.id, client.idea_frequency);
  }

  logger.info('Client crons started', { count: clients.length });

  // Weekly optimization cron — every Sunday at 23:00
  cron.schedule('0 23 * * 0', runWeeklyOptimization);
  logger.info('Weekly optimization cron registered');

  // Supervision mode auto-upgrade cron — check daily at 00:05
  cron.schedule('5 0 * * *', checkSupervisionUpgrades);
}

/**
 * Start (or restart) the pipeline cron for a single client.
 */
function startClientCron(clientId, frequency) {
  // Stop existing cron if any
  stopClientCron(clientId);

  const cronExpr = FREQUENCY_CRONS[frequency] || FREQUENCY_CRONS.daily;

  const task = cron.schedule(cronExpr, async () => {
    logger.info('Cron: triggering pipeline', { clientId, frequency });
    try {
      await enqueuePipeline(clientId);
    } catch (err) {
      logger.error('Cron: failed to enqueue pipeline', { clientId, error: err.message });
    }
  });

  clientCrons.set(clientId, task);
  logger.info('Client cron started', { clientId, frequency, cronExpr });
}

function stopClientCron(clientId) {
  const existing = clientCrons.get(clientId);
  if (existing) {
    existing.destroy();
    clientCrons.delete(clientId);
  }
}

/**
 * Runs every Sunday night. Fetches stats and updates strategy for each client
 * that has weekly_optimization enabled.
 */
async function runWeeklyOptimization() {
  logger.info('Weekly optimization: starting');
  const { rows: clients } = await db.query(
    `SELECT c.id FROM clients c
     JOIN client_settings cs ON cs.client_id = c.id
     WHERE c.archived = FALSE AND cs.weekly_optimization = TRUE`
  );

  for (const client of clients) {
    try {
      await enqueueWeeklyOpt(client.id);
    } catch (err) {
      logger.error('Weekly optimization enqueue failed', { clientId: client.id, error: err.message });
    }
  }
}

/**
 * Checks if any clients in supervised mode have been onboarded for 14+ days
 * and automatically upgrades them to auto-publish.
 */
async function checkSupervisionUpgrades() {
  const { rows } = await db.query(
    `SELECT cs.client_id
     FROM client_settings cs
     WHERE cs.approval_mode = 'supervised'
       AND cs.onboarded_at <= NOW() - INTERVAL '14 days'`
  );

  for (const row of rows) {
    await db.query(
      `UPDATE client_settings SET approval_mode = 'auto', updated_at = NOW()
       WHERE client_id = $1`,
      [row.client_id]
    );
    logger.info('Client upgraded to auto-publish', { clientId: row.client_id });
  }

  if (rows.length) {
    logger.info('Supervision upgrades complete', { upgraded: rows.length });
  }
}

module.exports = { startAllClientCrons, startClientCron, stopClientCron };
