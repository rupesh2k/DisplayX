# GitHub Pages Deployment Guide

This guide shows you how to deploy DisplayX to GitHub Pages for free hosting.

## Overview

GitHub Pages will host your DisplayX player at:
```
https://YOUR-USERNAME.github.io/DisplayX/player.html?config=CONFIG_URL
```

**Benefits:**
- ✅ **Free hosting** - No cost
- ✅ **HTTPS** - Secure by default
- ✅ **CDN** - Fast global delivery
- ✅ **Auto-deploy** - Push to main = automatic deployment
- ✅ **Custom domains** - Optional

---

## Step 1: Push Code to GitHub

If you haven't already, push your DisplayX code to GitHub:

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: DisplayX player"

# Create repository on GitHub (go to github.com/new)
# Then connect and push:
git remote add origin https://github.com/YOUR-USERNAME/DisplayX.git
git branch -M main
git push -u origin main
```

---

## Step 2: Enable GitHub Pages

1. **Go to your repository** on GitHub
   ```
   https://github.com/YOUR-USERNAME/DisplayX
   ```

2. **Click Settings** (top right)

3. **Click Pages** (left sidebar)

4. **Under "Build and deployment":**
   - Source: **GitHub Actions**

5. **Save**

That's it! The GitHub Actions workflow will automatically deploy your site.

---

## Step 3: Wait for Deployment

1. **Go to Actions tab** in your repository
   ```
   https://github.com/YOUR-USERNAME/DisplayX/actions
   ```

2. **Watch the "Deploy to GitHub Pages" workflow**
   - It should start automatically after enabling Pages
   - Wait for green checkmark (usually 1-2 minutes)

3. **Your site is live!**
   ```
   https://YOUR-USERNAME.github.io/DisplayX/player.html
   ```

---

## Step 4: Access Your Player

Your player is now available at:

```
https://YOUR-USERNAME.github.io/DisplayX/player.html?config=CONFIG_URL
```

**Example with config:**
```
https://rupesh2k.github.io/DisplayX/player.html?config=https://raw.githubusercontent.com/rupesh2k/DigitalSignageContent/main/config.json
```

---

## Configuration Management

### Option A: Separate Config Repository (Recommended)

Keep your config and assets in a separate repository:

**DisplayX Repository:**
- Player code (this repo)
- Hosted at: `https://YOUR-USERNAME.github.io/DisplayX/`

**Content Repository:**
- Config.json
- Media assets (if small)
- Hosted at: `https://raw.githubusercontent.com/YOUR-USERNAME/signage-content/main/config.json`

**Benefits:**
- Update content without redeploying player
- Separate access control
- Keep content changes separate from code changes

### Option B: Same Repository

Put config in the same repo:

```
DisplayX/
  ├── player.html
  ├── js/
  ├── css/
  └── configs/
      └── production.json
```

Access at:
```
https://YOUR-USERNAME.github.io/DisplayX/configs/production.json
```

---

## Automatic Deployments

Every time you push to the `main` branch, GitHub Actions automatically:

1. Detects the push
2. Runs the deploy workflow
3. Updates your site (1-2 minutes)

**No manual steps needed!**

### Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** tab
2. Click **Deploy to GitHub Pages**
3. Click **Run workflow**
4. Select branch: `main`
5. Click **Run workflow**

---

## Testing Your Deployment

### Test 1: Check Player Loads

```
https://YOUR-USERNAME.github.io/DisplayX/player.html
```

**Expected:** You should see an error screen saying "Missing config URL parameter"

### Test 2: Check Health Endpoint

```
https://YOUR-USERNAME.github.io/DisplayX/health.json
```

**Expected:** `{"status":"ok","service":"DisplayX"}`

### Test 3: Full Player with Config

```
https://YOUR-USERNAME.github.io/DisplayX/player.html?config=YOUR_CONFIG_URL
```

**Expected:** Player loads, caches assets, and starts playback

---

## Custom Domain (Optional)

You can use your own domain instead of `github.io`:

### Step 1: Configure DNS

Add a CNAME record pointing to:
```
YOUR-USERNAME.github.io
```

### Step 2: Configure GitHub Pages

1. Go to **Settings → Pages**
2. Under **Custom domain**, enter: `displayx.yourdomain.com`
3. Click **Save**
4. Wait for DNS check (green checkmark)
5. ✅ Enable **Enforce HTTPS**

Your player is now at:
```
https://displayx.yourdomain.com/player.html?config=...
```

---

## Update Workflow

### Updating Player Code

