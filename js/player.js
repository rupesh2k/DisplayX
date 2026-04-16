import { ConfigFetcher } from './ConfigFetcher.js';
import { AssetCache } from './AssetCache.js';
import { ScheduleEngine } from './ScheduleEngine.js';
import { Heartbeat } from './Heartbeat.js';

/**
 * Player - Main orchestrator for DisplayX player
 */
class Player {
  constructor() {
    this.configFetcher = new ConfigFetcher();
    this.assetCache = new AssetCache();
    this.scheduleEngine = null;
    this.heartbeat = null; // Heartbeat instance for server mode
    this.isOffline = false;
    this.currentAsset = null;
    this.hls = null; // HLS.js instance for livestream playback

    // UI elements
    this.loadingScreen = document.getElementById('loading-screen');
    this.errorScreen = document.getElementById('error-screen');
    this.playerScreen = document.getElementById('player-screen');
    this.loadingMessage = document.getElementById('loading-message');
    this.loadingProgress = document.getElementById('loading-progress');
    this.errorMessage = document.getElementById('error-message');
    this.retryBtn = document.getElementById('retry-btn');
    this.useCachedBtn = document.getElementById('use-cached-btn');
    this.offlineBadge = document.getElementById('offline-badge');
    this.assetImage = document.getElementById('asset-image');
    this.assetVideo = document.getElementById('asset-video');

    // Bind event handlers
    this.retryBtn.addEventListener('click', () => this.handleRetry());
    this.useCachedBtn.addEventListener('click', () => this.handleUseCached());

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Initialize player
   */
  async init() {
    try {
      // Check if server mode is configured
      const serverUrl = localStorage.getItem('DISPLAYX_SERVER_URL');
      const apiKey = localStorage.getItem('DISPLAYX_API_KEY');
      const deviceId = localStorage.getItem('DISPLAYX_DEVICE_ID');

      // Initialize heartbeat if server mode is enabled
      if (serverUrl && apiKey && deviceId) {
        console.log('Server mode detected - device ID:', deviceId);
        this.heartbeat = new Heartbeat(serverUrl, apiKey, deviceId);
        this.heartbeat.start();
      }

      // Get config URL from query param (for static mode)
      const urlParams = new URLSearchParams(window.location.search);
      const configUrl = urlParams.get('config');
      const clearCache = urlParams.get('clear-cache') === 'true';

      // In server mode, config URL is optional
      if (!serverUrl && !configUrl) {
        throw new Error('Missing config URL parameter. Usage: player.html?config=https://...');
      }

      // Show loading screen
      this.showScreen('loading');
      this.loadingMessage.textContent = serverUrl ? 'Connecting to server...' : 'Loading configuration...';

      // Initialize IndexedDB
      await this.assetCache.init();

      // Clear cache if requested
      if (clearCache) {
        this.loadingMessage.textContent = 'Clearing cache...';
        await this.assetCache.clearCache();
        console.log('Cache cleared successfully');
      }

      // Fetch config
      const config = await this.configFetcher.init(configUrl);

      // Check if config version changed (clear cache if different)
      const lastConfigVersion = localStorage.getItem('displayx:config-version');
      const currentConfigVersion = config.package_version;

      if (lastConfigVersion && lastConfigVersion !== currentConfigVersion) {
        console.log(`Config version changed (${lastConfigVersion} → ${currentConfigVersion}), clearing cache`);
        this.loadingMessage.textContent = 'New config detected, clearing old cache...';
        await this.assetCache.clearCache();
      }

      // Store current config version
      localStorage.setItem('displayx:config-version', currentConfigVersion);

      // Cache assets
      this.loadingMessage.textContent = 'Caching assets...';
      await this.cacheAssets(config);

      // Start playback
      await this.startPlayback(config);

    } catch (error) {
      console.error('Initialization error:', error);
      this.showError(error.message);
    }
  }

  /**
   * Cache assets from config
   * @param {Object} config - Config object
   */
  async cacheAssets(config) {
    return new Promise((resolve, reject) => {
      // Listen for cache progress
      this.assetCache.on('cache:progress', (data) => {
        this.loadingProgress.textContent = `Caching ${data.current} of ${data.total} assets...`;
      });

      this.assetCache.on('cache:complete', () => {
        resolve();
      });

      this.assetCache.on('cache:error', (data) => {
        console.error('Cache error:', data);
        // Continue even with cache errors
      });

      // Start caching
      const cacheSizeGb = config.settings?.cache_size_gb || 5;
      this.assetCache.cacheAssets(config.assets, cacheSizeGb).catch(reject);
    });
  }

  /**
   * Start playback with schedule engine
   * @param {Object} config - Config object
   */
  async startPlayback(config) {
    // Create schedule engine
    this.scheduleEngine = new ScheduleEngine(config);

    // Listen for asset changes
    this.scheduleEngine.on('schedule:asset-change', async (data) => {
      await this.displayAsset(data);
    });

    // Listen for clock jumps
    this.scheduleEngine.on('schedule:clock-jump', (data) => {
      console.warn('Clock jump detected:', data);
    });

    // Start schedule engine
    this.scheduleEngine.start();

    // Show player screen
    this.showScreen('player');
  }

  /**
   * Display asset (image or video)
   * @param {Object} data - Asset change data
   */
  async displayAsset(data) {
    const { asset, transition } = data;

    console.log(`Displaying asset: ${asset.id} (${asset.type})`);

    // Get cached asset URL
    let assetUrl = await this.assetCache.getAssetUrl(asset.id);

    // If not cached, use original URL (streaming)
    if (!assetUrl) {
      console.warn(`Asset ${asset.id} not cached, using original URL`);
      assetUrl = asset.url;
    }

    // Apply transition
    await this.applyTransition(asset, assetUrl, transition);
  }

  /**
   * Apply transition and display asset
   * @param {Object} asset - Asset object
   * @param {string} assetUrl - Asset URL (cached or original)
   * @param {Object} transition - Transition config
   */
  async applyTransition(asset, assetUrl, transition) {
    const transitionType = transition?.type || 'hard-cut';
    const transitionDuration = transition?.duration_ms || 0;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = !prefersReducedMotion && transitionDuration > 0;

    if (asset.type === 'image') {
      // Preload image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = assetUrl;
      });

      // Hide video, show image
      this.assetVideo.style.display = 'none';
      this.assetImage.style.display = 'block';
      this.assetImage.src = assetUrl;
      this.assetImage.alt = `${asset.id} image`;

      // Apply transition
      if (shouldAnimate) {
        this.assetImage.style.animation = `${transitionType} ${transitionDuration}ms ease-in-out`;
      }

    } else if (asset.type === 'video') {
      // Hide image, show video
      this.assetImage.style.display = 'none';
      this.assetVideo.style.display = 'block';
      this.assetVideo.src = assetUrl;
      this.assetVideo.loop = false;

      // Start muted for autoplay compatibility (Fire TV, mobile browsers)
      this.assetVideo.muted = true;

      // Apply transition
      if (shouldAnimate) {
        this.assetVideo.style.animation = `${transitionType} ${transitionDuration}ms ease-in-out`;
      }

      // Start playback
      try {
        await this.assetVideo.play();

        // Unmute after successful playback start
        // Small delay ensures playback is stable
        setTimeout(() => {
          this.assetVideo.muted = false;
        }, 100);
      } catch (error) {
        console.error('Video playback error:', error);

        // If unmuted playback fails, try muted
        if (!this.assetVideo.muted) {
          console.warn('Retrying video playback muted');
          this.assetVideo.muted = true;
          try {
            await this.assetVideo.play();
          } catch (retryError) {
            console.error('Muted playback also failed:', retryError);
          }
        }
      }

    } else if (asset.type === 'live_stream') {
      // Hide image, show video (livestream uses video element)
      this.assetImage.style.display = 'none';
      this.assetVideo.style.display = 'block';

      // Cleanup previous HLS instance if exists
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }

