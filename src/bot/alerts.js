const env = require('../config/env');
const logger = require('../utils/logger');

let bot = null;

/**
 * Set the Telegraf bot instance. Called from bot_index.js after bot is created.
 * This avoids circular imports between bot.js and the rest of the system.
 */
function setBotInstance(instance) {
  bot = instance;
}

/**
 * Send an alert message to the operator Telegram chat.
 * Safe to call from anywhere in the system.
 * @param {string} message
 */
async function sendAlert(message) {
  if (!bot) {
    logger.warn('Bot not initialized, alert not sent', { message });
    return;
  }
  try {
    await bot.telegram.sendMessage(env.telegram.operator_chat_id, message, {
      parse_mode: 'HTML',
    });
  } catch (err) {
    logger.error('Failed to send Telegram alert', { error: err.message, message });
  }
}

module.exports = { sendAlert, setBotInstance };
