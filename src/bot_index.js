require('./config/env');
const bot = require('./bot/bot');
const { runStartupRecovery } = require('./bot/notifications');
const logger = require('./utils/logger');

// Small delay lets the previous polling session expire before we start a new one
setTimeout(async () => {
  try {
    logger.info('Bot: testing connection...');
    const me = await bot.telegram.getMe();
    logger.info('Bot: connected', { username: me.username });
    await bot.telegram.deleteWebhook();
    logger.info('Bot: webhook cleared, starting polling');
    bot.launch({ dropPendingUpdates: true });
    logger.info('Telegram bot started (long polling)');
    await runStartupRecovery();
  } catch (err) {
    logger.error('Bot failed to start', { error: err.message, code: err.code });
    process.exit(1);
  }
}, 3000);

// Graceful shutdown
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
