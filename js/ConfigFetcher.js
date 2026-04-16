import { EventEmitter } from './EventEmitter.js';

/**
 * ConfigFetcher - Fetches, validates, and refreshes config.json
 * Emits: 'config:loaded', 'config:error', 'config:validating'
 */
export class ConfigFetcher extends EventEmitter {
  constructor(schema) {
    super();
    this.schema = schema;
    this.config = null;
    this.lastETag = null;
    this.configUrl = null;
    this.pollInterval = null;

    // Server mode configuration
    this.serverUrl = localStorage.getItem('DISPLAYX_SERVER_URL');
    this.apiKey = localStorage.getItem('DISPLAYX_API_KEY');
    this.deviceId = localStorage.getItem('DISPLAYX_DEVICE_ID');
    this.configHash = localStorage.getItem('DISPLAYX_CONFIG_HASH');
  }

  /**
   * Initialize and load config from URL
   * @param {string} configUrl - URL to config.json
   * @returns {Promise<Object>} Loaded config
   */
  async init(configUrl) {
    this.configUrl = configUrl;
    return await this.fetchConfig();
  }

  /**
   * Fetch config.json from URL (supports both server and static modes)
   * @returns {Promise<Object>} Config object
   */
  async fetchConfig() {
    this.emit('config:validating', { message: 'Fetching config...' });

    try {
      // Server mode (if configured)
      if (this.serverUrl && this.apiKey && this.deviceId) {
        return await this.fetchFromServer();
      }

      // Static mode (backward compatible)
      return await this.fetchFromStaticUrl();

    } catch (error) {
      console.error('Config fetch error:', error);
      this.emit('config:error', {
        error: error.message,
        canRetry: true
      });
      throw error;
    }
  }

  /**
   * Fetch config from DisplayX server
   * @returns {Promise<Object>} Config object
   */
  async fetchFromServer() {
    const url = `${this.serverUrl}/api/v1/devices/${this.deviceId}/config`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`
    };

    // Add ETag for 304 Not Modified (only if we already have a config loaded)
    if (this.configHash && this.config) {
      headers['If-None-Match'] = this.configHash;
    }

    console.log('Fetching config from server:', url);
    console.log('Request headers:', headers);

    const response = await fetch(url, {
      headers,
      cache: 'no-store'
    });

    console.log('Response status:', response.status);

    // Config hasn't changed (only valid if we already have a config)
    if (response.status === 304) {
      console.log('Config unchanged (304 Not Modified)');
      if (!this.config) {
        throw new Error('Received 304 but no config in memory - this should not happen');
      }
      return this.config;
    }

    if (response.status === 401) {
      throw new Error('Authentication failed. Check your API key.');
    }

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const config = await response.json();
    console.log('Config loaded successfully from server');

    // Save new config hash for ETag
    const newHash = response.headers.get('ETag');
    if (newHash) {
      this.configHash = newHash;
      localStorage.setItem('DISPLAYX_CONFIG_HASH', newHash);
    }

    // Validate config against schema
    if (!this.validateConfig(config)) {
      throw new Error('Config validation failed');
    }

    this.config = config;
    this.emit('config:loaded', { config });

    // Start polling for updates (if poll_interval_sec is set)
    this.startPolling();

    return config;
  }

  /**
   * Fetch config from static URL (backward compatible)
   * @returns {Promise<Object>} Config object
   */
  async fetchFromStaticUrl() {
    const response = await fetch(this.configUrl, {
      cache: 'no-store',
      headers: this.lastETag ? { 'If-None-Match': this.lastETag } : {}
    });

    if (response.status === 304) {
      // Config unchanged
      console.log('Config unchanged (304 Not Modified)');
      return this.config;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const config = await response.json();

    // Update ETag for next poll
    this.lastETag = response.headers.get('ETag');

    // Validate config against schema
    if (!this.validateConfig(config)) {
      throw new Error('Config validation failed');
    }

    this.config = config;
    this.emit('config:loaded', { config });

    // Start polling for updates (if poll_interval_sec is set)
    this.startPolling();

    return config;
  }

  /**
   * Validate config against JSON Schema
   * @param {Object} config - Config to validate
   * @returns {boolean} True if valid
   */
  validateConfig(config) {
    // Basic validation (full Ajv validation will be added when Ajv is loaded)
    if (!config.version || !config.package_version) {
      console.error('Missing required fields: version, package_version');
      return false;
    }

    if (!config.assets || !Array.isArray(config.assets) || config.assets.length === 0) {
      console.error('Assets array is required and must not be empty');
      return false;
    }

    if (!config.schedule || !Array.isArray(config.schedule) || config.schedule.length === 0) {
      console.error('Schedule array is required and must not be empty');
      return false;
    }

    if (!config.fallback || !config.fallback.asset_id) {
      console.error('Fallback asset_id is required');
      return false;
    }

    // Validate that all playlist asset IDs exist in assets
    const assetIds = new Set(config.assets.map(a => a.id));
    for (const block of config.schedule) {
      for (const assetId of block.playlist) {
        if (!assetIds.has(assetId)) {
          console.error(`Schedule references non-existent asset: ${assetId}`);
          return false;
        }
      }
    }

    // Validate fallback asset exists
    if (!assetIds.has(config.fallback.asset_id)) {
      console.error(`Fallback references non-existent asset: ${config.fallback.asset_id}`);
      return false;
    }

    return true;
  }

  /**
   * Start polling for config updates
   */
  startPolling() {
    // Clear existing poll interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    const pollIntervalSec = this.config?.settings?.poll_interval_sec || 300;

    this.pollInterval = setInterval(async () => {
      try {
        await this.fetchConfig();
      } catch (error) {
        console.error('Poll error:', error);
        // Continue polling even on error
      }
    }, pollIntervalSec * 1000);
  }

  /**
   * Stop polling for config updates
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Get current config
   * @returns {Object|null} Current config
   */
  getConfig() {
    return this.config;
  }

  /**
   * Check if signed URL is approaching expiry (within 1 hour)
   * @param {string} url - URL to check
   * @returns {boolean} True if approaching expiry
   */
  isUrlExpiringSoon(url) {
    try {
      const urlObj = new URL(url);
      const expiresParam = urlObj.searchParams.get('expires');

      if (!expiresParam) return false;

      const expiresTimestamp = parseInt(expiresParam, 10);
      const oneHourFromNow = Date.now() / 1000 + 3600;

      return expiresTimestamp < oneHourFromNow;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopPolling();
    this.clear();
  }
}
