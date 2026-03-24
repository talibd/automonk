const axios = require('axios');
const FormData = require('form-data');
const BaseAdapter = require('./base');
const logger = require('../utils/logger');

const PROFILE_API = 'https://graph.instagram.com/v21.0';
const GRAPH_API = 'https://graph.facebook.com/v21.0';
const TEXT_LIMIT = 2200;
const CONTAINER_POLL_INTERVAL_MS = 2000;
const CONTAINER_POLL_ATTEMPTS = 20;

class InstagramAdapter extends BaseAdapter {
  constructor(account) {
    super(account);
    this.platform = 'instagram';
    this.accountId = account.account_id;
    this.accessToken = account.access_token;
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  async publish(variant) {
    const { adapted_script, image_urls } = variant;
    const content = this.formatContent(adapted_script);

    if (!image_urls || image_urls.length === 0) {
      throw new Error('InstagramAdapter.publish: no image_urls on variant');
    }

    logger.info('Instagram: publishing', { accountId: this.accountId, imageCount: image_urls.length });

    if (image_urls.length === 1) {
      return this._publishSingleImage(image_urls[0], content.caption);
    }
    return this._publishCarousel(image_urls, content.caption);
  }

  async _publishSingleImage(imageUrl, caption) {
    // Step 1: Create media container
    const { data: container } = await axios.post(
      `${GRAPH_API}/${this.accountId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption,
          access_token: this.accessToken,
        },
      }
    );

    await this._waitForContainerReady(container.id);

    // Step 2: Publish
    const { data: published } = await axios.post(
      `${GRAPH_API}/${this.accountId}/media_publish`,
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

  async _publishCarousel(imageUrls, caption) {
    // Step 1: Create a container for each image
    const containerIds = await Promise.all(
      imageUrls.map(url =>
        axios.post(`${GRAPH_API}/${this.accountId}/media`, null, {
          params: {
            image_url: url,
            is_carousel_item: true,
            access_token: this.accessToken,
          },
        }).then(r => r.data.id)
      )
    );

    await Promise.all(containerIds.map((id) => this._waitForContainerReady(id)));

    // Step 2: Create carousel container
    const { data: carousel } = await axios.post(
      `${GRAPH_API}/${this.accountId}/media`,
      null,
      {
        params: {
          media_type: 'CAROUSEL',
          children: containerIds.join(','),
          caption,
          access_token: this.accessToken,
        },
      }
    );

    await this._waitForContainerReady(carousel.id);

    // Step 3: Publish carousel
    const { data: published } = await axios.post(
      `${GRAPH_API}/${this.accountId}/media_publish`,
      null,
      {
        params: {
          creation_id: carousel.id,
          access_token: this.accessToken,
        },
      }
    );

    return published.id;
  }

  async _waitForContainerReady(containerId) {
    for (let attempt = 1; attempt <= CONTAINER_POLL_ATTEMPTS; attempt++) {
      const { data } = await axios.get(`${GRAPH_API}/${containerId}`, {
        params: {
          fields: 'status_code',
          access_token: this.accessToken,
        },
      });

      const statusCode = data.status_code || 'UNKNOWN';

      if (statusCode === 'FINISHED') {
        return;
      }

      if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        throw new Error(`Instagram container ${containerId} became ${statusCode.toLowerCase()}`);
      }

      if (attempt < CONTAINER_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
      }
    }

    throw new Error(`Instagram container ${containerId} was not ready in time`);
  }

  // ─── fetchStats ───────────────────────────────────────────────────────────

  async fetchStats(platformPostId) {
    const fields = 'like_count,comments_count,shares,saved,reach,impressions';

    const { data } = await axios.get(`${GRAPH_API}/${platformPostId}/insights`, {
      params: {
        metric: 'reach,impressions,saved,shares',
        access_token: this.accessToken,
      },
    });

    // Also fetch like/comment counts from media endpoint
    const { data: media } = await axios.get(`${GRAPH_API}/${platformPostId}`, {
      params: {
        fields: 'like_count,comments_count',
        access_token: this.accessToken,
      },
    });

    const insightsMap = {};
    if (data.data) {
      for (const metric of data.data) {
        insightsMap[metric.name] = metric.values?.[0]?.value ?? 0;
      }
    }

    return {
      likes: media.like_count ?? 0,
      comments: media.comments_count ?? 0,
      shares: insightsMap.shares ?? 0,
      saves: insightsMap.saved ?? 0,
      reach: insightsMap.reach ?? 0,
      impressions: insightsMap.impressions ?? 0,
      clicks: 0,
      views: 0,
    };
  }

  // ─── validateCredentials ──────────────────────────────────────────────────

  async validateCredentials() {
    try {
      await axios.get(`${PROFILE_API}/me`, {
        params: { access_token: this.accessToken, fields: 'id' },
      });
      return true;
    } catch (err) {
      const errorMessage =
        err.response?.data?.error_message ||
        err.response?.data?.error?.message ||
        err.message;

      if (errorMessage && errorMessage.includes('Unsupported request - method type: get')) {
        logger.warn('Instagram credential probe rejected GET; allowing publish attempt', {
          accountId: this.accountId,
        });
        return Boolean(this.accessToken && this.accountId);
      }

      return false;
    }
  }

  // ─── refreshToken ─────────────────────────────────────────────────────────

  async refreshToken() {
    try {
      const { data } = await axios.get('https://graph.instagram.com/refresh_access_token', {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: this.accessToken,
        },
      });

      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (err) {
      logger.warn('Instagram token refresh failed; keeping existing token', {
        accountId: this.accountId,
        error: err.response?.data?.error_message || err.response?.data?.error?.message || err.message,
      });

      return { accessToken: this.accessToken, expiresAt: null };
    }
  }

  // ─── formatContent ────────────────────────────────────────────────────────

  formatContent(adaptedScript) {
    let caption = adaptedScript.caption || '';
    if (caption.length > TEXT_LIMIT) {
      caption = caption.slice(0, TEXT_LIMIT - 3) + '...';
    }
    return { caption, slides: adaptedScript.slides };
  }

  // ─── deletePost ───────────────────────────────────────────────────────────

  async deletePost(platformPostId) {
    await axios.delete(`${GRAPH_API}/${platformPostId}`, {
      params: { access_token: this.accessToken },
    });
    logger.info('Instagram: post deleted', { platformPostId });
  }
}

module.exports = InstagramAdapter;
