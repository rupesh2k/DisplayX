/**
 * Config Editor - Form-based UI for creating config.json
 *
 * PostMessage API (for iframe embedding):
 * - Receives: { type: 'LOAD_CONFIG', config: {...} }
 * - Sends: { type: 'CONFIG_UPDATED', config: {...} }
 */
class ConfigEditor {
  constructor() {
    this.assets = [];
    this.scheduleBlocks = [];
    this.settings = {
      cache_size_gb: 5,
      poll_interval_sec: 300,
      health_report_url: '',
      analytics_webhook: ''
    };

    // Track if we're embedded in an iframe
    this.isEmbedded = window.self !== window.top;
    this.parentOrigin = null; // Will be set explicitly or from URL param

    // Whitelist of allowed parent origins (security)
    // In production, this should be configurable or restricted
    this.allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://127.0.0.1:3000',
      'https://rupesh2k.github.io'
      // Add your production domains here
    ];

    // UI elements
    this.assetList = document.getElementById('asset-list');
    this.assetsEmpty = document.getElementById('assets-empty');
    this.scheduleList = document.getElementById('schedule-list');
    this.scheduleEmpty = document.getElementById('schedule-empty');
    this.storageValue = document.getElementById('storage-value');
    this.storageFill = document.getElementById('storage-fill');
    this.validationStatus = document.getElementById('validation-status');

    // Modals
    this.addAssetModal = document.getElementById('add-asset-modal');
    this.addScheduleModal = document.getElementById('add-schedule-modal');
    this.currentEditIndex = null;

