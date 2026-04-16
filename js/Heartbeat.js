/**
 * Heartbeat - Sends periodic heartbeats to DisplayX server
 * Reports device status, metadata, and maintains online/offline state
 */
export class Heartbeat {
  constructor(serverUrl, apiKey, deviceId) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.deviceId = deviceId;
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Start sending heartbeats
   */
  start() {
    // Only start if server mode is enabled
    if (!this.serverUrl || !this.apiKey || !this.deviceId) {
      console.log('Heartbeat not started - server mode not configured');
      return;
    }

    if (this.isRunning) {
      console.warn('Heartbeat already running');
      return;
    }

    console.log('Starting heartbeat to server:', this.serverUrl);

    // Send heartbeat immediately
    this.sendHeartbeat();

    // Then send every 60 seconds
    this.interval = setInterval(() => this.sendHeartbeat(), 60000);
    this.isRunning = true;
  }

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat() {
    try {
      const url = `${this.serverUrl}/api/v1/devices/${this.deviceId}/heartbeat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'online',
          player_version: '1.1.0', // TODO: Read from package.json
          metadata: {
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            screen_color_depth: window.screen.colorDepth,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            online: navigator.onLine,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (response.status === 401) {
        console.error('Heartbeat authentication failed. Check your API key.');
        this.stop();
        return;
      }

      if (!response.ok) {
        console.warn(`Heartbeat failed: ${response.status} ${response.statusText}`);
        return;
      }

      console.log('Heartbeat sent successfully');

    } catch (error) {
      console.warn('Heartbeat error:', error.message);
      // Don't crash - continue with offline resilience
      // Player will keep working with cached config
    }
  }

  /**
   * Stop sending heartbeats
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('Heartbeat stopped');
  }

  /**
   * Check if heartbeat is running
   * @returns {boolean}
   */
  isActive() {
    return this.isRunning;
  }
}