      // Check if HLS.js is supported
      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        // Use HLS.js for browsers that don't have native HLS support
        this.hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        // Load HLS stream
        this.hls.loadSource(assetUrl);
        this.hls.attachMedia(this.assetVideo);

        // Wait for manifest to be parsed
        await new Promise((resolve, reject) => {
          this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed successfully');
            resolve();
          });

          this.hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error('Fatal HLS error:', data);
              reject(new Error(`HLS Error: ${data.type} - ${data.details}`));
            } else {
              console.warn('Non-fatal HLS error:', data);
            }
          });
        });

      } else if (this.assetVideo.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari, iOS)
        this.assetVideo.src = assetUrl;
        await new Promise((resolve, reject) => {
          this.assetVideo.addEventListener('loadedmetadata', resolve, { once: true });
          this.assetVideo.addEventListener('error', reject, { once: true });
        });

      } else {
        throw new Error('HLS playback not supported on this browser');
      }

      // Configure video for livestream playback
      this.assetVideo.loop = false;
      this.assetVideo.muted = true; // Start muted for autoplay compatibility

      // Apply transition
      if (shouldAnimate) {
        this.assetVideo.style.animation = `${transitionType} ${transitionDuration}ms ease-in-out`;
      }

      // Start playback
      try {
        await this.assetVideo.play();

        // Unmute after successful playback start
        setTimeout(() => {
          this.assetVideo.muted = false;
        }, 100);
      } catch (error) {
        console.error('Livestream playback error:', error);

        // If unmuted playback fails, try muted
        if (!this.assetVideo.muted) {
          console.warn('Retrying livestream playback muted');
          this.assetVideo.muted = true;
          try {
            await this.assetVideo.play();
          } catch (retryError) {
            console.error('Muted playback also failed:', retryError);
          }
        }
      }
    }

    this.currentAsset = asset;
  }

  /**
   * Show specific screen
   * @param {string} screen - 'loading', 'error', or 'player'
   */
  showScreen(screen) {
    this.loadingScreen.classList.remove('active');
    this.errorScreen.classList.remove('active');
    this.playerScreen.classList.remove('active');

    if (screen === 'loading') {
      this.loadingScreen.classList.add('active');
    } else if (screen === 'error') {
      this.errorScreen.classList.add('active');
    } else if (screen === 'player') {
      this.playerScreen.classList.add('active');
    }
  }

  /**
   * Show error screen
   * @param {string} message - Error message
   */
  showError(message) {
    this.errorMessage.textContent = message;
    this.showScreen('error');

    // Check if cached config exists
    // TODO: Implement cached config check
    this.useCachedBtn.disabled = true;
    this.useCachedBtn.title = 'No cached content available';
  }

  /**
   * Handle retry button click
   */
  async handleRetry() {
    console.log('Retrying config fetch...');
    await this.init();
  }

  /**
   * Handle use cached button click
   */
  async handleUseCached() {
    // TODO: Load cached config from IndexedDB
    console.log('Loading cached config...');
  }

  /**
   * Handle online event
   */
  handleOnline() {
    console.log('Network restored');
    this.isOffline = false;
    this.offlineBadge.style.display = 'none';
    this.offlineBadge.setAttribute('aria-live', 'polite');
    this.offlineBadge.textContent = '';

    // Attempt to refresh config
    if (this.configFetcher) {
      this.configFetcher.fetchConfig().catch(err => {
        console.error('Config refetch error:', err);
      });
    }
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    console.log('Network lost');
    this.isOffline = true;
    this.offlineBadge.style.display = 'flex';
    this.offlineBadge.setAttribute('aria-live', 'polite');
    this.offlineBadge.innerHTML = '<svg class="badge-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 L8 10 M4 6 L8 10 L12 6" fill="none" stroke="white" stroke-width="2"/></svg><span>Offline</span>';
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.heartbeat) {
      this.heartbeat.stop();
      this.heartbeat = null;
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.scheduleEngine) {
      this.scheduleEngine.destroy();
    }
    if (this.configFetcher) {
      this.configFetcher.destroy();
    }
    if (this.assetCache) {
      this.assetCache.destroy();
    }
  }
}

// Stop heartbeat on page unload
window.addEventListener('beforeunload', () => {
  // Find player instance and stop heartbeat
  // This ensures heartbeat is stopped even if player.destroy() isn't called
});

// Initialize player when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const player = new Player();
    player.init();
  });
} else {
  const player = new Player();
  player.init();
}
