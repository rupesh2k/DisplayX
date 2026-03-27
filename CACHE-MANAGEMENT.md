# Cache Management Guide

DisplayX uses IndexedDB to cache assets locally for offline playback. This guide explains how the cache works and how to manage it.

## How Cache Works

1. **Initial Load:** Player fetches config and downloads all assets marked with `"cached": true`
2. **Subsequent Loads:** Player uses cached assets instead of re-downloading
3. **Cache Updates:** Player automatically detects config changes and refreshes cache

## Automatic Cache Clearing

The player automatically clears the cache when it detects a **config version change**.

### How It Works

The player tracks the `package_version` field in your config:

```json
{
  "version": "1.0",
  "package_version": "2026-03-27T10:00:00Z",
  ...
}
```

When you update your config:
1. Change the `package_version` to a new value (usually current timestamp)
2. Players detect the change on next load
3. Old cache is automatically cleared
4. New assets are downloaded

### Example Workflow

**Before (old config):**
```json
{
  "package_version": "2026-03-27T10:00:00Z",
  "assets": [
    {"id": "old-video", "url": "https://cdn.com/old.mp4", "cached": true}
  ]
}
```

**After (updated config):**
```json
{
  "package_version": "2026-03-27T14:30:00Z",
  "assets": [
    {"id": "new-video", "url": "https://cdn.com/new.mp4", "cached": true}
  ]
}
```

**Result:**
- Player detects version changed: `10:00:00Z` → `14:30:00Z`
- Clears old cache (removes `old-video`)
- Downloads new assets (`new-video`)

## Manual Cache Clearing

You can force cache clearing by adding a URL parameter:

```
?clear-cache=true
```

### Examples

**Local Testing:**
```
http://localhost:8080/player.html?config=http://localhost:8080/examples/config.json&clear-cache=true
```

**Production:**
```
https://yourdomain.com/player.html?config=https://raw.githubusercontent.com/yourname/repo/main/config.json&clear-cache=true
```

### When to Use Manual Clearing

- Testing config changes locally
- Assets updated but config URL stayed the same
- Debugging cache issues
- Force fresh download of all assets

## Cache Size Management

Configure cache size limit in your config:

```json
{
  "settings": {
    "cache_size_gb": 5
  }
}
```

**Default:** 5 GB

### Cache Eviction

When cache is full, the player automatically evicts **oldest assets first (FIFO)** to make room for new ones.

**Example:**
- Cache limit: 5 GB
- Current cache: 4.8 GB
- New asset: 500 MB
- Result: Oldest 300+ MB of assets are evicted

## Cache Storage Details

### What Gets Cached

Only assets with `"cached": true`:

```json
{
  "assets": [
    {"id": "logo", "url": "...", "cached": true},     // ✓ Cached
    {"id": "stream", "url": "...", "cached": false}   // ✗ Streamed
  ]
}
```

### Storage Location

- **Technology:** IndexedDB
- **Database Name:** `DisplayXCache`
- **Store Name:** `assets`
- **Storage:** Browser's local storage (persistent)

### Cached Data Structure

```javascript
{
  id: "asset-id",
  type: "image" | "video",
  url: "original-url",
  blob: Blob,           // Actual file data
  size: 1234567,        // Bytes
  timestamp: 1234567890 // Cache time
}
```

## Troubleshooting

### Cache Not Clearing Automatically

**Check:**
1. Did you update `package_version` in config?
2. Is the new config being loaded? (Check browser console)
3. Try manual clear: add `?clear-cache=true` to URL

**Solution:**
```json
{
  "package_version": "2026-03-27T15:45:30Z"  // Use current timestamp
}
```

### Storage Quota Exceeded

**Symptoms:**
- "Quota exceeded" error in console
- Assets failing to cache

**Solutions:**
1. **Reduce cache size:**
   ```json
   {"settings": {"cache_size_gb": 2}}
   ```

2. **Mark fewer assets as cached:**
   ```json
   {"assets": [
     {"id": "bg", "url": "...", "cached": false}  // Stream instead
   ]}
   ```

3. **Compress assets:**
   - Use smaller video resolutions
   - Compress images (JPEG at 80-90% quality)

### Cache Persisting After Clear

**Check:**
1. Browser might be caching the HTML/JS files
2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Check if `?clear-cache=true` is in URL
4. Manually clear browser data (Settings → Privacy)

### Assets Re-downloading Every Load

**Symptoms:**
- Slow startup every time
- Network activity on every load

**Check:**
1. Are assets marked `"cached": true`?
2. Is cache size sufficient? (check console for eviction warnings)
3. Is device storage full?

## Best Practices

### 1. Always Update package_version

When updating config, always increment `package_version`:

```bash
# Use current timestamp
"package_version": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### 2. Version Control Your Config

Keep config in Git and use commit timestamps:

```json
{
  "package_version": "2026-03-27T10:30:00Z",
  "comment": "Updated logo and added new promo video"
}
```

### 3. Test Cache Updates

Before deploying config changes:
1. Test locally with `?clear-cache=true`
2. Verify old assets are removed
3. Verify new assets download correctly
4. Check total cache size

### 4. Monitor Cache Size

Add logging to track cache usage:
```javascript
// In browser console
indexedDB.databases().then(dbs => console.log(dbs));
```

### 5. Schedule Cache Maintenance

For 24/7 deployments:
- Reboot devices weekly (clears memory)
- Monitor storage usage
- Set conservative cache limits

## Quick Reference

| Action | Method |
|--------|--------|
| Auto clear on config change | Update `package_version` |
| Manual clear | Add `?clear-cache=true` to URL |
| Set cache size | `settings.cache_size_gb` in config |
| Cache specific asset | `"cached": true` in asset |
| Stream asset (no cache) | `"cached": false` in asset |

## Examples

### Example 1: Update Promotional Video

**Step 1:** Update config
```json
{
  "package_version": "2026-03-27T14:00:00Z",  // Changed from 10:00
  "assets": [
    {"id": "promo", "url": "https://cdn.com/new-promo.mp4", "cached": true}
  ]
}
```

**Step 2:** Commit and push to GitHub

**Step 3:** Players automatically:
- Detect version change
- Clear old `promo` from cache
- Download new `promo` video

**No manual intervention needed!**

### Example 2: Test Config Locally

```bash
# Start local server
npm run dev

# Open with cache clear
open "http://localhost:8080/player.html?config=http://localhost:8080/examples/config.json&clear-cache=true"
```

### Example 3: Production Deployment

```
https://yourdomain.com/player.html?config=https://raw.githubusercontent.com/yourname/signage/main/config.json
```

**Update workflow:**
1. Edit `config.json` in GitHub
2. Update `package_version` to current time
3. Commit
4. All players fetch new config on next poll (default: 5 minutes)
5. Players auto-clear cache and update assets

---

## Summary

- **Automatic:** Cache clears when `package_version` changes
- **Manual:** Add `?clear-cache=true` to URL
- **Size:** Configurable via `cache_size_gb`
- **Eviction:** FIFO (oldest first)
- **Best Practice:** Always update `package_version` when changing config