1. Make changes to HTML/CSS/JS locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update player UI"
   git push
   ```
3. GitHub Actions auto-deploys (1-2 minutes)
4. Changes live at your GitHub Pages URL

### Updating Content

If using separate config repo:

1. Edit `config.json` in your content repository
2. Update `package_version` to current timestamp
3. Commit and push
4. Players auto-detect change and refresh cache

**No need to redeploy the player!**

---

## Troubleshooting

### "404 Not Found" Error

**Problem:** Site shows 404

**Solutions:**
- Check GitHub Pages is enabled (Settings → Pages)
- Verify deployment succeeded (Actions tab)
- Wait 1-2 minutes after first push
- Check repository is public (or you have GitHub Pro for private repos)

### "Deployment Failed" in Actions

**Problem:** Workflow fails with permissions error

**Solutions:**
1. Go to **Settings → Actions → General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Click **Save**
5. Re-run the workflow

### Player Shows "Failed to Fetch" Config

**Problem:** Config URL returns 404 or CORS error

**Solutions:**
- Verify config URL is correct (test in browser)
- Use GitHub raw URLs: `https://raw.githubusercontent.com/...`
- Check config repository is public
- Verify file name and path are correct

### Assets Not Loading

**Problem:** Images/videos fail to load

**Solutions:**
- Check asset URLs are direct/public
- Use GitHub raw URLs for assets in GitHub repos
- Verify CORS headers (GitHub raw URLs have proper CORS)
- Check browser console for errors (F12)

### Changes Not Appearing

**Problem:** Updates don't show on site

**Solutions:**
- Check Actions tab - deployment succeeded?
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear browser cache
- Wait a few minutes - CDN caching delay
- Try incognito/private browsing mode

---

## GitHub Pages Limits

**Aware of these soft limits:**

- **Bandwidth:** 100 GB/month (soft limit)
- **Storage:** 1 GB repository size (recommended)
- **Build time:** 10 minutes max
- **Sites:** Unlimited

**For DisplayX:**
- ✅ Player files are tiny (<1 MB)
- ✅ Bandwidth rarely an issue (static files)
- ✅ Host media on CDN (not in repo)
- ✅ Perfect fit for GitHub Pages limits

---

## Best Practices

### 1. Separate Player from Content

**Player Repository:** Code only
```
https://github.com/rupesh2k/DisplayX
```

**Content Repository:** Config + assets
```
https://github.com/rupesh2k/DigitalSignageContent
```

### 2. Use Raw URLs for Configs

Always use raw GitHub URLs:
```
✅ https://raw.githubusercontent.com/user/repo/main/config.json
❌ https://github.com/user/repo/blob/main/config.json
```

### 3. Version Your Configs

Include version in config:
```json
{
  "package_version": "2026-03-27T15:00:00Z",
  "comment": "Updated promo video"
}
```

### 4. Don't Store Large Assets in Repo

**Don't do this:**
```
DisplayX/
  ├── assets/
  │   ├── video1.mp4  ❌ (50 MB)
  │   └── video2.mp4  ❌ (100 MB)
```

**Do this instead:**
- Upload videos to CDN (Cloudinary, Imgur, etc.)
- Reference URLs in config
- Keep repo lightweight

### 5. Monitor Your Deployment

Set up notifications:
1. **Watch your repository** (top right)
2. Enable **Actions** notifications
3. Get email on failed deployments

---

## Production Checklist

Before going live with devices:

- [ ] GitHub Pages enabled and deployed successfully
- [ ] Player loads at your GitHub Pages URL
- [ ] Config URL is correct and accessible
- [ ] All assets load correctly (test in browser)
- [ ] Cache clearing works (update package_version)
- [ ] Tested with actual config on actual device
- [ ] Set up separate content repository (optional)
- [ ] Custom domain configured (optional)
- [ ] Actions notifications enabled

---

## Example URLs

**Replace with your actual username/repo names:**

| Purpose | URL Template |
|---------|-------------|
| Player | `https://YOUR-USERNAME.github.io/DisplayX/player.html` |
| With Config | `https://YOUR-USERNAME.github.io/DisplayX/player.html?config=CONFIG_URL` |
| Clear Cache | `https://YOUR-USERNAME.github.io/DisplayX/player.html?config=CONFIG_URL&clear-cache=true` |
| Health Check | `https://YOUR-USERNAME.github.io/DisplayX/health.json` |
| Config (raw) | `https://raw.githubusercontent.com/YOUR-USERNAME/content-repo/main/config.json` |

---

## Quick Start Summary

```bash
# 1. Push code to GitHub
git add .
git commit -m "Deploy DisplayX"
git push

# 2. Enable GitHub Pages
# Go to Settings → Pages → Source: GitHub Actions

# 3. Wait for deployment (check Actions tab)

# 4. Access your player
# https://YOUR-USERNAME.github.io/DisplayX/player.html?config=...
```

That's it! Your DisplayX player is now live and globally accessible. 🚀

---

## Next Steps

1. **Create content repository** for configs
2. **Upload your config.json** with public asset URLs
3. **Test on actual device** (Fire TV, Raspberry Pi, etc.)
4. **Set up monitoring** (optional)
5. **Configure custom domain** (optional)

---

## Support

**Deployment Issues:**
- Check Actions tab for build logs
- Verify GitHub Pages is enabled
- Check repository permissions

**Runtime Issues:**
- Open browser console (F12)
- Check config URL is accessible
- Verify asset URLs work

**Questions:**
- Check DEPLOYMENT-GUIDE.md for device setup
- Check CACHE-MANAGEMENT.md for cache issues
- Open GitHub issue in your repository
