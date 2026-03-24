const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

function createRedisClient(options = {}) {
  const client = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    ...options,
  });

  client.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  return client;
}

// Shared connection for general use
const redis = createRedisClient();

module.exports = { redis, createRedisClient };
