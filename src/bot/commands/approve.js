const db = require('../../config/db');
const { renderAndSchedule } = require('../../pipeline/pipeline');
const { editApprovalMessage } = require('../notifications');
const logger = require('../../utils/logger');

async function executeApprove(ctx, postId) {
  const { rows: [post] } = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);

  if (!post) {
    return ctx.reply(`Post #${postId} not found.`);
  }
  if (post.status !== 'approval_pending') {
    return ctx.reply(`Post #${postId} is not pending approval (current status: ${post.status}).`);
  }

  const { rows: variants } = await db.query(
    `SELECT * FROM post_variants WHERE post_id = $1 AND status = 'pending_approval'`,
    [postId]
  );

  const { rows: [settings] } = await db.query(
    'SELECT * FROM client_settings WHERE client_id = $1',
    [post.client_id]
  );

  const variantsWithScript = variants.map(v => ({
    ...v,
    adaptedScript: v.adapted_script,
  }));

  try {
    await renderAndSchedule(post.client_id, postId, variantsWithScript, settings);

    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    if (post.telegram_message_id) {
      await editApprovalMessage(
        post.telegram_message_id,
        `<b>✅ Approved</b> — ${now}\nRendering and scheduling in progress.`
      );
    }

    await ctx.reply(`Post #${postId} approved. Rendering started.`);
    logger.info('Post approved via Telegram', { postId });
  } catch (err) {
    logger.error('Approve via Telegram failed', { postId, error: err.message });
    await ctx.reply(`Approval failed: ${err.message}`);
  }
}

async function handleApproveCommand(ctx) {
  const parts = ctx.message.text.trim().split(/\s+/);
  const postId = parseInt(parts[1], 10);
  if (!postId) return ctx.reply('Usage: /approve <post_id>');
  await executeApprove(ctx, postId);
}

async function handleApproveCallback(ctx) {
  const postId = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery('Processing...');
  await executeApprove(ctx, postId);
}

module.exports = { handleApproveCommand, handleApproveCallback };
