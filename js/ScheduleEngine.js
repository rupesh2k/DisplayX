import { EventEmitter } from './EventEmitter.js';

/**
 * ScheduleEngine - Determines which asset to play based on schedule
 * Emits: 'schedule:asset-change', 'schedule:clock-jump'
 */
export class ScheduleEngine extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.currentAssetId = null;
    this.currentBlockIndex = null;
    this.playlistIndex = 0;
    this.assetStartTime = null;
    this.pollInterval = null;
    this.lastCheckTime = Date.now();
  }

  /**
   * Start schedule engine (1-second polling)
   */
  start() {
    // Initial check
    this.checkSchedule();

    // Poll every 1 second
    this.pollInterval = setInterval(() => {
      this.checkSchedule();
    }, 1000);
  }

  /**
   * Check current schedule and emit asset change if needed
   */
  checkSchedule() {
    const now = Date.now();

    // Detect clock jump (>5 second gap or backward jump)
    const timeDelta = now - this.lastCheckTime;
    if (Math.abs(timeDelta - 1000) > 5000) {
      console.warn(`Clock jump detected: ${timeDelta}ms`);
      this.emit('schedule:clock-jump', { delta: timeDelta });
    }
    this.lastCheckTime = now;

    // Get current time in HH:MM format
    const currentTime = this.getCurrentTime();
    const currentDate = this.getCurrentDate();

    // Find active schedule block
    const activeBlock = this.findActiveBlock(currentTime, currentDate);

    if (!activeBlock) {
      // No active block, show fallback
      this.switchToFallback();
      return;
    }

    // Check if we need to switch assets within the block
    const shouldSwitch = this.shouldSwitchAsset(activeBlock, now);

    if (shouldSwitch) {
      this.switchAsset(activeBlock);
    }
  }

  /**
   * Get current time in HH:MM format
   * @returns {string} Current time
   */
  getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Get current date in YYYY-MM-DD format
   * @returns {string} Current date
   */
  getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Find active schedule block for current time
   * @param {string} currentTime - Current time in HH:MM
   * @param {string} currentDate - Current date in YYYY-MM-DD
   * @returns {Object|null} Active schedule block or null
   */
  findActiveBlock(currentTime, currentDate) {
    for (let i = 0; i < this.config.schedule.length; i++) {
      const block = this.config.schedule[i];

      // Check time range
      const [startTime, endTime] = block.time_range;
      if (!this.isTimeInRange(currentTime, startTime, endTime)) {
        continue;
      }

      // Check conditions (if any)
      if (block.conditions) {
        if (!this.evaluateConditions(block.conditions, currentDate)) {
          continue;
        }
      }

      // Found active block
      return { ...block, index: i };
    }

    return null;
  }

  /**
   * Check if current time is in range
   * @param {string} current - Current time HH:MM
   * @param {string} start - Start time HH:MM
   * @param {string} end - End time HH:MM
   * @returns {boolean}
   */
  isTimeInRange(current, start, end) {
    const currentMinutes = this.timeToMinutes(current);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    // Handle overnight ranges (e.g., 22:00 - 02:00)
    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Convert HH:MM to minutes since midnight
   * @param {string} time - Time in HH:MM format
   * @returns {number} Minutes since midnight
   */
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Evaluate schedule conditions
   * @param {Object} conditions - Conditions object
   * @param {string} currentDate - Current date YYYY-MM-DD
   * @returns {boolean} True if conditions met
   */
  evaluateConditions(conditions, currentDate) {
    // Check date range
    if (conditions.date_range) {
      const [startDate, endDate] = conditions.date_range;
      if (currentDate < startDate || currentDate > endDate) {
        return false;
      }
    }

    // Check device tags (if implemented, for now assume match)
    if (conditions.device_tags) {
      // Device tags would be checked against localStorage or config
      // For now, assume match (MVP)
    }

    return true;
  }

  /**
   * Check if asset should switch
   * @param {Object} block - Active schedule block
   * @param {number} now - Current timestamp
   * @returns {boolean}
   */
  shouldSwitchAsset(block, now) {
    // If different block, always switch
    if (this.currentBlockIndex !== block.index) {
      return true;
    }

    // If first asset in block, start it
    if (this.assetStartTime === null) {
      return true;
    }

    // Get current asset duration
    const currentDuration = block.durations_sec[this.playlistIndex];

    // If duration is null, play until block ends
    if (currentDuration === null) {
      return false;
    }

    // Check if duration elapsed
    const elapsed = (now - this.assetStartTime) / 1000;
    return elapsed >= currentDuration;
  }

  /**
   * Switch to next asset in block
   * @param {Object} block - Active schedule block
   */
  switchAsset(block) {
    // If different block, reset playlist index
    if (this.currentBlockIndex !== block.index) {
      this.currentBlockIndex = block.index;
      this.playlistIndex = 0;
    } else {
      // Move to next asset in playlist (loop)
      this.playlistIndex = (this.playlistIndex + 1) % block.playlist.length;
    }

    const assetId = block.playlist[this.playlistIndex];
    const asset = this.config.assets.find(a => a.id === assetId);

    if (!asset) {
      console.error(`Asset not found: ${assetId}`);
      this.switchToFallback();
      return;
    }

    this.currentAssetId = assetId;
    this.assetStartTime = Date.now();

    const transition = block.transition || { type: 'hard-cut', duration_ms: 0 };

    this.emit('schedule:asset-change', {
      assetId,
      asset,
      transition,
      playlistIndex: this.playlistIndex,
      totalAssets: block.playlist.length
    });
  }

  /**
   * Switch to fallback asset
   */
  switchToFallback() {
    const fallbackId = this.config.fallback.asset_id;
    const asset = this.config.assets.find(a => a.id === fallbackId);

    if (!asset) {
      console.error(`Fallback asset not found: ${fallbackId}`);
      return;
    }

    // Only emit if not already showing fallback
    if (this.currentAssetId !== fallbackId) {
      this.currentAssetId = fallbackId;
      this.assetStartTime = Date.now();
      this.currentBlockIndex = null;
      this.playlistIndex = 0;

      this.emit('schedule:asset-change', {
        assetId: fallbackId,
        asset,
        transition: { type: 'crossfade', duration_ms: 300 },
        isFallback: true
      });
    }
  }

  /**
   * Stop schedule engine
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    this.clear();
  }
}
