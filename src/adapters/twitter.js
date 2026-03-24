const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const BaseAdapter = require('./base');
const logger = require('../utils/logger');

const TWITTER_API_V2 = 'https://api.twitter.com/2';
const UPLOAD_API = 'https://upload.twitter.com/1.1/media/upload.json';
const TEXT_LIMIT = 280;

class TwitterAdapter extends BaseAdapter {
  constructor(account) {
    super(account);
    this.platform = 'twitter';
    this.userId = account.account_id;

    const creds =
      typeof account.access_token === 'string'
        ? JSON.parse(account.access_token)
        : account.access_token;

    if (creds.oauth2) {
      // OAuth 2.0 (connected via login flow)
      this.isOAuth2       = true;
      this.oauth2Token    = creds.access_token;
      this.refreshToken   = creds.refresh_token || null;
    } else {
      // OAuth 1.0a (connected via manual token wizard)
      this.isOAuth2         = false;
      this.apiKey           = creds.api_key;
      this.apiSecret        = creds.api_secret;
      this.oauthToken       = creds.access_token;
      this.oauthTokenSecret = creds.access_token_secret;
      this.bearerToken      = creds.bearer_token;
    }
  }

  // ─── OAuth 1.0a helpers ───────────────────────────────────────────────────

  /**
   * Build an OAuth 1.0a Authorization header.
   * For JSON-body requests (v2 endpoints) pass no extraParams.
   * For form-urlencoded uploads pass the form fields in extraParams.
   */
  _buildOAuth1Header(method, url, extraParams = {}) {
    const pct = (s) =>
      encodeURIComponent(String(s)).replace(
        /[!'()*]/g,
        (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
      );

    const oauthParams = {
      oauth_consumer_key: this.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.oauthToken,
      oauth_version: '1.0',
    };

    const allParams = { ...extraParams, ...oauthParams };
    const paramStr = Object.keys(allParams)
      .sort()
      .map((k) => `${pct(k)}=${pct(allParams[k])}`)
      .join('&');

    const baseStr = `${method.toUpperCase()}&${pct(url)}&${pct(paramStr)}`;
    const signingKey = `${pct(this.apiSecret)}&${pct(this.oauthTokenSecret)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseStr)
      .digest('base64');

    oauthParams.oauth_signature = signature;

    const headerValue = Object.keys(oauthParams)
      .sort()
      .map((k) => `${pct(k)}="${pct(oauthParams[k])}"`)
      .join(', ');

    return `OAuth ${headerValue}`;
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  async publish(variant) {
    const { adapted_script, image_urls } = variant;
    const content = this.formatContent(adapted_script);

    logger.info('Twitter: publishing', { userId: this.userId, oauth2: this.isOAuth2 });

    let mediaIds = [];
    if (!this.isOAuth2 && image_urls && image_urls.length > 0) {
      // Media upload uses OAuth 1.0a v1.1 endpoint — not supported with OAuth2
      const mediaId = await this._uploadMedia(image_urls[0]);
      mediaIds = [mediaId];
    }

    const body = { text: content.text };
    if (mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    const url = `${TWITTER_API_V2}/tweets`;
    const authHeader = this.isOAuth2
      ? `Bearer ${this.oauth2Token}`
      : this._buildOAuth1Header('POST', url);

    const { data } = await axios.post(url, body, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    return data.data.id;
  }

  async _uploadMedia(imageUrl) {
    const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imgResponse.data);

    const form = new FormData();
    // Binary multipart upload — binary content is excluded from OAuth 1.0a signature
    form.append('media', imageBuffer, { filename: 'slide.png', contentType: 'image/png' });

    const authHeader = this._buildOAuth1Header('POST', UPLOAD_API);
    const { data } = await axios.post(UPLOAD_API, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: authHeader,
      },
    });

    return data.media_id_string;
  }

  // ─── fetchStats ───────────────────────────────────────────────────────────

  async fetchStats(platformPostId) {
    const bearer = this.isOAuth2 ? this.oauth2Token : this.bearerToken;
    const { data } = await axios.get(
      `${TWITTER_API_V2}/tweets/${platformPostId}`,
      {
        headers: { Authorization: `Bearer ${bearer}` },
        params: { 'tweet.fields': 'public_metrics' },
      }
    );

    const m = data.data?.public_metrics || {};
    return {
      likes: m.like_count ?? 0,
      comments: m.reply_count ?? 0,
      shares: m.retweet_count ?? 0,
      saves: m.bookmark_count ?? 0,
      reach: 0,
      impressions: m.impression_count ?? 0,
      clicks: 0,
      views: 0,
    };
  }

  // ─── validateCredentials ──────────────────────────────────────────────────

  async validateCredentials() {
    try {
      const bearer = this.isOAuth2 ? this.oauth2Token : this.bearerToken;
      await axios.get(`${TWITTER_API_V2}/users/me`, {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── refreshToken ─────────────────────────────────────────────────────────

  async refreshToken() {
    // OAuth 1.0a user tokens do not expire
    return { accessToken: this.oauthToken, expiresAt: null };
  }

  // ─── formatContent ────────────────────────────────────────────────────────

  formatContent(adaptedScript) {
    let text = adaptedScript.text || '';
    if (text.length > TEXT_LIMIT) {
      text = text.slice(0, TEXT_LIMIT - 1) + '\u2026'; // ellipsis
    }
    return { text, imageSlide: adaptedScript.image_slide };
  }

  // ─── deletePost ───────────────────────────────────────────────────────────

  async deletePost(platformPostId) {
    const url = `${TWITTER_API_V2}/tweets/${platformPostId}`;
    const authHeader = this.isOAuth2
      ? `Bearer ${this.oauth2Token}`
      : this._buildOAuth1Header('DELETE', url);
    await axios.delete(url, {
      headers: { Authorization: authHeader },
    });
    logger.info('Twitter: tweet deleted', { platformPostId });
  }
}

module.exports = TwitterAdapter;
