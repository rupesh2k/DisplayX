# DisplayX - Digital Signage Protocol

Reference implementation of the DisplayX digital signage standard.

# Editor - https://rupesh2k.github.io/DisplayX/editor/

# Demo - https://rupesh2k.github.io/DisplayX/player.html?config=https://raw.githubusercontent.com/rupesh2k/DigitalSignageContent/main/config-2026-03-27%20(1).json

# Shorthen URL for Demo - https://tinyurl.com/352n94m5

## Quick Start

### Option 1: Static Mode (No Server)

```bash
# 1. Start Local Server
python3 -m http.server 8080
# OR: npx http-server -p 8080

# 2. Open Player
http://localhost:8080/player.html?config=http://localhost:8080/examples/config-minimal.json
```

### Option 2: Server Mode (with DisplayX-Server)

```bash
# 1. Open Setup Page
http://localhost:8080/setup.html

# 2. Enter Your Server Details
# - Server URL: https://your-displayx-server.com
# - Device Name: Lobby Display

# 3. Device Registers and Redirects to Player
# Config is now managed from your server dashboard
```

**Server Mode Features:**
- Central device management
- Remote config updates
- Device health monitoring
- Analytics and reporting

[Learn more about DisplayX-Server](https://github.com/rupesh2k/DisplayX-Server)

## Project Structure

```
DisplayX/
├── player.html           # Main player interface (full-screen playback)
├── editor/              # Config editor (form-based)
│   └── index.html
├── preview/             # Preview mode (timeline visualization)
│   └── index.html
├── js/                  # JavaScript modules
│   ├── EventEmitter.js  # Pub/sub for state management
│   ├── ConfigFetcher.js # Config loading and validation
│   ├── AssetCache.js    # IndexedDB asset caching
│   ├── ScheduleEngine.js# Time-based playback scheduling
│   ├── Heartbeat.js     # Server heartbeat (device health)
│   └── player.js        # Main player orchestrator
├── css/                 # Stylesheets
│   └── player.css       # Player styles (design tokens)
├── examples/            # Example config files
│   └── config-minimal.json
├── config.schema.json   # JSON Schema for validation
└── package.json
```

## Config Format

```json
{
  "version": "1.0",
  "package_version": "2026-03-21T10:00:00Z",
  "settings": {
    "cache_size_gb": 5,
    "poll_interval_sec": 300
  },
  "assets": [
    {
      "id": "logo",
      "type": "image",
      "url": "https://example.com/logo.png",
      "cached": true
    }
  ],
  "schedule": [
    {
      "time_range": ["09:00", "17:00"],
      "playlist": ["logo"],
      "durations_sec": [10],
      "transition": {"type": "crossfade", "duration_ms": 300}
    }
  ],
  "fallback": {
    "asset_id": "logo",
    "message": "Offline"
  }
}
```

## Features Implemented

✅ Config loading and validation (JSON Schema)
✅ Asset caching (IndexedDB, FIFO eviction)
✅ Schedule engine (time-based playback)
✅ Transition effects (crossfade, fade-to-black, hard-cut)
✅ Offline mode (cached playback continues)
✅ Error handling (retry/use cached)
✅ Responsive design (mobile/tablet/desktop)
✅ Accessibility (keyboard nav, ARIA, screen readers)
✅ CSP security headers
✅ Server mode (device registration, heartbeat, remote config)
✅ HLS livestream support (hls.js)

## Features In Progress

🚧 Config editor (form-based UI)
🚧 Preview mode (timeline visualization)
🚧 Conditional display rules (date ranges, device tags)
🚧 Analytics hooks (impression tracking)
🚧 Health reporting (device status)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires:
- IndexedDB API
- ES6 Modules
- CSS Grid/Flexbox

## Development

```bash
# Install dependencies
npm install

# Run local server
npm run dev

# Validate config
npm run validate examples/config-minimal.json
```

## Design Principles

- **Offline-first:** Player caches assets and continues playback without network
- **Config-driven:** All behavior controlled by config.json (no hardcoded logic)
- **Standard-compliant:** JSON Schema validation ensures interoperability
- **Accessible:** WCAG AA compliance (keyboard nav, screen readers, contrast)
- **Minimal:** Vanilla JavaScript, no frameworks (reduces bundle size)
- **Mode-agnostic:** Works with static configs OR central server (backward compatible)

## Server Mode vs Static Mode

| Feature | Static Mode | Server Mode |
|---------|-------------|-------------|
| **Setup** | Point player to JSON URL | One-time device registration |
| **Config Updates** | Manual (re-deploy JSON file) | Automatic (server pushes updates) |
| **Device Management** | None | Dashboard with device list, status |
| **Analytics** | None | Playback tracking, impressions |
| **Multi-device** | Manage each separately | Centralized control |
| **Offline** | ✅ Works offline | ✅ Works offline (cached config) |
| **Best for** | Single screen, DIY setups | Multiple screens, businesses |

**Both modes use the same player code** - choose what fits your needs.

## Server Options

1. **Build your own** - Use config.schema.json as the API contract
2. **DisplayX-Server** - Official server implementation ([GitHub](https://github.com/rupesh2k/DisplayX-Server))
   - Self-hosted (open core, coming Q3 2026)
   - Managed hosting ($20/month flat rate, coming Q3 2026)
3. **Static JSON hosting** - Current method (GitHub Pages, S3, etc.)

## License

MIT
