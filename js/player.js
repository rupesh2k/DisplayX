import { ConfigFetcher } from './ConfigFetcher.js';
import { AssetCache } from './AssetCache.js';
import { ScheduleEngine } from './ScheduleEngine.js';

/**
 * Player - Main orchestrator for DisplayX player
 */
class Player {
  constructor() {
    this.configFetcher = new ConfigFetcher();
    this.assetCache = new AssetCache();
    this.scheduleEngine = null;
    this.isOffline = false;
    this.currentAsset = null;

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
      // Get config URL from query param
      const urlParams = new URLSearchParams(window.location.search);
      const configUrl = urlParams.get('config');

      if (!configUrl) {
        throw new Error('Missing config URL parameter. Usage: player.html?config=https://...');
      }

      // Show loading screen
      this.showScreen('loading');
      this.loadingMessage.textContent = 'Loading configuration...';

      // Initialize IndexedDB
      await this.assetCache.init();

      // Fetch config
      const config = await this.configFetcher.init(configUrl);

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
      this.assetVideo.muted = false;

      // Apply transition
      if (shouldAnimate) {
        this.assetVideo.style.animation = `${transitionType} ${transitionDuration}ms ease-in-out`;
      }

      // Start playback
      try {
        await this.assetVideo.play();
      } catch (error) {
        console.error('Video playback error:', error);
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
