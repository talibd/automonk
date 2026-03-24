const { Markup } = require('telegraf');
const db = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');

let bot = null;

function setBot(instance) {
  bot = instance;
}

/**
 * Send an approval notification to the operator when a supervised post is ready.
 */
async function sendApprovalNotification(postId, clientId, variants, masterScript) {
  if (!bot) {
    logger.warn('Bot not initialized, approval notification not sent', { postId });
    return;
  }

  try {
    const { rows: [client] } = await db.query(
      'SELECT name FROM clients WHERE id = $1',
      [clientId]
    );

    const platforms = (variants || [])
      .filter(v => v.platform !== 'youtube')
      .map(v => v.platform)
      .join(', ');

    const title    = masterScript?.title ?? 'Untitled';
    const slides   = masterScript?.slides?.length ?? 0;
    const clientName = client?.name ?? `Client #${clientId}`;

    const text = [
      `<b>New post awaiting approval</b>`,
      ``,
      `<b>Client:</b> ${clientName}`,
      `<b>Topic:</b> "${title}"`,
      `<b>Platforms:</b> ${platforms || 'none'}`,
      `<b>Slides:</b> ${slides}`,
      ``,
      `Post <code>#${postId}</code>`,
    ].join('\n');

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Approve', `approve:${postId}`),
        Markup.button.callback('❌ Reject',  `reject_prompt:${postId}`),
      ],
    ]);

    const msg = await bot.telegram.sendMessage(
      env.telegram.operator_chat_id,
      text,
      { parse_mode: 'HTML', ...keyboard }
    );

    await db.query(
      `UPDATE posts SET telegram_notified_at = NOW(), telegram_message_id = $1 WHERE id = $2`,
      [msg.message_id, postId]
    );

    logger.info('Approval notification sent', { postId, messageId: msg.message_id });
  } catch (err) {
    logger.error('Failed to send approval notification', { postId, error: err.message });
  }
}

/**
 * Edit the original approval notification after approve/reject.
 */
async function editApprovalMessage(telegramMessageId, text) {
  if (!bot || !telegramMessageId) return;
  try {
    await bot.telegram.editMessageText(
      env.telegram.operator_chat_id,
      telegramMessageId,
      null,
      text,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    // Telegram throws if message content is unchanged — safe to ignore
    if (!err.message.includes('message is not modified')) {
      logger.error('Failed to edit approval message', { telegramMessageId, error: err.message });
    }
  }
}

/**
 * On bot startup, notify about any approval_pending posts that were missed
 * while the bot was offline.
 */
async function runStartupRecovery() {
  if (!bot) return;
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.client_id, p.master_script,
             json_agg(pv.*) AS variants
      FROM posts p
      JOIN post_variants pv ON pv.post_id = p.id AND pv.status = 'pending_approval'
      WHERE p.status = 'approval_pending'
        AND p.telegram_notified_at IS NULL
      GROUP BY p.id
      ORDER BY p.created_at ASC
    `);

    if (rows.length > 0) {
      logger.info(`Startup recovery: sending ${rows.length} missed approval notification(s)`);
      for (const row of rows) {
        await sendApprovalNotification(row.id, row.client_id, row.variants, row.master_script);
      }
    }
  } catch (err) {
    logger.error('Startup recovery failed', { error: err.message });
  }
}

module.exports = { setBot, sendApprovalNotification, editApprovalMessage, runStartupRecovery };
