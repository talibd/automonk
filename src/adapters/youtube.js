const axios = require('axios');
const BaseAdapter = require('./base');
const logger = require('../utils/logger');

const YT_DATA_API = 'https://www.googleapis.com/youtube/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * YouTubeAdapter — stats-only at launch per PRD section 2.3.
 *
 * YouTube community post creation via API is not publicly available.
 * The operator posts manually via YouTube Studio after receiving a
 * Telegram notification. Once the post URL is entered in the dashboard,
 * this adapter fetches stats via the YouTube Data API v3.
 *
 * For community posts the post ID looks like: UgkxXXXXXXXXXXXXXXXXXXXXXXXXXX
 * For videos the post ID is the standard 11-char video ID.
 * Stats via /youtube/v3/videos work for videos; community post stats are best-effort.
 */
class YouTubeAdapter extends BaseAdapter {
  constructor(account) {
    super(account);
    this.platform = 'youtube';
    this.channelId = account.account_id;
    this.accessToken = account.access_token;
    this.refreshTokenValue = account.refresh_token;
    this._headers = { Authorization: `Bearer ${this.accessToken}` };
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  async publish() {
    // Intentionally not implemented — YouTube posting is manual at launch.
    // The pipeline marks YouTube variants as ready and notifies the operator.
    throw new Error(
      'YouTube publishing is manual at launch — operator posts via YouTube Studio'
    );
  }

  // ─── fetchStats ───────────────────────────────────────────────────────────

  async fetchStats(platformPostId) {
    // Try the YouTube Data API v3 videos endpoint (works for video IDs)
    try {
      const { data } = await axios.get(`${YT_DATA_API}/videos`, {
        headers: this._headers,
        params: { part: 'statistics', id: platformPostId },
      });

      const stats = data.items?.[0]?.statistics;
      if (stats) {
        return {
          likes: parseInt(stats.likeCount ?? '0', 10),
          comments: parseInt(stats.commentCount ?? '0', 10),
          shares: 0,
          saves: 0,
          reach: 0,
          impressions: parseInt(stats.viewCount ?? '0', 10),
          clicks: 0,
          views: parseInt(stats.viewCount ?? '0', 10),
        };
      }
    } catch (err) {
      logger.warn('YouTube: videos stats fetch failed, trying community post endpoint', {
        platformPostId,
        error: err.message,
      });
    }

    // Fallback: community post stats (beta endpoint, limited availability)
    try {
      const { data } = await axios.get(`${YT_DATA_API}/posts`, {
        headers: this._headers,
        params: { part: 'statistics', id: platformPostId },
      });

      const stats = data.items?.[0]?.statistics;
      if (stats) {
        return {
          likes: parseInt(stats.likeCount ?? '0', 10),
          comments: parseInt(stats.commentCount ?? '0', 10),
          shares: 0,
          saves: 0,
          reach: 0,
          impressions: 0,
          clicks: 0,
          views: 0,
        };
      }
    } catch (err) {
      logger.warn('YouTube: community post stats unavailable', { platformPostId, error: err.message });
    }

    logger.warn('YouTube: returning zero stats', { platformPostId });
    return { likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, impressions: 0, clicks: 0, views: 0 };
  }

  // ─── validateCredentials ──────────────────────────────────────────────────

  async validateCredentials() {
    try {
      await axios.get(`${YT_DATA_API}/channels`, {
        headers: this._headers,
        params: { part: 'id', mine: true },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── refreshToken ─────────────────────────────────────────────────────────

  async refreshToken() {
    if (!this.refreshTokenValue) {
      throw new Error('No refresh token available for YouTube — reconnect via dashboard');
    }

    const { data } = await axios.post(OAUTH_TOKEN_URL, {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: this.refreshTokenValue,
      grant_type: 'refresh_token',
    });

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ─── formatContent ────────────────────────────────────────────────────────

  formatContent(adaptedScript) {
    return {
      communityPostText: adaptedScript.community_post_text || '',
      imageSlides: adaptedScript.image_slides || [],
    };
  }

  // ─── deletePost ───────────────────────────────────────────────────────────

  async deletePost() {
    // YouTube community post deletion is manual per PRD section 8.1
    throw new Error(
      'YouTube deletion is manual — delete from YouTube Studio, then mark as deleted in the dashboard'
    );
  }
}

module.exports = YouTubeAdapter;
