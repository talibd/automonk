const fs = require('fs');

require('dotenv').config();

const required = [
  'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
  'REDIS_HOST', 'REDIS_PORT',
  'ANTHROPIC_API_KEY',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_OPERATOR_CHAT_ID',
  'JWT_SECRET',
  'OPERATOR_PASSWORD',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const runningInDocker = fs.existsSync('/.dockerenv');

function resolveHost(host) {
  if (runningInDocker) return host;

  const localHostMap = {
    postgres: '127.0.0.1',
    redis: '127.0.0.1',
    minio: '127.0.0.1',
  };

  return localHostMap[host] || host;
}

module.exports = {
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  app_url: process.env.APP_URL || 'http://localhost:3000',

  db: {
    host: resolveHost(process.env.POSTGRES_HOST),
    port: parseInt(process.env.POSTGRES_PORT, 10),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  },

  redis: {
    host: resolveHost(process.env.REDIS_HOST),
    port: parseInt(process.env.REDIS_PORT, 10),
  },

  anthropic: {
    api_key: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  },

  telegram: {
    bot_token: process.env.TELEGRAM_BOT_TOKEN,
    operator_chat_id: process.env.TELEGRAM_OPERATOR_CHAT_ID,
  },

  operator_password: process.env.OPERATOR_PASSWORD,

  jwt: {
    secret: process.env.JWT_SECRET,
    expires_in: process.env.JWT_EXPIRES_IN || '7d',
  },

  minio: {
    endpoint: resolveHost(process.env.MINIO_ENDPOINT || 'minio'),
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    access_key: process.env.MINIO_ACCESS_KEY,
    secret_key: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET || 'automonk',
    use_ssl: process.env.MINIO_USE_SSL === 'true',
  },

  // OAuth 2.0 credentials — all optional; missing values disable OAuth for that platform
  oauth: {
    instagram_app_id:       process.env.IG_APP_ID              || process.env.META_APP_ID || null,
    instagram_app_secret:   process.env.IG_APP_SECRET          || process.env.META_APP_SECRET || null,
    meta_app_id:            process.env.META_APP_ID            || null,
    meta_app_secret:        process.env.META_APP_SECRET        || null,
    linkedin_client_id:     process.env.LINKEDIN_CLIENT_ID     || null,
    linkedin_client_secret: process.env.LINKEDIN_CLIENT_SECRET || null,
    twitter_client_id:      process.env.TWITTER_CLIENT_ID      || null,
    twitter_client_secret:  process.env.TWITTER_CLIENT_SECRET  || null,
    google_client_id:       process.env.GOOGLE_CLIENT_ID       || null,
    google_client_secret:   process.env.GOOGLE_CLIENT_SECRET   || null,
  },

  nango: {
    base_url: process.env.NANGO_BASE_URL || 'https://api.nango.dev',
    secret_key: process.env.NANGO_SECRET_KEY || null,
    webhook_secret: process.env.NANGO_WEBHOOK_SECRET || null,
    integrations: {
      instagram: process.env.NANGO_INTEGRATION_INSTAGRAM || null,
      facebook: process.env.NANGO_INTEGRATION_FACEBOOK || null,
      linkedin: process.env.NANGO_INTEGRATION_LINKEDIN || null,
      twitter: process.env.NANGO_INTEGRATION_TWITTER || null,
      threads: process.env.NANGO_INTEGRATION_THREADS || null,
      youtube: process.env.NANGO_INTEGRATION_YOUTUBE || null,
    },
  },

};
