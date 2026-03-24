const axios = require('axios');
const BaseAdapter = require('./base');
const logger = require('../utils/logger');

const THREADS_API = 'https://graph.threads.net/v1.0';
const TEXT_LIMIT = 500;

class ThreadsAdapter extends BaseAdapter {
  constructor(account) {
    super(account);
    this.platform = 'threads';
    this.userId = account.account_id;
    this.accessToken = account.access_token;
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  async publish(variant) {
    const { adapted_script, image_urls } = variant;
    const content = this.formatContent(adapted_script);

    logger.info('Threads: publishing', { userId: this.userId });

    if (image_urls && image_urls.length > 0) {
      return this._publishWithImage(image_urls[0], content.text);
    }
    return this._publishTextOnly(content.text);
  }

  async _publishWithImage(imageUrl, text) {
    // Step 1: Create media container
    const { data: container } = await axios.post(
      `${THREADS_API}/${this.userId}/threads`,
      null,
      {
        params: {
          media_type: 'IMAGE',
          image_url: imageUrl,
          text,
          access_token: this.accessToken,
        },
      }
    );

    // Step 2: Publish container
    const { data: published } = await axios.post(
      `${THREADS_API}/${this.userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: container.id,
          access_token: this.accessToken,
        },
      }
    );

    return published.id;
  }

  async _publishTextOnly(text) {
    const { data: container } = await axios.post(
      `${THREADS_API}/${this.userId}/threads`,
      null,
      {
        params: {
          media_type: 'TEXT',
          text,
          access_token: this.accessToken,
        },
      }
    );

    const { data: published } = await axios.post(
      `${THREADS_API}/${this.userId}/threads_publish`,
      null,
      {
        params: {
          creation_id: container.id,
          access_token: this.accessToken,
        },
      }
    );

    return published.id;
  }

  // ─── fetchStats ───────────────────────────────────────────────────────────

  async fetchStats(platformPostId) {
    const { data } = await axios.get(`${THREADS_API}/${platformPostId}/insights`, {
      params: {
        metric: 'likes,replies,reposts,quotes,views',
        access_token: this.accessToken,
      },
    });

    const statsMap = {};
    if (data.data) {
      for (const metric of data.data) {
        // Threads returns either values[] or total_value depending on metric type
        statsMap[metric.name] =
          metric.total_value?.value ??
          metric.values?.[0]?.value ??
          0;
      }
    }

    return {
      likes: statsMap.likes ?? 0,
      comments: statsMap.replies ?? 0,
      shares: (statsMap.reposts ?? 0) + (statsMap.quotes ?? 0),
      saves: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
      views: statsMap.views ?? 0,
    };
  }

  // ─── validateCredentials ──────────────────────────────────────────────────

  async validateCredentials() {
    try {
      await axios.get(`${THREADS_API}/me`, {
        params: { access_token: this.accessToken, fields: 'id' },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── refreshToken ─────────────────────────────────────────────────────────

  async refreshToken() {
    const { data } = await axios.get(`${THREADS_API}/refresh_access_token`, {
      params: {
        grant_type: 'th_refresh_token',
        access_token: this.accessToken,
      },
    });
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ─── formatContent ────────────────────────────────────────────────────────

  formatContent(adaptedScript) {
    let text = adaptedScript.text || '';
    if (text.length > TEXT_LIMIT) {
      text = text.slice(0, TEXT_LIMIT - 1) + '\u2026';
    }
    return { text, imageSlide: adaptedScript.image_slide };
  }

  // ─── deletePost ───────────────────────────────────────────────────────────

  async deletePost(platformPostId) {
    try {
      await axios.delete(`${THREADS_API}/${platformPostId}`, {
        params: { access_token: this.accessToken },
      });
      logger.info('Threads: post deleted', { platformPostId });
    } catch (err) {
      logger.warn('Threads: delete failed', { platformPostId, error: err.message });
      throw new Error('Threads post deletion failed — please delete manually in the Threads app');
    }
  }
}

module.exports = ThreadsAdapter;
