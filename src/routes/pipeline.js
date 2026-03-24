const express = require('express');
const { requireAuth, requireOperator } = require('../middleware/auth');
const { enqueuePipeline } = require('../queue/queues');

const router = express.Router();
router.use(requireAuth, requireOperator);

// POST /api/pipeline/trigger — manually trigger pipeline for a client
router.post('/trigger', async (req, res, next) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required', code: 'MISSING_FIELDS' });

    const job = await enqueuePipeline(parseInt(clientId, 10));
    res.status(202).json({ ok: true, jobId: job.id });
  } catch (err) { next(err); }
});

module.exports = router;
