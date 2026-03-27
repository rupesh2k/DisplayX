# DisplayX Deployment Guide

This guide explains how to deploy DisplayX to various digital signage devices including Fire TV Stick, Chromecast, Android TV boxes, and more.

## Table of Contents
1. [Cache Management](#cache-management)
2. [Fire TV Stick](#fire-tv-stick)
3. [Android TV Boxes](#android-tv-boxes)
4. [Chromecast](#chromecast)
5. [Raspberry Pi](#raspberry-pi)
6. [Web Hosting](#web-hosting)

---

## Cache Management

### Automatic Cache Clearing

DisplayX automatically clears the cache when it detects a config version change (using `package_version` field).

**Example:** When you update your config and change:
```json
"package_version": "2026-03-27T10:00:00Z"
```
to:
```json
"package_version": "2026-03-27T11:00:00Z"
```

The player will automatically clear old cached assets and download new ones.

### Manual Cache Clearing

Add `?clear-cache=true` to your URL:

```
http://localhost:8080/player.html?config=YOUR_CONFIG_URL&clear-cache=true
```

**Example:**
```
http://localhost:8080/player.html?config=https://raw.githubusercontent.com/yourname/repo/main/config.json&clear-cache=true
```

This forces a fresh download of all assets, ignoring the cache.

---

## Fire TV Stick

Fire TV Stick runs Amazon's Fire OS (Android-based) and includes the Silk Browser.

### Option 1: Silk Browser (Simplest)

1. **Install Silk Browser** (usually pre-installed)
2. **Navigate to your player URL:**
   ```
   https://yourdomain.com/player.html?config=https://yourdomain.com/config.json
   ```
3. **Enable Fullscreen:**
   - Press the menu button
   - Select "Fullscreen"

**Limitations:**
- Manual startup required after each reboot
- Browser UI may be visible
- Sleep mode can interrupt playback

### Option 2: Fully Kiosk Browser (Recommended)

**Fully Kiosk Browser** is a professional kiosk mode browser for Android/Fire OS.

1. **Enable ADB on Fire TV:**
   - Settings → My Fire TV → Developer Options → ADB Debugging → ON

2. **Install Fully Kiosk Browser:**
   ```bash
   adb connect FIRE_TV_IP_ADDRESS
   adb install fully-kiosk-browser.apk
   ```
   Download APK from: https://www.fully-kiosk.com

3. **Configure Fully Kiosk:**
   - Set Start URL: `https://yourdomain.com/player.html?config=...`
   - Enable "Launch on Boot"
   - Enable "Keep Screen On"
   - Disable "Show Navigation Bar"
   - Enable "Prevent Sleep"

4. **Set as Default Launcher:**
   - Settings → Applications → Manage Installed Applications → Fully Kiosk Browser → Launch by default

**Benefits:**
- Auto-start on boot
- True fullscreen (no browser UI)
- Remote management via web interface
- Scheduled reboots
- Motion detection (optional)

### Option 3: Custom Fire TV App (Advanced)

Build a native Fire TV app using Amazon's Web App Tester:

1. **Create Fire TV Web App:**
   - Use Amazon's Web App Tester
   - Package your player as a Fire TV app
   - Submit to Amazon Appstore (optional)

**Resources:**
- https://developer.amazon.com/docs/fire-tv/web-app-starter-kit-for-fire-tv.html

---

## Android TV Boxes

Android TV boxes (Nvidia Shield, Xiaomi Mi Box, etc.) work similarly to Fire TV.

### Option 1: Chrome Browser

Most Android TV boxes include Chrome or can install it from Google Play Store.

1. **Install Chrome** from Play Store
2. **Navigate to your player URL**
3. **Enable Fullscreen** (F11 or browser menu)

### Option 2: Fully Kiosk Browser (Recommended)

Same process as Fire TV (see above).

### Option 3: Native Android App

Use Android Studio to create a WebView-based app:

```java
WebView webView = findViewById(R.id.webview);
webView.loadUrl("https://yourdomain.com/player.html?config=...");
webView.getSettings().setJavaScriptEnabled(true);
```

**Resources:**
- https://developer.android.com/develop/ui/views/layout/webapps

---

## Chromecast

Chromecast **does not support direct browser apps**. You have two options:

### Option 1: Cast from Chrome Browser (Simplest)

1. **Open Chrome browser** on your computer/phone
2. **Navigate to your player URL**
3. **Click the Cast icon** in Chrome
4. **Select your Chromecast device**

**Limitations:**
- Requires a computer/phone to stay powered on
- Not suitable for 24/7 operation

### Option 2: Chromecast with Google TV (Recommended)

Chromecast with Google TV runs Android TV, so follow the **Android TV Boxes** guide above.

### Option 3: Custom Chromecast Receiver (Advanced)

Build a custom Chromecast receiver app using Google Cast SDK:

1. **Register as a Google Cast Developer**
2. **Create a Custom Receiver Application**
3. **Deploy your player as the receiver app**

**Resources:**
- https://developers.google.com/cast/docs/web_receiver

---

## Raspberry Pi

Raspberry Pi is a popular choice for digital signage due to low cost and flexibility.

### Option 1: Chromium in Kiosk Mode (Recommended)

1. **Install Raspberry Pi OS Lite** (headless)

2. **Install Chromium:**
   ```bash
   sudo apt update
   sudo apt install chromium-browser unclutter xdotool
   ```

3. **Create autostart script:**
   ```bash
   nano ~/.config/lxsession/LXDE-pi/autostart
   ```

   Add:
   ```bash
   @xset s off
   @xset -dpms
   @xset s noblank
   @chromium-browser --noerrdialogs --disable-infobars --kiosk --incognito \
     'https://yourdomain.com/player.html?config=https://yourdomain.com/config.json'
   @unclutter -idle 0
   ```

4. **Reboot:**
   ```bash
   sudo reboot
   ```

**Benefits:**
- Fully headless operation
- Auto-start on boot
- Hardware acceleration support
- Low power consumption

### Option 2: Dedicated Signage OS

Use pre-built digital signage OS for Raspberry Pi:

- **Screenly OSE** (Open Source): https://www.screenly.io/oss/
- **info-beamer**: https://info-beamer.com/
- **Yodeck**: https://www.yodeck.com/

These support web-based content and provide remote management.

---

## Web Hosting

To make your player accessible to devices, you need to host it online.

### Option 1: GitHub Pages (Free)

1. **Create a GitHub repository** with your DisplayX files

2. **Enable GitHub Pages:**
   - Repository → Settings → Pages
   - Source: main branch
   - Save

3. **Your player URL:**
   ```
   https://yourusername.github.io/your-repo/player.html?config=...
   ```

### Option 2: Netlify/Vercel (Free)

1. **Push your code to GitHub**

2. **Connect to Netlify/Vercel:**
   - Sign up at https://netlify.com or https://vercel.com
   - Import your GitHub repository
   - Deploy

3. **Your player URL:**
   ```
   https://your-app.netlify.app/player.html?config=...
   ```

### Option 3: Self-Hosted

Run a web server on your own infrastructure:

**Using Node.js (Express):**
```bash
npm install -g http-server
http-server -p 8080 --cors
```

**Using Python:**
```bash
python3 -m http.server 8080
```

**Using Nginx:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/displayx;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

## Config URL Management

### Recommended Approach

Store your config file in a **version-controlled repository** (GitHub) and use raw URLs:

```
https://raw.githubusercontent.com/yourname/signage-content/main/config.json
```

### URL Parameters

Your player URL accepts these parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `config` | Config JSON URL (required) | `?config=https://...` |
| `clear-cache` | Force cache clear | `?clear-cache=true` |

**Full Example:**
```
https://yourdomain.com/player.html?config=https://raw.githubusercontent.com/yourname/content/main/config.json&clear-cache=true
```

### Config Update Workflow

1. **Edit your config.json** in GitHub
2. **Update `package_version`** to current timestamp
3. **Commit and push**
4. **Players automatically detect the change** and refresh assets

---

## Troubleshooting

### Player shows blank screen
- Check browser console (F12) for errors
- Verify config URL is accessible (test in browser)
- Check that assets use direct URLs (not Google Drive view links)
- Ensure CORS headers are present (if using custom server)

### Cache not clearing
- Manually add `?clear-cache=true` to URL
- Check that `package_version` in config changed
- Clear browser data manually (Settings → Privacy → Clear Data)

### Playback stuttering
- Reduce `cache_size_gb` in config
- Use lower resolution videos
- Check network bandwidth
- Ensure device has hardware acceleration enabled

### Device goes to sleep
- Enable "Keep Screen On" in kiosk browser settings
- Disable sleep/screensaver in device settings
- Use `xset` commands on Linux (see Raspberry Pi guide)

---

## Best Practices

1. **Always update `package_version`** when changing config - this triggers automatic cache refresh
2. **Use CDN-hosted assets** for better performance and reliability
3. **Test on target device** before full deployment
4. **Monitor storage usage** - cache can grow large with many assets
5. **Use kiosk browsers** for production deployments (not regular browsers)
6. **Implement remote monitoring** to detect player failures
7. **Schedule nightly reboots** to prevent memory leaks

---

## Quick Start Checklist

- [ ] Host player files on web server (GitHub Pages, Netlify, etc.)
- [ ] Host config.json in version-controlled repository
- [ ] Host media assets on CDN or reliable web hosting
- [ ] Test player URL in desktop browser first
- [ ] Deploy to target device using appropriate method
- [ ] Configure kiosk mode/auto-start
- [ ] Test cache clearing by updating `package_version`
- [ ] Monitor device for 24-48 hours

---

## Support

For issues or questions:
- Check browser console for errors
- Verify all URLs are accessible
- Test with minimal config first (single image/video)
- Review CORS and CSP settings

---

## Next Steps

1. Choose your target device (Fire TV, Android TV, Raspberry Pi)
2. Follow the deployment guide for that device
3. Host your player online (GitHub Pages recommended for testing)
4. Create your config.json with public asset URLs
5. Deploy and test!
