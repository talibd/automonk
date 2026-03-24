const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads', 'youtube'];

function getNangoConfig() {
  return env.nango || {};
}

function isNangoEnabled() {
  const cfg = getNangoConfig();
  return Boolean(cfg.secret_key);
}

function getIntegrationId(platform) {
  const cfg = getNangoConfig();
  return cfg.integrations?.[platform] || null;
}

function isNangoPlatformConfigured(platform) {
  return isNangoEnabled() && Boolean(getIntegrationId(platform));
}

function getAxios() {
  const cfg = getNangoConfig();
  return axios.create({
    baseURL: cfg.base_url || 'https://api.nango.dev',
    headers: {
      Authorization: `Bearer ${cfg.secret_key}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

async function createConnectSession({ platform, clientId, clientName, chatId, reconnectConnectionId }) {
  const integrationId = getIntegrationId(platform);
  if (!integrationId) {
    throw new Error(`Nango integration is not configured for ${platform}`);
  }

  const payload = {
    end_user: {
      id: `client-${clientId}`,
      display_name: String(clientName),
      tags: {
        client_id: String(clientId),
        client_name: String(clientName),
        platform: String(platform),
        ...(chatId ? { chat_id: String(chatId) } : {}),
      },
    },
    tags: {
      client_id: String(clientId),
      client_name: String(clientName),
      platform: String(platform),
      ...(chatId ? { chat_id: String(chatId) } : {}),
    },
    allowed_integrations: [integrationId],
  };

  const client = getAxios();
  const endpoint = reconnectConnectionId ? '/connect/sessions/reconnect' : '/connect/sessions';
  const body = reconnectConnectionId
    ? { ...payload, connection_id: reconnectConnectionId, integration_id: integrationId }
    : payload;

  const { data } = await client.post(endpoint, body);
  return data.data;
}

async function getConnection(connectionId, providerConfigKey) {
  const client = getAxios();
  const { data } = await client.get(`/connection/${encodeURIComponent(connectionId)}`, {
    params: {
      provider_config_key: providerConfigKey,
      refresh_token: true,
    },
  });
  return data;
}

function pickCredential(connection, key) {
  if (connection[key] !== undefined) return connection[key];
  if (connection.credentials && connection.credentials[key] !== undefined) return connection.credentials[key];
  return null;
}

async function discoverPlatformAccount(platform, connection) {
  const accessToken = pickCredential(connection, 'access_token');
  const refreshToken = pickCredential(connection, 'refresh_token');
  const expiresAt = pickCredential(connection, 'expires_at');

  if (!accessToken) {
    throw new Error(`Nango connection for ${platform} is missing an access token`);
  }

  if (platform === 'linkedin') {
    const { data: profile } = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      account_id: `urn:li:person:${profile.sub}`,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: expiresAt,
    };
  }

  if (platform === 'twitter') {
    const { data: userInfo } = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      account_id: userInfo.data?.username || connection.connection_id,
      access_token: JSON.stringify({
        oauth2: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      }),
      refresh_token: null,
      token_expiry: expiresAt,
    };
  }

  if (platform === 'youtube') {
    const { data: channelData } = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      account_id: channelData.items?.[0]?.id || connection.connection_id,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: expiresAt,
    };
  }

  if (platform === 'facebook') {
    const { data: pagesData } = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
      params: { access_token: accessToken, fields: 'id,name,access_token' },
    });
    const page = pagesData.data?.[0];
    if (!page) {
      throw new Error('No Facebook Pages found on the connected Meta account');
    }

    return {
      account_id: String(page.id),
      access_token: page.access_token,
      refresh_token: null,
      token_expiry: expiresAt,
    };
  }

  if (platform === 'instagram' || platform === 'threads') {
    const { data: pagesData } = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
      params: { access_token: accessToken, fields: 'id,name,instagram_business_account' },
    });

    const igAccount = (pagesData.data || [])
      .filter((page) => page.instagram_business_account)
      .map((page) => page.instagram_business_account)[0];

    if (!igAccount) {
      throw new Error('No Instagram Business account found on the connected Meta account');
    }

    return {
      account_id: String(igAccount.id),
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: expiresAt,
    };
  }

  throw new Error(`Unsupported Nango platform discovery for ${platform}`);
}

async function hydratePlatformAccount(account) {
  if (!account?.nango_connection_id || !account?.nango_provider_config_key || !isNangoEnabled()) {
    return account;
  }

  const connection = await getConnection(account.nango_connection_id, account.nango_provider_config_key);
  const accessToken = pickCredential(connection, 'access_token');
  const refreshToken = pickCredential(connection, 'refresh_token');
  const expiresAt = pickCredential(connection, 'expires_at');

  if (account.platform === 'facebook') {
    const { data: pagesData } = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
      params: { access_token: accessToken, fields: 'id,name,access_token' },
    });
    const page = (pagesData.data || []).find((entry) => String(entry.id) === String(account.account_id));
    if (!page) {
      throw new Error(`Connected Facebook page ${account.account_id} is no longer accessible`);
    }

    return {
      ...account,
      access_token: page.access_token,
      refresh_token: null,
      token_expiry: expiresAt,
    };
  }

  if (account.platform === 'twitter') {
    return {
      ...account,
      access_token: JSON.stringify({
        oauth2: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      }),
      refresh_token: null,
      token_expiry: expiresAt,
    };
  }

  return {
    ...account,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expiry: expiresAt,
  };
}

function verifyIncomingWebhookRequest(rawBody, headers) {
  const secret = getNangoConfig().webhook_secret;
  if (!secret) return true;

  const hmacHeader = headers['x-nango-hmac-sha256'];
  if (typeof hmacHeader === 'string' && hmacHeader) {
    const hexDigest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const base64Digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    return [hexDigest, base64Digest, `sha256=${hexDigest}`, `sha256=${base64Digest}`].includes(hmacHeader);
  }

  const legacyHeader = headers['x-nango-signature'];
  if (typeof legacyHeader === 'string' && legacyHeader) {
    const legacy = crypto.createHash('sha256').update(`${secret}${rawBody}`).digest('hex');
    return legacy === legacyHeader;
  }

  return false;
}

module.exports = {
  PLATFORMS,
  createConnectSession,
  discoverPlatformAccount,
  getConnection,
  getIntegrationId,
  hydratePlatformAccount,
  isNangoEnabled,
  isNangoPlatformConfigured,
  verifyIncomingWebhookRequest,
};
