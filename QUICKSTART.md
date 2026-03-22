# DisplayX Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start the Server

A local HTTP server is already running on port 8080.

If you need to restart it:
```bash
python3 -m http.server 8080
```

### Step 2: Create a Config

**Option A: Use the Config Editor (Recommended)**

1. Open http://localhost:8080/editor/
2. Click **[+ Add Asset]** to add images/videos:
   - Example image: https://via.placeholder.com/1920x1080/2563eb/ffffff?text=DisplayX
   - Example video: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
3. Click **[+ Add Schedule Block]** to define when assets play:
   - Time range: 00:00 - 23:59 (all day)
   - Select your assets
   - Set durations (e.g., 10, 30 for 10sec and 30sec)
4. Click **[Validate]** to check for errors
5. Click **[Export config.json]** to download

**Option B: Use the Example Config**

The project includes a working example at `/examples/config-minimal.json`

### Step 3: Test the Player

Open the player with your config:

**Using example config:**
```
http://localhost:8080/player.html?config=http://localhost:8080/examples/config-minimal.json
```

**Using your exported config** (upload it to `/examples/` first):
```
http://localhost:8080/player.html?config=http://localhost:8080/examples/config-YYYY-MM-DD.json
```

## 📺 What You'll See

1. **Loading Screen:** "Loading content... Caching X of Y assets..."
2. **Playback:** Assets play full-screen according to schedule
3. **Offline Badge:** Top-right corner appears if network is lost

## ⌨️ Keyboard Controls

**Player (Error State Only):**
- Tab/Shift+Tab: Navigate between [Retry] and [Use Cached]
- Enter: Activate focused button
- Escape: (No effect, player auto-plays)

**Config Editor:**
- Tab: Navigate through form fields
- Enter: Submit forms, activate buttons
- Escape: Close modal dialogs

## 🎨 Design Features

- **Full-screen immersive player:** No UI chrome during playback
- **Loading states:** Progress indicators show what's happening
- **Error states:** Clear messages with retry actions
- **Offline mode:** Badge appears, playback continues with cache
- **Responsive:** Mobile tabs, tablet/desktop side-by-side
- **Accessible:** Keyboard navigation, screen reader support, WCAG AA

## 🛠️ Troubleshooting

**Player shows "Missing config URL parameter":**
- Ensure you're using `?config=https://...` in the URL

**Assets not caching:**
- Check browser console (F12) for errors
- Verify asset URLs are accessible (CORS-enabled)
- IndexedDB might be disabled (check browser settings)

**Schedule not working:**
- Verify time ranges don't overlap (editor will warn)
- Check that asset IDs in schedule match asset list
- Ensure system time is correct (player uses device-local time)

**Black screen / no playback:**
- Open browser console (F12) to check errors
- Verify config.json is valid (use editor's Validate button)
- Check that fallback asset exists

## 📄 Config Format Reference

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

## 🔗 URLs

- **Player:** http://localhost:8080/player.html?config=...
- **Editor:** http://localhost:8080/editor/
- **Example Config:** http://localhost:8080/examples/config-minimal.json

## 📖 Next Steps

1. **Read the full spec:** `/docs/designs/digital-signage-standard.md`
2. **Check implementation status:** `/IMPLEMENTATION_STATUS.md`
3. **Explore the code:** `/js/` contains all modules (EventEmitter, ConfigFetcher, AssetCache, ScheduleEngine)
4. **Run tests:** (coming soon)

## 💡 Pro Tips

- Use **crossfade** transitions for smooth visual flow
- Set **durations_sec: [null]** to play asset until schedule block ends
- Use **cached: false** for livestreams (no pre-download)
- Set **poll_interval_sec: 5** for fast hot reload during development
- Export configs with descriptive names (e.g., `lobby-config.json`, `retail-config.json`)

Enjoy building your digital signage system! 🎉
