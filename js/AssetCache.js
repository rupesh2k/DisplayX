import { EventEmitter } from './EventEmitter.js';

/**
 * AssetCache - Manages IndexedDB asset storage with FIFO eviction
 * Emits: 'cache:progress', 'cache:complete', 'cache:error', 'cache:quota-warning'
 */
export class AssetCache extends EventEmitter {
  constructor() {
    super();
    this.db = null;
    this.dbName = 'DisplayXCache';
    this.dbVersion = 1;
    this.storeName = 'assets';
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store with asset ID as key
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  /**
   * Cache all assets from config
   * @param {Array} assets - Assets to cache (from config.assets)
   * @param {number} cacheSizeGb - Cache size limit in GB
   * @returns {Promise<void>}
   */
  async cacheAssets(assets, cacheSizeGb = 5) {
    const cacheSizeBytes = cacheSizeGb * 1024 * 1024 * 1024;
    const assetsToCache = assets.filter(a => a.cached);

    console.log(`Caching ${assetsToCache.length} assets (limit: ${cacheSizeGb} GB)`);

    for (let i = 0; i < assetsToCache.length; i++) {
      const asset = assetsToCache[i];

      this.emit('cache:progress', {
        current: i + 1,
        total: assetsToCache.length,
        assetId: asset.id,
        message: `Caching ${asset.id}...`
      });

      try {
        await this.cacheAsset(asset, cacheSizeBytes);
      } catch (error) {
        console.error(`Failed to cache asset ${asset.id}:`, error);
        this.emit('cache:error', {
          assetId: asset.id,
          error: error.message
        });
        // Continue with next asset (don't fail entire caching operation)
      }
    }

    this.emit('cache:complete', {
      total: assetsToCache.length,
      message: 'All assets cached'
    });
  }

  /**
   * Cache a single asset
   * @param {Object} asset - Asset object from config
   * @param {number} cacheSizeBytes - Cache size limit in bytes
   * @returns {Promise<void>}
   */
  async cacheAsset(asset, cacheSizeBytes) {
    // Check if asset already cached
    const existing = await this.getAsset(asset.id);
    if (existing) {
      console.log(`Asset ${asset.id} already cached`);
      return;
    }

    // Fetch asset with CORS mode
    const response = await fetch(asset.url, {
      mode: 'cors',
      credentials: 'omit'
    });

    if (!response.ok) {
      // Check if it's a CORS/403 error - these assets can't be cached but might be streamable
      if (response.status === 403 || response.type === 'opaque') {
        console.warn(`Asset ${asset.id} can't be cached (CORS/403), will stream directly`);
        throw new Error(`HTTP ${response.status}: ${response.statusText} (asset will stream without cache)`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const size = blob.size;

    // Check current cache size
    const currentSize = await this.getCacheSize();

    // Evict old assets if necessary (FIFO)
    if (currentSize + size > cacheSizeBytes) {
      console.warn('Cache quota approaching, evicting old assets');
      await this.evictOldAssets(size);

      this.emit('cache:quota-warning', {
        message: 'Cache quota exceeded, evicting old assets',
        requestedSize: size,
        currentSize
      });
    }

    // Store asset in IndexedDB
    const assetData = {
      id: asset.id,
      type: asset.type,
      url: asset.url,
      blob,
      size,
      timestamp: Date.now()
    };

    await this.storeAsset(assetData);
  }

  /**
   * Store asset in IndexedDB
   * @param {Object} assetData - Asset data with blob
   * @returns {Promise<void>}
   */
  async storeAsset(assetData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(assetData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get asset from cache
   * @param {string} assetId - Asset ID
   * @returns {Promise<Object|null>} Asset data or null if not found
   */
  async getAsset(assetId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(assetId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get total cache size in bytes
   * @returns {Promise<number>} Total size in bytes
   */
  async getCacheSize() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const assets = request.result;
        const totalSize = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Evict old assets to free up space (FIFO)
   * @param {number} requiredSpace - Space needed in bytes
   * @returns {Promise<void>}
   */
  async evictOldAssets(requiredSpace) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(); // Cursor ordered by timestamp (oldest first)

      let freedSpace = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor && freedSpace < requiredSpace) {
          const asset = cursor.value;
          console.log(`Evicting asset ${asset.id} (${asset.size} bytes)`);

          freedSpace += asset.size || 0;
          cursor.delete(); // Delete current asset
          cursor.continue(); // Move to next oldest asset
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Create object URL from cached asset
   * @param {string} assetId - Asset ID
   * @returns {Promise<string|null>} Object URL or null if not found
   */
  async getAssetUrl(assetId) {
    const asset = await this.getAsset(assetId);
    if (!asset || !asset.blob) return null;

    return URL.createObjectURL(asset.blob);
  }

  /**
   * Clear all cached assets
   * @returns {Promise<void>}
   */
  async clearCache() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.clear();
  }
}
