const { hydratePlatformAccount } = require('../integrations/nango');

async function resolvePlatformAccount(account) {
  return hydratePlatformAccount(account);
}

module.exports = { resolvePlatformAccount };
