# DisplayX Editor - Iframe Embedding

The DisplayX config editor is a **free, open source, client-side tool** that can be embedded in any website via iframe. It has **no origin restrictions** and works like any other embeddable tool (text editors, calculators, color pickers).

## ⚠️ Security Philosophy

**This editor is a DUMB TOOL:**
- ✅ Anyone can embed it
- ✅ Anyone can send it configs
- ✅ No authentication
- ✅ No data storage
- ✅ Just generates JSON

**Your SERVER is the SMART GUARDIAN:**
- 🔒 Authenticates users
- 🔒 Validates all configs
- 🔒 Enforces permissions
- 🔒 Stores data securely

**The editor is NOT a security boundary.** Your server must validate everything.

## Quick Start

```html
<iframe
  id="displayx-editor"
  src="https://rupesh2k.github.io/DisplayX/editor/"
  width="100%"
  height="800px"
  allow="clipboard-write">
</iframe>
```

That's it! No API keys, no origin restrictions, no configuration needed.

## PostMessage API

### Messages Received (from parent → editor)

#### LOAD_CONFIG
Load a configuration into the editor.

```javascript
iframe.contentWindow.postMessage({
  type: 'LOAD_CONFIG',
  config: {
    version: "1.0",
    package_version: "2026-04-17T00:00:00Z",
    settings: { cache_size_gb: 5, poll_interval_sec: 300 },
    assets: [...],
    schedule: [...],
    fallback: { asset_id: "...", message: "..." }
  }
}, '*');
```

### Messages Sent (from editor → parent)

#### EDITOR_READY
Sent when the editor is fully loaded and ready to receive messages.

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'EDITOR_READY') {
    console.log('Editor is ready!');
    // Now you can send LOAD_CONFIG
  }
});
```

#### CONFIG_UPDATED
Sent whenever the user makes changes to the configuration (add/edit/delete assets, schedule blocks, or settings).

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'CONFIG_UPDATED') {
    const config = event.data.config;
    console.log('Config updated:', config);
    // Save to your backend, update preview, etc.
  }
});
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Dashboard</title>
</head>
<body>
  <h1>Device Configuration</h1>

  <iframe
    id="displayx-editor"
    src="https://rupesh2k.github.io/DisplayX/editor/"
    width="100%"
    height="800px"
    allow="clipboard-write">
  </iframe>

  <script>
    const iframe = document.getElementById('displayx-editor');
    let editorReady = false;

    // Listen for messages from editor
    window.addEventListener('message', (event) => {
      // Security: In production, validate event.origin
      // if (event.origin !== 'https://rupesh2k.github.io') return;

      const { type, config } = event.data;

      if (type === 'EDITOR_READY') {
        editorReady = true;
        console.log('Editor ready');

        // Load existing config from your backend
        loadConfigFromBackend();
      }
      else if (type === 'CONFIG_UPDATED') {
        console.log('Config updated:', config);

        // Save to your backend
        saveConfigToBackend(config);
      }
    });

    // Load config from your backend
    async function loadConfigFromBackend() {
      const response = await fetch('/api/devices/123/config');
      const config = await response.json();

      // Send to editor
      iframe.contentWindow.postMessage({
        type: 'LOAD_CONFIG',
        config: config
      }, '*');
    }

    // Save config to your backend
    async function saveConfigToBackend(config) {
      await fetch('/api/devices/123/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_json: config })
      });
      console.log('Config saved to backend');
    }
  </script>
</body>
</html>
```

## Security Model 🔓

### The Editor Has NO Security

The editor is intentionally designed as an **open, permissionless tool**:

- ✅ **No origin restrictions** - Any website can embed it
- ✅ **No authentication** - No login, no API keys
- ✅ **No authorization** - Anyone can manipulate configs
- ✅ **No secrets** - All code is public, inspectable, forkable

### Basic Protections (Anti-Footgun)

The editor includes only these minimal protections:

1. **URL Sanitization** - Blocks `javascript:`, `file:`, etc. to prevent XSS
2. **Config Validation** - Checks structure to prevent crashes
3. **Rate Limiting** - Debounces messages to prevent DoS

These are **quality-of-life features**, not security boundaries.

### Where Security Actually Lives: YOUR SERVER

**Your backend MUST do this:**

