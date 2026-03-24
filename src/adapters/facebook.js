const axios = require('axios');
const BaseAdapter = require('./base');
const logger = require('../utils/logger');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TEXT_LIMIT = 63206;

class FacebookAdapter extends BaseAdapter {
  constructor(account) {
    super(account);
    this.platform = 'facebook';
    this.pageId = account.account_id;
    this.accessToken = account.access_token;
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  async publish(variant) {
    const { adapted_script, image_urls } = variant;
    const content = this.formatContent(adapted_script);

    if (!image_urls || image_urls.length === 0) {
      throw new Error('FacebookAdapter.publish: no image_urls on variant');
    }

    logger.info('Facebook: publishing', { pageId: this.pageId, imageCount: image_urls.length });

    if (image_urls.length === 1) {
      return this._publishSinglePhoto(image_urls[0], content.caption);
    }
    return this._publishMultiPhoto(image_urls, content.caption);
  }

  async _publishSinglePhoto(imageUrl, caption) {
    const { data } = await axios.post(`${GRAPH_API}/${this.pageId}/photos`, null, {
      params: { url: imageUrl, caption, access_token: this.accessToken },
    });
    // Facebook returns post_id for page photo posts
    return data.post_id || data.id;
  }

  async _publishMultiPhoto(imageUrls, caption) {
    // Upload each photo unpublished to get photo IDs
    const photoIds = await Promise.all(
      imageUrls.map(url =>
        axios.post(`${GRAPH_API}/${this.pageId}/photos`, null, {
          params: { url, published: false, access_token: this.accessToken },
        }).then(r => r.data.id)
      )
    );

    // Create feed post with all photos attached
    const attached_media = photoIds.map(id => ({ media_fbid: id }));
    const { data } = await axios.post(`${GRAPH_API}/${this.pageId}/feed`, null, {
      params: {
        message: caption,
        attached_media: JSON.stringify(attached_media),
        access_token: this.accessToken,
      },
    });

    return data.id;
  }

  // ─── fetchStats ───────────────────────────────────────────────────────────

  async fetchStats(platformPostId) {
    const metrics = [
      'post_impressions_unique',
      'post_impressions',
      'post_clicks',
      'post_reactions_by_type_total',
      'post_shares',
    ].join(',');

    const { data } = await axios.get(`${GRAPH_API}/${platformPostId}/insights`, {
      params: { metric: metrics, access_token: this.accessToken },
    });

    const statsMap = {};
    if (data.data) {
      for (const metric of data.data) {
        statsMap[metric.name] = Array.isArray(metric.values)
          ? (metric.values[0]?.value ?? 0)
          : (metric.value ?? 0);
      }
    }

    // Reactions by type is an object: { like: N, love: N, wow: N, ... }
    const reactions = statsMap.post_reactions_by_type_total || {};
    const totalReactions = typeof reactions === 'object'
      ? Object.values(reactions).reduce((sum, v) => sum + (v || 0), 0)
      : 0;

    // Comment count via media endpoint
    let comments = 0;
    try {
      const { data: postData } = await axios.get(`${GRAPH_API}/${platformPostId}`, {
        params: { fields: 'comments.summary(true)', access_token: this.accessToken },
      });
      comments = postData.comments?.summary?.total_count ?? 0;
    } catch {
      // Comment count is supplementary — proceed with 0 if unavailable
    }

    const shares = typeof statsMap.post_shares === 'object'
      ? (statsMap.post_shares?.count ?? 0)
      : (statsMap.post_shares ?? 0);

    return {
      likes: totalReactions,
      comments,
      shares,
      saves: 0,
      reach: statsMap.post_impressions_unique ?? 0,
      impressions: statsMap.post_impressions ?? 0,
      clicks: statsMap.post_clicks ?? 0,
      views: 0,
    };
  }

  // ─── validateCredentials ──────────────────────────────────────────────────

  async validateCredentials() {
    try {
      await axios.get(`${GRAPH_API}/${this.pageId}`, {
        params: { fields: 'id', access_token: this.accessToken },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── refreshToken ─────────────────────────────────────────────────────────

  async refreshToken() {
    // Page access tokens derived from a long-lived user token do not expire
    return { accessToken: this.accessToken, expiresAt: null };
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
    logger.info('Facebook: post deleted', { platformPostId });
  }
}

module.exports = FacebookAdapter;
