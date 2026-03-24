const axios = require('axios');
const BaseAdapter = require('./base');
const logger = require('../utils/logger');

const API_BASE = 'https://api.linkedin.com/v2';
const TEXT_LIMIT = 3000;

class LinkedInAdapter extends BaseAdapter {
  constructor(account) {
    super(account);
    this.platform = 'linkedin';
    // account_id is the full URN: urn:li:person:{id} or urn:li:organization:{id}
    this.authorUrn = account.account_id;
    this.accessToken = account.access_token;
    this._headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  // ─── publish ──────────────────────────────────────────────────────────────

  async publish(variant) {
    const { adapted_script, image_urls } = variant;
    const content = this.formatContent(adapted_script);

    if (!image_urls || image_urls.length === 0) {
      throw new Error('LinkedInAdapter.publish: no image_urls on variant');
    }

    logger.info('LinkedIn: publishing', { authorUrn: this.authorUrn, imageCount: image_urls.length });

    // Register uploads and obtain LinkedIn asset URNs
    const assetUrns = await Promise.all(image_urls.map(url => this._uploadImage(url)));

    return this._createPost(content.caption, assetUrns);
  }

  async _uploadImage(imageUrl) {
    // Step 1: Register upload with LinkedIn
    const registerBody = {
      registerUploadRequest: {
        owner: this.authorUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [
          { identifier: 'urn:li:userGeneratedContent', relationshipType: 'OWNER' },
        ],
      },
    };

    const { data: regData } = await axios.post(
      `${API_BASE}/assets?action=registerUpload`,
      registerBody,
      { headers: this._headers }
    );

    const uploadUrl =
      regData.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl;
    const assetUrn = regData.value.asset;

    // Step 2: Download source image and push to LinkedIn upload URL
    const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    await axios.put(uploadUrl, imgResponse.data, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
    });

    return assetUrn;
  }

  async _createPost(text, assetUrns) {
    const media = assetUrns.map(urn => ({ status: 'READY', media: urn }));

    const body = {
      author: this.authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'IMAGE',
          media,
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const { data } = await axios.post(`${API_BASE}/ugcPosts`, body, {
      headers: this._headers,
    });

    return data.id; // urn:li:ugcPost:{id}
  }

  // ─── fetchStats ───────────────────────────────────────────────────────────

  async fetchStats(platformPostId) {
    // platformPostId = urn:li:ugcPost:{id}
    try {
      const { data } = await axios.get(
        `${API_BASE}/socialActions/${encodeURIComponent(platformPostId)}`,
        { headers: this._headers }
      );

      return {
        likes: data.likesSummary?.totalLikes ?? 0,
        comments: data.commentsSummary?.totalFirstLevelComments ?? 0,
        shares: data.sharesSummary?.totalShares ?? 0,
        saves: 0,
        reach: 0,
        impressions: 0,
        clicks: 0,
        views: 0,
      };
    } catch (err) {
      logger.warn('LinkedIn: failed to fetch stats', { platformPostId, error: err.message });
      return { likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, impressions: 0, clicks: 0, views: 0 };
    }
  }

  // ─── validateCredentials ──────────────────────────────────────────────────

  async validateCredentials() {
    try {
      await axios.get(`${API_BASE}/me`, { headers: this._headers });
      return true;
    } catch {
      return false;
    }
  }

  // ─── refreshToken ─────────────────────────────────────────────────────────

  async refreshToken() {
    // LinkedIn access tokens expire in 60 days; refresh requires a new OAuth flow
    throw new Error('LinkedIn token expired — reconnect via dashboard to generate a new access token');
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
    await axios.delete(`${API_BASE}/ugcPosts/${encodeURIComponent(platformPostId)}`, {
      headers: this._headers,
    });
    logger.info('LinkedIn: post deleted', { platformPostId });
  }
}

module.exports = LinkedInAdapter;
