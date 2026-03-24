/**
 * BaseAdapter — interface that all platform adapters must implement.
 * Each method must be overridden in subclasses.
 */
class BaseAdapter {
  constructor(account) {
    if (!account) throw new Error('Account credentials required');
    this.account = account;
    this.platform = null; // set in subclass
  }

  /**
   * Publish a post variant to the platform.
   * @param {object} variant - post_variant row with adapted_script and image_urls
   * @returns {Promise<string>} platformPostId
   */
  async publish(variant) {
    throw new Error(`${this.constructor.name}.publish() not implemented`);
  }

  /**
   * Fetch engagement stats for a published post.
   * @param {string} platformPostId
   * @returns {Promise<{likes,comments,shares,saves,reach,impressions,clicks,views}>}
   */
  async fetchStats(platformPostId) {
    throw new Error(`${this.constructor.name}.fetchStats() not implemented`);
  }

  /**
   * Check if the stored access token is still valid.
   * @returns {Promise<boolean>}
   */
  async validateCredentials() {
    throw new Error(`${this.constructor.name}.validateCredentials() not implemented`);
  }

  /**
   * Refresh the access token using the stored refresh token.
   * @returns {Promise<{accessToken: string, expiresAt: Date|null}>}
   */
  async refreshToken() {
    throw new Error(`${this.constructor.name}.refreshToken() not implemented`);
  }

  /**
   * Validate and truncate content against platform limits.
   * @param {object} adaptedScript
   * @returns {object} formatted content safe for the platform
   */
  formatContent(adaptedScript) {
    throw new Error(`${this.constructor.name}.formatContent() not implemented`);
  }

  /**
   * Delete a published post from the platform.
   * @param {string} platformPostId
   * @returns {Promise<void>}
   */
  async deletePost(platformPostId) {
    throw new Error(`${this.constructor.name}.deletePost() not implemented`);
  }
}

module.exports = BaseAdapter;