```javascript
app.put('/devices/:id/config', authenticateJWT, async (req, res) => {
  // 1. Authenticate: Is this a logged-in user?
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // 2. Authorize: Can this user edit this device?
  const device = await Device.findById(req.params.id);
  if (device.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your device' });
  }

  // 3. Validate: Is this config valid?
  const config = req.body.config_json;
  if (!validateConfigSchema(config)) {
    return res.status(400).json({ error: 'Invalid config structure' });
  }

  // 4. Sanitize: Strip dangerous content
  const sanitized = sanitizeConfig(config);

  // 5. Save
  await saveConfig(req.params.id, sanitized);
  res.json({ success: true });
});
```

**The editor is just a fancy JSON builder.** Treat configs from it like any user input: never trust, always validate.

### Optional: iframe Sandbox Attribute

Use the `sandbox` attribute for additional security:

```html
<iframe
  src="https://rupesh2k.github.io/DisplayX/editor/?parentOrigin=https://yourdomain.com"
  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups">
</iframe>
```

This prevents:
- Top-level navigation
- Downloads without user interaction
- Access to parent cookies (unless same-origin)

### Content Security Policy

If your site has CSP headers, ensure you allow framing from your origin:

```
Content-Security-Policy: frame-src https://rupesh2k.github.io; frame-ancestors 'self'
```

The DisplayX editor is hosted on GitHub Pages and allows all origins for compatibility.

### Production Recommendations

1. **Fork the repository** and host your own editor instance
2. **Modify `allowedOrigins`** in `js/editor.js` to only your domains
3. **Add authentication** - Verify user sessions before loading configs
4. **Use HTTPS only** - Never embed over HTTP
5. **Monitor postMessage traffic** - Log suspicious activity
6. **Implement CSP** - Restrict what the iframe can do
7. **Rate limit config updates** - Prevent abuse

## Testing Locally

Use the included test page to verify iframe embedding:

```bash
# Start local server
python3 -m http.server 8080

# Open test page
http://localhost:8080/editor-embed-test.html
```

The test page demonstrates:
- Loading configurations into the editor
- Receiving config updates
- Message logging
- Two-way communication

## Features When Embedded

- ✅ Full editor functionality (add/edit/delete assets, schedules, settings)
- ✅ Real-time config updates sent to parent
- ✅ Visual "Embedded Mode" badge
- ✅ Import/Export still available
- ✅ File uploads work (converts to data URLs)
- ✅ Form validation
- ✅ Responsive design

## Use Cases

1. **Device Management Dashboard**: Embed in DisplayX-Server dashboard for inline config editing
2. **SaaS Platforms**: White-label config editor for your digital signage service
3. **CMS Integration**: Add to WordPress/Drupal plugins
4. **Internal Tools**: Embed in admin panels for easy content management

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires:
- postMessage API
- ES6 modules
- IndexedDB (for editor features)

## Troubleshooting

### Editor not loading
- Check browser console for errors
- Verify iframe src URL is correct
- Check CSP headers aren't blocking the iframe

### Messages not received
- Ensure you're listening for 'message' event before iframe loads
- Verify origin validation isn't blocking messages
- Check browser console for postMessage errors

### Config not updating
- Wait for EDITOR_READY before sending LOAD_CONFIG
- Verify config JSON is valid (use editor's validate button)
- Check config structure matches DisplayX schema

## Example: React Integration

```jsx
import { useEffect, useRef, useState } from 'react';

function ConfigEditor({ deviceId, initialConfig }) {
  const iframeRef = useRef(null);
  const [editorReady, setEditorReady] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(initialConfig);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://rupesh2k.github.io') return;

      const { type, config } = event.data;

      if (type === 'EDITOR_READY') {
        setEditorReady(true);
        // Load initial config
        iframeRef.current.contentWindow.postMessage({
          type: 'LOAD_CONFIG',
          config: initialConfig
        }, '*');
      }
      else if (type === 'CONFIG_UPDATED') {
        setCurrentConfig(config);
        // Auto-save to backend
        saveConfig(deviceId, config);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [deviceId, initialConfig]);

  return (
    <div>
      <p>Editor Status: {editorReady ? 'Ready' : 'Loading...'}</p>
      <iframe
        ref={iframeRef}
        src="https://rupesh2k.github.io/DisplayX/editor/"
        width="100%"
        height="800px"
        allow="clipboard-write"
      />
    </div>
  );
}
```

## License

The DisplayX editor is MIT licensed and free to embed in any project.
