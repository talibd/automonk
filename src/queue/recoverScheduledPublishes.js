const db = require('../config/db');
const { queues, enqueuePublish } = require('./queues');
const logger = require('../utils/logger');

async function recoverScheduledPublishes() {
  const { rows } = await db.query(
    `SELECT
       pv.id AS variant_id,
       pv.client_id,
       pv.platform,
       pv.scheduled_at,
       s.id AS schedule_id,
       s.bull_job_id
     FROM post_variants pv
     JOIN schedules s ON s.post_variant_id = pv.id
     WHERE pv.status = 'scheduled'
       AND pv.platform != 'youtube'
       AND pv.platform_post_id IS NULL
       AND pv.scheduled_at IS NOT NULL
       AND pv.scheduled_at <= NOW()
       AND s.status = 'pending'
     ORDER BY pv.scheduled_at ASC`
  );

  if (!rows.length) {
    return 0;
  }

  let recoveredCount = 0;

  for (const row of rows) {
    const expectedJobId = row.bull_job_id || `publish_${row.variant_id}`;
    const job = await queues.publish.getJob(expectedJobId);

    if (job) {
      const state = await job.getState();

      if (state === 'delayed') {
        await job.promote();
        recoveredCount += 1;
        logger.warn('Recovered delayed publish job', {
          variantId: row.variant_id,
          platform: row.platform,
          jobId: expectedJobId,
          scheduledAt: row.scheduled_at,
        });
      }

      continue;
    }

    const newJob = await enqueuePublish(
      row.variant_id,
      row.client_id,
      row.platform,
      new Date()
    );

    await db.query(
      'UPDATE schedules SET bull_job_id = $1 WHERE id = $2',
      [newJob.id, row.schedule_id]
    );

    recoveredCount += 1;
    logger.warn('Re-enqueued missing publish job', {
      variantId: row.variant_id,
      platform: row.platform,
      oldJobId: expectedJobId,
      newJobId: newJob.id,
      scheduledAt: row.scheduled_at,
    });
  }

  return recoveredCount;
}

module.exports = { recoverScheduledPublishes };
