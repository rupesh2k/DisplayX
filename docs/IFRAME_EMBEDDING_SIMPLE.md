# DisplayX Editor - Iframe Embedding (Simple Guide)

The DisplayX config editor is a **free, open, client-side tool**. Embed it anywhere, no restrictions.

## Quick Start

```html
<iframe
  src="https://rupesh2k.github.io/DisplayX/editor/"
  width="100%"
  height="800px">
</iframe>
```

## Security Model 🔓

### The Editor: "Dumb Tool"

- ✅ No authentication
- ✅ No authorization
- ✅ No origin checks
- ✅ Anyone can embed it
- ✅ Anyone can send it data

**Think of it like:** A text editor, calculator, or color picker. It's just a UI that generates JSON.

### Your Server: "Smart Guardian"

**Your backend MUST:**

```javascript
app.put('/api/devices/:id/config', authenticateJWT, async (req, res) => {
  // 1. Check user is logged in
  if (!req.user) return res.status(401).json({ error: 'Login required' });

  // 2. Check user owns this device
  if (!await userOwnsDevice(req.user.id, req.params.id)) {
    return res.status(403).json({ error: 'Not your device' });
  }

  // 3. Validate config structure
  if (!isValidConfig(req.body.config_json)) {
    return res.status(400).json({ error: 'Invalid config' });
  }

  // 4. Save
  await saveConfig(req.params.id, req.body.config_json);
  res.json({ success: true });
});
```

**Security lives on your server, not in the editor.**

## PostMessage API

### Messages You Send (Parent → Editor)

**LOAD_CONFIG** - Load a configuration

```javascript
iframe.contentWindow.postMessage({
  type: 'LOAD_CONFIG',
  config: { version: "1.0", assets: [...], schedule: [...] }
}, '*');
```

### Messages You Receive (Editor → Parent)

**EDITOR_READY** - Editor loaded and ready

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'EDITOR_READY') {
    console.log('Editor is ready!');
    // Now you can send LOAD_CONFIG
  }
});
```

**CONFIG_UPDATED** - User made changes

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'CONFIG_UPDATED') {
    const config = event.data.config;
    // Save to your backend
    await saveConfig(config);
  }
});
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<body>
  <iframe id="editor" src="https://rupesh2k.github.io/DisplayX/editor/" width="100%" height="800px"></iframe>

  <script>
    const iframe = document.getElementById('editor');

    // Listen for messages from editor
    window.addEventListener('message', async (event) => {
      if (event.data.type === 'EDITOR_READY') {
        // Load existing config
        const response = await fetch('/api/devices/123/config');
        const config = await response.json();

        iframe.contentWindow.postMessage({
          type: 'LOAD_CONFIG',
          config: config
        }, '*');
      }

      if (event.data.type === 'CONFIG_UPDATED') {
        // Auto-save to backend
        await fetch('/api/devices/123/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config_json: event.data.config })
        });
      }
    });
  </script>
</body>
</html>
```

## What the Editor Validates (Barely Anything)

The editor only checks:

1. **Config structure** - Has required fields (version, assets, schedule)
2. **URL schemes** - Blocks `javascript:`, `file:`, `data:text/html`
3. **Rate limits** - Won't spam messages (500ms debounce)

Everything else is YOUR responsibility.

## Common Mistakes ❌

### ❌ DON'T: Trust the editor for security

```javascript
// BAD - Anyone can send fake configs
window.addEventListener('message', (event) => {
  saveConfigDirectlyToDatabase(event.data.config); // 💥
});
```

### ✅ DO: Validate on your server

```javascript
// GOOD - Server validates everything
window.addEventListener('message', async (event) => {
  // Let the server validate
  const response = await fetch('/api/config', {
    method: 'POST',
    body: JSON.stringify(event.data.config)
  });

  if (!response.ok) {
    alert('Invalid config rejected by server');
  }
});
```

### ❌ DON'T: Store secrets in configs

```javascript
// BAD - Configs are visible to embedding page
{
  "assets": [{
    "url": "https://api.example.com/video?api_key=SECRET123" // 💥
  }]
}
```

### ✅ DO: Use signed URLs or proxy requests

```javascript
// GOOD - Server generates temporary signed URLs
const signedUrl = await fetch('/api/sign-url', {
  method: 'POST',
  body: JSON.stringify({ asset_id: 'video1' })
});
```

## Testing Locally

```bash
# Open the test page
http://localhost:8080/editor-embed-test.html

# Or create your own test
python3 -m http.server 8080
open http://localhost:8080/editor/
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT - Free to use anywhere, commercial or personal.

---

**TL;DR**: The editor is just a fancy form. Your server is the security boundary. Never trust client data.
