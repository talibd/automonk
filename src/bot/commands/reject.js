const { Markup } = require('telegraf');
const db = require('../../config/db');
const { redis } = require('../../config/redis');
const { editApprovalMessage } = require('../notifications');
const logger = require('../../utils/logger');

const REJECT_TTL = 5 * 60; // 5 minutes
const rejectKey  = (chatId) => `reject_pending:${chatId}`;

async function executeReject(postId, reason) {
  await db.query(
    `UPDATE posts SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
    [postId]
  );
  await db.query(
    `UPDATE post_variants SET status = 'draft', updated_at = NOW() WHERE post_id = $1`,
    [postId]
  );
  logger.info('Post rejected via Telegram', { postId, reason });
}

// /reject <post_id> [reason]
async function handleRejectCommand(ctx) {
  const parts  = ctx.message.text.trim().split(/\s+/);
  const postId = parseInt(parts[1], 10);
  if (!postId) return ctx.reply('Usage: /reject <post_id> [reason]');

  const reason = parts.slice(2).join(' ') || null;

  const { rows: [post] } = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
  if (!post) return ctx.reply(`Post #${postId} not found.`);
  if (post.status !== 'approval_pending') {
    return ctx.reply(`Post #${postId} is not pending approval (current status: ${post.status}).`);
  }

  await executeReject(postId, reason);

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const reasonLine = reason ? `\nReason: ${reason}` : '';

  if (post.telegram_message_id) {
    await editApprovalMessage(
      post.telegram_message_id,
      `<b>❌ Rejected</b> — ${now}${reasonLine}`
    );
  }

  await ctx.reply(`Post #${postId} rejected.${reason ? ` Reason: ${reason}` : ''}`);
}

// Inline ❌ Reject button — ask for a reason
async function handleRejectPromptCallback(ctx) {
  const postId = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery();

  await redis.setex(rejectKey(ctx.chat.id), REJECT_TTL, String(postId));

  await ctx.reply(
    `Reason for rejecting post #${postId}?\nReply with a reason or tap Skip.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Skip (no reason)', `reject_skip:${postId}`)],
    ])
  );
}

// "Skip" button — reject with no reason
async function handleRejectSkipCallback(ctx) {
  const postId = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery();

  await redis.del(rejectKey(ctx.chat.id));

  const { rows: [post] } = await db.query(
    'SELECT telegram_message_id, status FROM posts WHERE id = $1',
    [postId]
  );
  if (!post || post.status !== 'approval_pending') {
    return ctx.reply(`Post #${postId} is no longer pending.`);
  }

  await executeReject(postId, null);

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (post.telegram_message_id) {
    await editApprovalMessage(post.telegram_message_id, `<b>❌ Rejected</b> — ${now}`);
  }

  await ctx.reply(`Post #${postId} rejected.`);
}

/**
 * Called from the general text handler. Returns true if this message was consumed
 * as a rejection reason, false otherwise.
 */
async function handleRejectReasonText(ctx) {
  const key           = rejectKey(ctx.chat.id);
  const pendingPostId = await redis.get(key);
  if (!pendingPostId) return false;

  await redis.del(key);

  const postId = parseInt(pendingPostId, 10);
  const reason = ctx.message.text.trim();

  const { rows: [post] } = await db.query(
    'SELECT telegram_message_id, status FROM posts WHERE id = $1',
    [postId]
  );
  if (!post || post.status !== 'approval_pending') {
    await ctx.reply(`Post #${postId} is no longer pending.`);
    return true;
  }

  await executeReject(postId, reason);

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (post.telegram_message_id) {
    await editApprovalMessage(
      post.telegram_message_id,
      `<b>❌ Rejected</b> — ${now}\nReason: ${reason}`
    );
  }

  await ctx.reply(`Post #${postId} rejected.\nReason: ${reason}`);
  return true;
}

module.exports = {
  handleRejectCommand,
  handleRejectPromptCallback,
  handleRejectSkipCallback,
  handleRejectReasonText,
};
