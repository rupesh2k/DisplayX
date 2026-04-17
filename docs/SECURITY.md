# Security Considerations - DisplayX Editor Embedding

## Overview

The DisplayX editor uses postMessage for iframe communication. While this enables powerful integration, it also introduces security considerations that must be understood.

## Threat Model

### What the Editor Protects Against ✅

1. **Origin Spoofing** - Whitelist validation prevents unauthorized origins
2. **XSS via URLs** - URL sanitization blocks `javascript:`, `file:`, and other dangerous schemes
3. **Message Flooding** - Rate limiting prevents DoS attacks
4. **Arbitrary Data Injection** - Config structure validation

### What the Editor Does NOT Protect Against ⚠️

1. **Authentication** - No user session validation
2. **Authorization** - Anyone embedding the iframe can modify configs
3. **Data Confidentiality** - Config data is visible to the embedding page
4. **CSRF** - No tokens or request signing
5. **Malicious Embedders** - If an attacker controls the parent page, they control the editor

## Security Posture by Use Case

### ✅ Safe: Internal Dashboard (Same Origin)

**Scenario**: DisplayX-Server dashboard embeds editor at `https://yourdomain.com/dashboard`

**Risk**: **LOW**
- Both iframe and parent on same domain
- User already authenticated to parent app
- Same-origin policy provides strong isolation

**Recommended**:
```html
<iframe src="https://rupesh2k.github.io/DisplayX/editor/?parentOrigin=https://yourdomain.com"></iframe>
```

### ⚠️ Moderate Risk: Authenticated External Embedding

**Scenario**: SaaS platform embeds editor for authenticated users

**Risk**: **MEDIUM**
- Cross-origin communication
- User authenticated to parent but not to iframe
- Configs could contain sensitive data

**Mitigations**:
1. Add authentication layer before loading configs
2. Validate user has permission to edit device
3. Log all config changes for audit
4. Use HTTPS only
5. Implement CSP headers

### 🔴 High Risk: Public/Unauthenticated Embedding

**Scenario**: Public website allows anyone to embed editor

**Risk**: **HIGH**
- No authentication
- Anyone can modify configs
- Potential for abuse

**NOT RECOMMENDED** - But if you must:
1. Fork repo and host your own instance
2. Restrict `allowedOrigins` to only your domain
3. Add rate limiting at network level
4. Implement CAPTCHA or proof-of-work
5. Sanitize and validate all outputs server-side

## Specific Vulnerabilities

### 1. Origin Whitelist Bypass

**Current Whitelist** (in `js/editor.js`):
```javascript
this.allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:3000',
  'https://rupesh2k.github.io'
];
```

**Risk**: Default whitelist is permissive for development

**Mitigation**: Fork repo and customize whitelist for production

### 2. Data URI XSS

**Risk**: Malicious data URIs could contain scripts

**Current Protection**:
- Only allows `data:image/` and `data:video/` URLs
- Blocks `data:text/html` and others

**Residual Risk**: SVG data URIs can contain scripts

**Mitigation**: Server-side validation should strip SVG `<script>` tags

### 3. Config Data Exposure

**Risk**: Embedding page can read all config data via `CONFIG_UPDATED` messages

**Impact**: Sensitive URLs, asset IDs, schedule data visible to parent

**Mitigation**: Don't store secrets in configs (API keys, tokens, passwords)

### 4. No Request Signing

**Risk**: No way to verify config changes came from legitimate user

**Impact**: If attacker hijacks parent page, they can manipulate configs

**Mitigation**: Server-side validation - authenticate user before saving configs

## Best Practices for Production

### For DisplayX-Server (or similar platforms):

1. **Authentication Required**
   ```javascript
   // Before loading config into editor
   const user = await authenticateUser();
   if (!user.hasPermission('edit_device', deviceId)) {
     throw new Error('Unauthorized');
   }
   ```

2. **Server-Side Validation**
   ```javascript
   // When saving config from editor
   app.put('/devices/:id/config', authenticateJWT, async (req, res) => {
     const config = req.body.config_json;

     // Validate structure
     if (!validateConfigSchema(config)) {
       return res.status(400).json({ error: 'Invalid config' });
     }

     // Sanitize URLs
     config.assets.forEach(asset => {
       asset.url = sanitizeUrl(asset.url);
     });

     // Save
     await saveConfig(req.params.id, config);
     res.json({ success: true });
   });
   ```

3. **Audit Logging**
   ```javascript
   await logAudit({
     user: req.user.id,
     action: 'config_update',
     device: deviceId,
     timestamp: new Date(),
     changes: diff(oldConfig, newConfig)
   });
   ```

4. **CSP Headers**
   ```javascript
   app.use((req, res, next) => {
     res.setHeader('Content-Security-Policy',
       "frame-src https://rupesh2k.github.io; frame-ancestors 'self'"
     );
     next();
   });
   ```

5. **Use parentOrigin Parameter**
   ```html
   <iframe src="https://rupesh2k.github.io/DisplayX/editor/?parentOrigin=https://yourdomain.com"></iframe>
   ```

## Self-Hosting (Highest Security)

For maximum security, fork and host your own editor:

```bash
# 1. Fork repository
git clone git@github.com:yourusername/DisplayX.git

# 2. Customize allowedOrigins in js/editor.js
this.allowedOrigins = [
  'https://yourdomain.com',
  'https://dashboard.yourdomain.com'
];

# 3. Deploy to your infrastructure
# - Use your own domain
# - Add authentication at CDN/proxy layer
# - Implement custom security policies
```

## Security Checklist

Before deploying to production:

- [ ] Fork repo and customize `allowedOrigins`
- [ ] Use `parentOrigin` URL parameter
- [ ] Implement authentication in parent app
- [ ] Add server-side config validation
- [ ] Enable audit logging
- [ ] Set CSP headers
- [ ] Use HTTPS only (no mixed content)
- [ ] Rate limit API endpoints
- [ ] Monitor for suspicious activity
- [ ] Have incident response plan
- [ ] Regular security reviews
- [ ] Keep dependencies updated

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email: security@yourdomain.com (or create private advisory)
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Conclusion

The iframe embedding approach is **suitable for internal dashboards and authenticated platforms** with proper security measures. It is **NOT suitable for unauthenticated public access** without significant additional security layers.

**Default stance**: Treat the editor as a trusted component within an authenticated system boundary, not as a public-facing interface.