    this.initEventListeners();
    this.initPostMessageAPI();
  }

  /**
   * Initialize postMessage API for iframe embedding
   */
  initPostMessageAPI() {
    // Check if parent origin is specified via URL parameter (recommended)
    const urlParams = new URLSearchParams(window.location.search);
    const parentOriginParam = urlParams.get('parentOrigin');

    if (parentOriginParam && this.allowedOrigins.includes(parentOriginParam)) {
      this.parentOrigin = parentOriginParam;
      console.log('[Editor] Parent origin set from URL param:', this.parentOrigin);
    }

    window.addEventListener('message', (event) => {
      // Security: Only accept messages when embedded
      if (!this.isEmbedded) {
        console.warn('[Editor] Ignoring message - not embedded');
        return;
      }

      // Validate origin is in whitelist
      if (!this.allowedOrigins.includes(event.origin)) {
        console.warn('[Editor] Message from non-whitelisted origin:', event.origin);
        return;
      }

      // Set parent origin from first valid message if not already set
      if (!this.parentOrigin) {
        this.parentOrigin = event.origin;
        console.log('[Editor] Parent origin set to:', this.parentOrigin);
      }

      // Validate origin matches established parent
      if (event.origin !== this.parentOrigin) {
        console.warn('[Editor] Message from different origin than parent:', event.origin);
        return;
      }

      const { type, config } = event.data;

      if (type === 'LOAD_CONFIG' && config) {
        console.log('[Editor] Received LOAD_CONFIG from parent');

        // Validate config structure before loading
        if (!this.validateConfigStructure(config)) {
          console.error('[Editor] Invalid config structure received');
          this.notifyParentError('Invalid config structure');
          return;
        }

        this.loadConfigFromObject(config);
      }
    });

    // Notify parent that editor is ready
    if (this.isEmbedded) {
      // Only send to parent origin if known, otherwise broadcast once
      const targetOrigin = this.parentOrigin || '*';
      window.parent.postMessage({ type: 'EDITOR_READY' }, targetOrigin);
      console.log('[Editor] Sent EDITOR_READY to:', targetOrigin);

      // Show embedded mode badge
      const embeddedBadge = document.getElementById('embedded-badge');
      if (embeddedBadge) {
        embeddedBadge.style.display = 'flex';
      }
    }
  }

  /**
   * Validate incoming config structure
   */
  validateConfigStructure(config) {
    if (!config || typeof config !== 'object') return false;
    if (!config.version || !config.assets || !Array.isArray(config.assets)) return false;
    if (!config.schedule || !Array.isArray(config.schedule)) return false;

    // Sanitize URLs to prevent XSS
    config.assets.forEach(asset => {
      if (asset.url && typeof asset.url === 'string') {
        // Only allow https, http, and data URLs
        const url = asset.url.toLowerCase();
        if (!url.startsWith('https://') &&
            !url.startsWith('http://') &&
            !url.startsWith('data:image/') &&
            !url.startsWith('data:video/')) {
          console.warn('[Editor] Suspicious URL blocked:', asset.url);
          asset.url = '';
        }
      }
    });

    return true;
  }

  /**
   * Notify parent of error
   */
  notifyParentError(message) {
    if (!this.isEmbedded || !this.parentOrigin) return;

    window.parent.postMessage({
      type: 'ERROR',
      message: message
    }, this.parentOrigin);
  }

  /**
   * Send config update to parent window (when embedded)
   */
  notifyParentConfigUpdate() {
    if (!this.isEmbedded || !this.parentOrigin) return;

    const config = this.generateConfig();

    // Rate limiting: Don't send more than once per 500ms
    if (this._lastNotifyTime && Date.now() - this._lastNotifyTime < 500) {
      clearTimeout(this._notifyTimeout);
      this._notifyTimeout = setTimeout(() => {
        this.notifyParentConfigUpdate();
      }, 500);
      return;
    }
    this._lastNotifyTime = Date.now();

    window.parent.postMessage({
      type: 'CONFIG_UPDATED',
      config
    }, this.parentOrigin);

    console.log('[Editor] Sent CONFIG_UPDATED to parent');
  }

  initEventListeners() {
    // Add asset button
    document.getElementById('add-asset-btn').addEventListener('click', () => {
      this.showAddAssetModal();
    });

    // Asset source toggle (upload vs URL)
    document.querySelectorAll('input[name="asset-source"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const uploadSection = document.getElementById('upload-section');
        const urlSection = document.getElementById('url-section');

        if (e.target.value === 'upload') {
          uploadSection.style.display = 'flex';
          urlSection.style.display = 'none';
          document.getElementById('asset-url').required = false;
          document.getElementById('asset-file').required = true;
        } else {
          uploadSection.style.display = 'none';
          urlSection.style.display = 'flex';
          document.getElementById('asset-file').required = false;
          document.getElementById('asset-url').required = true;
        }
      });
    });

    // File input - auto-populate asset ID from filename
    document.getElementById('asset-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const assetIdInput = document.getElementById('asset-id');
        if (!assetIdInput.value) {
          assetIdInput.value = fileName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
        }

        // Auto-detect type
        const assetTypeSelect = document.getElementById('asset-type');
        if (file.type.startsWith('image/')) {
          assetTypeSelect.value = 'image';
        } else if (file.type.startsWith('video/')) {
          assetTypeSelect.value = 'video';
        }
      }
    });

    // Add schedule button
    document.getElementById('add-schedule-btn').addEventListener('click', () => {
      this.showAddScheduleModal();
    });

    // Asset form submit
    document.getElementById('asset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveAsset();
    });

    // Schedule form submit
    document.getElementById('schedule-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveScheduleBlock();
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    // Settings inputs
    document.getElementById('poll-interval').addEventListener('change', (e) => {
      this.settings.poll_interval_sec = parseInt(e.target.value, 10);
      this.notifyParentConfigUpdate();
    });
    document.getElementById('cache-size').addEventListener('change', (e) => {
      this.settings.cache_size_gb = parseFloat(e.target.value);
      this.notifyParentConfigUpdate();
    });
    document.getElementById('health-url').addEventListener('change', (e) => {
      this.settings.health_report_url = e.target.value;
      this.notifyParentConfigUpdate();
    });
    document.getElementById('analytics-url').addEventListener('change', (e) => {
      this.settings.analytics_webhook = e.target.value;
      this.notifyParentConfigUpdate();
    });

    // Validate button
    document.getElementById('validate-btn').addEventListener('click', () => {
      this.validateConfig();
    });

    // Export buttons
    document.getElementById('export-btn').addEventListener('click', () => {
      this.exportConfig();
    });
    document.getElementById('export-final-btn').addEventListener('click', () => {
      this.exportConfig();
    });

    // Import button
    document.getElementById('import-btn').addEventListener('click', () => {
      this.showImportDialog();
    });

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModals();
      }
    });
  }

  showAddAssetModal(index = null) {
    this.currentEditIndex = index;
    this.addAssetModal.classList.add('active');

    // Reset form
    document.getElementById('asset-form').reset();

    // If editing, populate form and switch to URL mode
    if (index !== null) {
      const asset = this.assets[index];
      document.getElementById('asset-id').value = asset.id;
      document.getElementById('asset-type').value = asset.type;
      document.getElementById('asset-url').value = asset.url;
      document.getElementById('asset-cached').checked = asset.cached;

      // Switch to URL mode for editing
      document.querySelector('input[name="asset-source"][value="url"]').checked = true;
      document.getElementById('upload-section').style.display = 'none';
      document.getElementById('url-section').style.display = 'flex';
      document.getElementById('asset-url').required = true;
      document.getElementById('asset-file').required = false;
    } else {
      // Default to upload mode for new assets
      document.querySelector('input[name="asset-source"][value="upload"]').checked = true;
      document.getElementById('upload-section').style.display = 'flex';
      document.getElementById('url-section').style.display = 'none';
      document.getElementById('asset-file').required = true;
      document.getElementById('asset-url').required = false;
    }

    // Focus first input
    document.getElementById('asset-id').focus();
  }

  showAddScheduleModal(index = null) {
    this.currentEditIndex = index;
    this.addScheduleModal.classList.add('active');

    // Populate asset checkboxes
    const assetsContainer = document.getElementById('schedule-assets');
    if (this.assets.length === 0) {
      assetsContainer.innerHTML = '<p class="help-text">Add assets first to populate this list.</p>';
    } else {
      assetsContainer.innerHTML = this.assets.map((asset, i) => `
        <label>
          <input type="checkbox" value="${asset.id}" name="schedule-asset-${i}">
          ${asset.id} (${asset.type})
        </label>
      `).join('');
    }

    // If editing, populate form
    if (index !== null) {
      const block = this.scheduleBlocks[index];
      document.getElementById('schedule-start').value = block.time_range[0];
      document.getElementById('schedule-end').value = block.time_range[1];
      document.getElementById('schedule-durations').value = block.durations_sec.join(', ');
      document.getElementById('transition-type').value = block.transition.type;

      // Check selected assets
      block.playlist.forEach(assetId => {
        const checkbox = assetsContainer.querySelector(`input[value="${assetId}"]`);
        if (checkbox) checkbox.checked = true;
      });
    } else {
      document.getElementById('schedule-form').reset();
    }

    // Focus first input
    document.getElementById('schedule-start').focus();
  }

  closeModals() {
    this.addAssetModal.classList.remove('active');
    this.addScheduleModal.classList.remove('active');
    this.currentEditIndex = null;
  }

  async saveAsset() {
    const assetId = document.getElementById('asset-id').value.trim();
    const assetType = document.getElementById('asset-type').value;
    const cached = document.getElementById('asset-cached').checked;
    const assetSource = document.querySelector('input[name="asset-source"]:checked').value;

    let assetUrl;

    // Handle file upload vs URL
    if (assetSource === 'upload') {
      const fileInput = document.getElementById('asset-file');
      const file = fileInput.files[0];

      if (!file) {
        alert('Please select a file to upload.');
        return;
      }

      // Convert file to data URL
      assetUrl = await this.fileToDataUrl(file);
    } else {
      assetUrl = document.getElementById('asset-url').value.trim();

      if (!assetUrl) {
        alert('Please enter a URL.');
        return;
      }
    }

    const asset = {
      id: assetId,
      type: assetType,
      url: assetUrl,
      cached: cached
    };

    // Check for duplicate ID
    const existingIndex = this.assets.findIndex(a => a.id === asset.id);
    if (existingIndex !== -1 && existingIndex !== this.currentEditIndex) {
      alert(`Asset ID "${asset.id}" already exists. Please use a unique ID.`);
      return;
    }

    if (this.currentEditIndex !== null) {
      this.assets[this.currentEditIndex] = asset;
    } else {
      this.assets.push(asset);
    }

    this.renderAssets();
    this.closeModals();
    this.notifyParentConfigUpdate();
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  saveScheduleBlock() {
    const startTime = document.getElementById('schedule-start').value;
    const endTime = document.getElementById('schedule-end').value;
    const durationsInput = document.getElementById('schedule-durations').value;
    const transitionType = document.getElementById('transition-type').value;

    // Get selected assets
    const selectedAssets = Array.from(
      document.querySelectorAll('#schedule-assets input:checked')
    ).map(input => input.value);

    if (selectedAssets.length === 0) {
      alert('Please select at least one asset.');
      return;
    }

    // Parse durations
    const durations = durationsInput.split(',').map(d => {
      const trimmed = d.trim();
      return trimmed === '0' ? null : parseInt(trimmed, 10);
    });

    if (durations.length !== selectedAssets.length) {
      alert(`Please provide ${selectedAssets.length} duration(s) to match the number of selected assets.`);
      return;
    }

    // Check for overlapping time ranges
    const newBlock = {
      time_range: [startTime, endTime],
      playlist: selectedAssets,
      durations_sec: durations,
      transition: {
        type: transitionType,
        duration_ms: transitionType === 'crossfade' ? 300 : transitionType === 'fade-to-black' ? 400 : 0
      }
    };

    if (this.currentEditIndex === null && this.hasOverlap(newBlock)) {
      const proceed = confirm('This schedule block overlaps with an existing block. The last-defined block will take precedence. Continue?');
      if (!proceed) return;
    }

    if (this.currentEditIndex !== null) {
      this.scheduleBlocks[this.currentEditIndex] = newBlock;
    } else {
      this.scheduleBlocks.push(newBlock);
    }

    this.renderSchedule();
    this.closeModals();
    this.notifyParentConfigUpdate();
  }

  hasOverlap(newBlock) {
    const [newStart, newEnd] = newBlock.time_range;
    const newStartMin = this.timeToMinutes(newStart);
    const newEndMin = this.timeToMinutes(newEnd);

    for (const block of this.scheduleBlocks) {
      const [start, end] = block.time_range;
      const startMin = this.timeToMinutes(start);
      const endMin = this.timeToMinutes(end);

      // Check overlap
      if (
        (newStartMin >= startMin && newStartMin < endMin) ||
        (newEndMin > startMin && newEndMin <= endMin) ||
        (newStartMin <= startMin && newEndMin >= endMin)
      ) {
        return true;
      }
    }

    return false;
  }

  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  renderAssets() {
    if (this.assets.length === 0) {
      this.assetsEmpty.style.display = 'flex';
      this.assetList.style.display = 'none';
      return;
    }

    this.assetsEmpty.style.display = 'none';
    this.assetList.style.display = 'flex';

    this.assetList.innerHTML = this.assets.map((asset, index) => {
      // Show actual thumbnail for images
      let thumbnailContent;
      if (asset.type === 'image' && asset.url) {
        thumbnailContent = `<img src="${asset.url}" alt="${asset.id} thumbnail" class="asset-thumbnail-img">`;
      } else {
        thumbnailContent = asset.type === 'image' ? '🖼️' : asset.type === 'video' ? '🎥' : '📡';
      }

      return `
        <li class="asset-card" role="listitem">
          <div class="asset-thumbnail" aria-hidden="true">
            ${thumbnailContent}
          </div>
          <div class="asset-info">
            <h3 id="asset-${index}-name">${asset.id}</h3>
            <div class="asset-type">${asset.type}</div>
          </div>
          <div class="asset-actions">
            <button class="btn btn-secondary btn-small" aria-label="Edit ${asset.id}" onclick="editor.showAddAssetModal(${index})">
              Edit
            </button>
            <button class="btn btn-secondary btn-small" aria-label="Delete ${asset.id}" onclick="editor.deleteAsset(${index})">
              Delete
            </button>
          </div>
        </li>
      `;
    }).join('');

    // Update storage meter (rough estimate: 10MB per asset)
    const estimatedSize = this.assets.length * 0.01; // 0.01 GB = 10MB
    const cacheSizeGb = this.settings.cache_size_gb;
    const percentage = Math.min((estimatedSize / cacheSizeGb) * 100, 100);

    this.storageValue.textContent = `${estimatedSize.toFixed(2)} GB / ${cacheSizeGb} GB`;
    this.storageFill.style.width = `${percentage}%`;
  }

  renderSchedule() {
    if (this.scheduleBlocks.length === 0) {
      this.scheduleEmpty.style.display = 'flex';
      this.scheduleList.style.display = 'none';
      return;
    }

    this.scheduleEmpty.style.display = 'none';
    this.scheduleList.style.display = 'flex';

    this.scheduleList.innerHTML = this.scheduleBlocks.map((block, index) => `
      <li class="schedule-card" role="listitem">
        <div class="schedule-header">
          <div class="schedule-time">${block.time_range[0]} - ${block.time_range[1]}</div>
          <div class="asset-actions">
            <button class="btn btn-secondary btn-small" onclick="editor.showAddScheduleModal(${index})">
              Edit
            </button>
            <button class="btn btn-secondary btn-small" onclick="editor.deleteScheduleBlock(${index})">
              Delete
            </button>
          </div>
        </div>
        <div class="schedule-details">
          <div><strong>Assets:</strong> ${block.playlist.join(', ')}</div>
          <div><strong>Durations:</strong> ${block.durations_sec.map(d => d === null ? 'until block ends' : `${d}s`).join(', ')}</div>
          <div><strong>Transition:</strong> ${block.transition.type}</div>
        </div>
      </li>
    `).join('');
  }

  deleteAsset(index) {
    const asset = this.assets[index];
    const confirmed = confirm(`Delete asset "${asset.id}"? This cannot be undone.`);
    if (!confirmed) return;

    this.assets.splice(index, 1);
    this.renderAssets();
    this.notifyParentConfigUpdate();
  }

  deleteScheduleBlock(index) {
    const confirmed = confirm('Delete this schedule block? This cannot be undone.');
    if (!confirmed) return;

    this.scheduleBlocks.splice(index, 1);
    this.renderSchedule();
    this.notifyParentConfigUpdate();
  }

  validateConfig() {
    this.validationStatus.className = 'validation-status';
    this.validationStatus.textContent = '';

    // Basic validation
    if (this.assets.length === 0) {
      this.validationStatus.className = 'validation-status error';
      this.validationStatus.textContent = '❌ Validation failed: No assets defined';
      return false;
    }

    if (this.scheduleBlocks.length === 0) {
      this.validationStatus.className = 'validation-status error';
      this.validationStatus.textContent = '❌ Validation failed: No schedule blocks defined';
      return false;
    }

    // Check that fallback asset exists (use first asset as fallback)
    const config = this.buildConfig();

    // Check that all schedule assets exist
    for (const block of config.schedule) {
      for (const assetId of block.playlist) {
        if (!config.assets.find(a => a.id === assetId)) {
          this.validationStatus.className = 'validation-status error';
          this.validationStatus.textContent = `❌ Validation failed: Schedule references non-existent asset "${assetId}"`;
          return false;
        }
      }
    }

    this.validationStatus.className = 'validation-status success';
    this.validationStatus.textContent = '✅ Configuration valid';
    return true;
  }

  generateConfig() {
    return this.buildConfig();
  }

  buildConfig() {
    return {
      version: '1.0',
      package_version: new Date().toISOString(),
      settings: this.settings,
      assets: this.assets,
      schedule: this.scheduleBlocks,
      fallback: {
        asset_id: this.assets[0]?.id || '',
        message: 'Offline - Showing Cached Content'
      }
    };
  }

  exportConfig() {
    if (!this.validateConfig()) {
      alert('Please fix validation errors before exporting.');
      return;
    }

    const config = this.buildConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);

    alert('Config exported successfully! Upload it to your signage player.');
  }

  showImportDialog() {
    const source = prompt(
      'Import config from:\n\n1. Enter "file" to upload a JSON file\n2. Enter a URL to fetch config from GitHub/CDN\n\nExample URL:\nhttps://raw.githubusercontent.com/user/repo/main/config.json'
    );

    if (!source) return;

    if (source.toLowerCase() === 'file') {
      this.importFromFile();
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      this.importFromURL(source);
    } else {
      alert('Invalid input. Please enter "file" or a valid URL starting with http:// or https://');
    }
  }

  importFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text);
        this.loadConfig(config);
        alert('Config imported successfully!');
      } catch (error) {
        alert(`Failed to import config: ${error.message}`);
      }
    };

    input.click();
  }

  async importFromURL(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const config = await response.json();
      this.loadConfig(config);
      alert('Config imported successfully from URL!');
    } catch (error) {
      alert(`Failed to fetch config from URL: ${error.message}`);
    }
  }

  updateStorageMeter() {
    // Calculate total storage used (approximate)
    let totalBytes = 0;
    this.assets.forEach(asset => {
      // Rough estimate: assume 1MB per image, 10MB per video
      if (asset.type === 'image') {
        totalBytes += 1 * 1024 * 1024; // 1MB
      } else if (asset.type === 'video') {
        totalBytes += 10 * 1024 * 1024; // 10MB
      }
    });

    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const cacheGB = this.settings.cache_size_gb || 5;
    const percentage = Math.min((totalGB / cacheGB) * 100, 100);

    if (this.storageValue) {
      this.storageValue.textContent = `${totalGB.toFixed(2)} GB / ${cacheGB} GB`;
    }
    if (this.storageFill) {
      this.storageFill.style.width = `${percentage}%`;
    }
  }

  /**
   * Load config from object (used by postMessage API)
   */
  loadConfigFromObject(config) {
    this.loadConfig(config);
    console.log('[Editor] Config loaded from postMessage');
  }

  loadConfig(config) {
    // Clear existing data
    this.assets = [];
    this.scheduleBlocks = [];

    // Load settings
    if (config.settings) {
      this.settings = { ...this.settings, ...config.settings };
      document.getElementById('cache-size').value = config.settings.cache_size_gb || 5;
      document.getElementById('poll-interval').value = config.settings.poll_interval_sec || 300;
      document.getElementById('health-url').value = config.settings.health_report_url || '';
      document.getElementById('analytics-url').value = config.settings.analytics_webhook || '';
    }

    // Load assets
    if (config.assets && Array.isArray(config.assets)) {
      config.assets.forEach(asset => {
        this.assets.push({
          id: asset.id,
          type: asset.type,
          url: asset.url,
          cached: asset.cached !== false, // Default true
          file: null
        });
      });
    }

    // Load schedule blocks
    if (config.schedule && Array.isArray(config.schedule)) {
      config.schedule.forEach(block => {
        this.scheduleBlocks.push({
          time_range: block.time_range || ['00:00', '23:59'],
          playlist: block.playlist || [],
          durations_sec: block.durations_sec || [],
          transition: block.transition || { type: 'crossfade', duration_ms: 300 }
        });
      });
    }

    // Refresh UI
    this.renderAssets();
    this.renderSchedule();
    this.updateStorageMeter();
  }
}

// Initialize editor
const editor = new ConfigEditor();

// Make editor globally accessible for onclick handlers
window.editor = editor;
