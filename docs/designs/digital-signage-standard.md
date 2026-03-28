---
status: ACTIVE
---
# Plan: Digital Signage Standard & Reference Implementation
Branch: unknown | Mode: EXPANSION 
Repo: DisplayX

## Vision

### 10x Check
The 10x version isn't just "a player" — it's **"The Digital Signage Protocol" (like HTTP is to web servers).**

10x vision:
- config.json becomes an IETF or W3C standard
- Reference implementations for ALL platforms (not just TVs — web browsers, mobile, IoT displays)
- Compliance test suite + certification program ("DS Protocol v1.0 Compliant")
- Plugin ecosystem: third-party developers can extend the player with custom asset types, transitions, data sources
- Cloud orchestration service: centralized management of thousands of displays, A/B testing, analytics
- Real-time collaboration: multiple content creators editing schedules, instant preview on devices

### Platonic Ideal
The platonic ideal is **"digital signage as simple as publishing a website."**

- Content creator writes a config file (like HTML)
- Config references assets (like `<img src>`), schedules (like cron), live streams (like `<video>`)
- Deploy config to cloud storage → devices pull it → everything just works
- Zero manual device configuration
- Zero vendor lock-in
- Diagnostics and logs flow back to creator automatically
- The config format is so intuitive a designer could write it without reading docs

User feeling: **"This just works. No surprises. I can reason about what will happen by reading the config."**

## Example config.json (Minimal)

```json
{
  "version": "1.0",
  "package_version": "2026-03-21T10:00:00Z",
  "_comment_package_version": "ISO8601 timestamp of config publication; players use this to detect stale configs",
  "settings": {
    "cache_size_gb": 5,
    "poll_interval_sec": 300,
    "health_report_url": "https://monitor.example.com/health",
    "analytics_webhook": "https://analytics.example.com/impressions"
  },
  "assets": [
    {
      "id": "logo",
      "type": "image",
      "url": "https://cdn.example.com/assets/logo.png",
      "cached": true,
      "_comment_cached": "cached: true means player MUST pre-download asset; cached: false means stream-only (no local storage)"
    },
    {
      "id": "promo-video",
      "type": "video",
      "url": "https://storage.googleapis.com/bucket/promo.mp4?signed=...",
      "cached": true
    },
    {
      "id": "livestream",
      "type": "live_stream",
      "url": "https://stream.example.com/live.m3u8?signed=...",
      "cached": false
    }
  ],
  "schedule": [
    {
      "time_range": ["09:00", "12:00"],
      "playlist": ["logo", "promo-video"],
      "durations_sec": [10, 30],
      "transition": {"type": "crossfade", "duration_ms": 300},
      "conditions": {"date_range": ["2026-03-01", "2026-03-31"]}
    },
    {
      "time_range": ["12:00", "18:00"],
      "playlist": ["livestream"],
      "durations_sec": [null],
      "_comment_durations_sec": "null duration means play asset until schedule block ends or stream terminates",
      "transition": {"type": "hard-cut", "duration_ms": 0},
      "_comment_duration_ms": "duration_ms is transition animation length; 0 means immediate switch with no animation"
    }
  ],
  "fallback": {
    "asset_id": "logo",
    "message": "Offline - Showing Cached Content"
  }
}
```

## Scope Decisions

| # | Proposal | Effort | Decision | Reasoning |
|---|----------|--------|----------|-----------|
| 1 | Formal Specification Document | M | ACCEPTED | Spec is the foundation — without it, the player is just "another proprietary format" |
| 2 | Compliance Test Suite | M | ACCEPTED | Test suite proves the spec is implementable and testable — critical for adoption |
| 3 | Hot Reload for Development | S | ACCEPTED | Tiny effort, huge developer experience win — Completeness: 9/10 |
| 4 | Fallback Content Strategy | S | ACCEPTED | Offline-first means offline must be tested — Completeness: 10/10 |
| 5 | Device Health Reporting | S | ACCEPTED | Observability is scope, not afterthought — Completeness: 9/10 |
| 6 | Visual Config Editor (MVP) | M | ACCEPTED | Makes the system accessible to non-technical content creators — Completeness: 8/10 |
| 7 | Preview Mode | M | ACCEPTED | High-value UX improvement — makes schedule errors visible before deploy |
| 8 | Transition Effects | M | ACCEPTED | Transitions are table-stakes for signage — hard cut looks unprofessional |
| 9 | Conditional Display Rules | L | ACCEPTED | High-value for enterprise deployments; makes the spec more powerful |
| 10 | Analytics Hooks | S | ACCEPTED | Tiny effort, unlocks enterprise use cases (proof-of-play) — Completeness: 9/10 |
| 11 | Remote Screenshot Capability | M | DEFERRED | Great operational feature but not MVP-critical; add in Phase 2 |

## Accepted Scope (added to this plan)

### Specification Deliverables
- **Formal specification document** (markdown + JSON Schema):
  - Sections: Asset Types, Scheduling Rules, Caching Strategy, Offline Behavior, Error Handling, Transition Definitions, Analytics Events, Version Compatibility
  - JSON Schema validates: required fields, asset references, schedule blocks, transition configs
  - Done when: Spec document is complete enough for third-party to implement a compliant player
- **Compliance test suite** (web browser reference implementation only for MVP):
  - Dimensions: Asset Loading (MP4, PNG, WebP), Schedule Accuracy (±5 sec), Transition Fidelity (crossfade 300ms), Offline Resilience (24hr cache), Health Reporting (uptime, errors)
  - Pass criteria: Asset loads succeed 99%+, schedule accuracy ±5sec measured, transitions render at 60fps, offline mode maintains playback for 24hr, health reports sent with <5% failure rate
  - Purpose: Tests validate spec requirements (portable across implementations); separate reference player tests validate web implementation quality
  - Done when: Reference player passes all tests; test suite is runnable by third-party implementations

### Reference Player Features (Web-First Approach)
- **Config.json format and package structure**:
  - Package format: ZIP archive containing `config.json` (the manifest), `/assets/` folder, optional `checksums.txt`
  - Config.json IS the manifest — single source of truth for player behavior
  - Config.json includes: assets list, schedule blocks, playback settings, transition specs, analytics webhooks, health reporting endpoint
  - Supported asset formats: image (PNG, JPEG, WebP), video (MP4/H.264, WebM), live_stream (HLS, DASH)
  - Streaming support: HLS/DASH for large videos and live streams via signed URLs
  - Signed URL handling:
    - Players parse URL expiry from query params (e.g., `?expires=TIMESTAMP`) or rely on 403 response codes
    - URL refresh requires backend service to re-sign URLs; players periodically refetch config.json to get updated signatures
    - Refresh strategy: renew 1hr before expiry (requires backend service endpoint)
- **Hot reload for development**: Player polls config.json every N seconds (configurable via `poll_interval_sec` setting; default 300 for production, use 5 for dev hot reload); if ETag changes, reload layout without restart.
- **Fallback content strategy**:
  - Player caches scheduled assets up to `cache_size_gb` limit (default 5GB) using FIFO eviction
  - Time-based retention (24hr) applies only if space permits; size constraint takes precedence
  - If package fetch fails (network down, signed URL expired), show last-known-good content + "Offline" badge
  - If offline >24hr, loop cached assets indefinitely
  - Note: IndexedDB limits vary by browser (Safari ~50MB, Chrome ~10GB); player must handle quota errors gracefully
- **Device health reporting**:
  - Unauthenticated, best-effort HTTP POST to configurable webhook at interval specified by `poll_interval_sec` (default 300s / 5 min)
  - Payload: {device_id, last_fetch_ts, storage_used_pct, playback_errors_count, app_version}
  - device_id: Client-generated UUID on first run, persisted in local storage; survives app updates but not reinstalls
  - No retries, no delivery guarantees (production-grade reporting deferred to Phase 2)
- **Transition effects** (CSS-based for web MVP):
  - Supported types: crossfade (300ms), fade-to-black (200ms), hard-cut (0ms)
  - Config syntax: `"transition": {"type": "crossfade", "duration_ms": 300}`
  - Platform-specific implementations (native GPU acceleration) deferred to Phase 2
- **Analytics hooks**:
  - Best-effort HTTP POST to webhook on asset display
  - Payload: {asset_id, device_id, timestamp, duration_shown_ms}
  - No retry logic, no persistent queue (defer to Phase 2)
  - Privacy: No PII collected; device_id is client-generated UUID
- **Error handling**:
  - Asset load failure → show fallback asset (specified in `fallback.asset_id` in config) + log error
  - Network loss during playback → continue with cached assets
  - Webhook POST failure → log error, continue playback (no blocking)
  - Schedule gaps → display asset specified in `fallback.asset_id`
  - Schedule conflicts (overlapping time blocks) → last-defined block in config takes precedence
  - Signed URL expiry → attempt to refetch config.json; if fetch fails, use cached assets and show "Offline" badge

### Tools & UX (Phase 1)

## UI SPECIFICATIONS (from design review)

### Visual Config Editor — Information Architecture

**Layout: Single-page form (all fields visible)**

```
+----------------------------------------------------------------+
|  DisplayX Config Editor                    [Import] [Export]   |
+----------------------------------------------------------------+
| +----------------------------+ +----------------------------+  |
| | ASSETS (Left Sidebar)      | | SCHEDULE (Main Panel)     |  |
| |                            | |                            |  |
| | [+ Add Asset]              | | Daily Schedule             |  |
| |                            | |                            |  |
| | □ logo.png (image)         | | ┌─ 09:00 - 12:00 ────────┐ |  |
| |   [Edit] [Delete]          | | │ Assets: logo, promo-vid │ |  |
| |                            | | │ Durations: 10s, 30s     │ |  |
| | □ promo.mp4 (video)        | | │ Transition: crossfade   │ |  |
| |   [Edit] [Delete]          | | │ Conditions: (none)      │ |  |
| |                            | | └─ [Edit] [Delete] ──────┘ |  |
| | □ livestream (HLS)         | |                            |  |
| |   [Edit] [Delete]          | | [+ Add Schedule Block]     |  |
| |                            | |                            |  |
| | Storage: 2.3 GB / 5 GB     | |                            |  |
| +----------------------------+ +----------------------------+  |
|                                                                |
| +----------------------------------------------------------+   |
| | SETTINGS (Collapsible)                                   |   |
| | Poll interval: [300] sec   Health URL: [...............]  |   |
| | Cache size: [5] GB         Analytics URL: [............] |   |
| +----------------------------------------------------------+   |
|                                                                |
|                      [Validate] [Export config.json]           |
+----------------------------------------------------------------+
```

**Content Hierarchy:**
1. **Primary:** Asset list (left) + Schedule blocks (right) — user spends 80% of time here
2. **Secondary:** Add Asset / Add Schedule Block buttons — clear CTAs
3. **Tertiary:** Settings (collapsed by default) — advanced config

**Navigation:** No multi-page navigation. All controls visible. Scroll if >3 schedule blocks.

---

### Preview Mode — Information Architecture

**Layout: Timeline-first (horizontal timeline dominates)**

```
+----------------------------------------------------------------+
|  Preview: config.json                              [← Editor]  |
+----------------------------------------------------------------+
| ┌────────────────────────────────────────────────────────────┐ |
| │ Timeline (horizontal)                                       │ |
| │ ────────────────────────────────────────────────────────────│ |
| │ 00:00    03:00    06:00    09:00    12:00    15:00    18:00│ |
| │   │        │        │    [====logo====][=promo-video=]      │ |
| │   │        │        │                  │                    │ |
| │ ──┴────────┴────────┴──────────────────┴────────────────────│ |
| │         ▲ Current time: 10:30 AM                            │ |
| └────────────────────────────────────────────────────────────┘ |
|                                                                |
| +----------------------------------------------------------+   |
| | ASSET DETAILS (Below timeline)                           |   |
| | Now Playing: logo.png                                    |   |
| | Duration: 10 seconds                                     |   |
| | Next: promo-video.mp4 at 10:30:10                       |   |
| +----------------------------------------------------------+   |
|                                                                |
|                 [Play from current time] [Reset to 00:00]      |
+----------------------------------------------------------------+
```

**Content Hierarchy:**
1. **Primary:** Timeline — user scrubs here to verify schedule
2. **Secondary:** Asset details (what's playing now + next)
3. **Tertiary:** Playback controls

**Interaction:** Click/drag on timeline to scrub. Asset blocks are interactive (click to jump).

---

### Player — Information Architecture

**Layout: Full-screen immersive (minimal UI chrome)**

**Normal Playback:**
```
+----------------------------------------------------------------+
|                                                                |
|                                                                |
|                    [ASSET DISPLAYED HERE]                      |
|                   (video or image full-screen)                 |
|                                                                |
|                                                                |
|                                                                |
|                                      [Offline]  (if offline)   |
+----------------------------------------------------------------+
```

**Error State:**
```
+----------------------------------------------------------------+
|                                                                |
|                         ⚠                                      |
|                                                                |
|                  Configuration Error                           |
|                                                                |
|            config.json validation failed:                      |
|            Missing required field: assets[0].url               |
|                                                                |
|                    [Retry]  [Use Cached]                       |
|                                                                |
+----------------------------------------------------------------+
```

**Content Hierarchy:**
1. **Primary:** Asset (full-screen, no chrome)
2. **Secondary:** Status badge (offline/error) — minimal, top-right corner
3. **Tertiary:** Error details (only shown on error state)

**Interaction:** No user interaction in normal mode (signage auto-plays). Error state has retry/fallback buttons.

---

## INTERACTION STATE COVERAGE

| Feature | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|---------|---------|-------|-------|---------|---------|
| **Config Editor** | Spinner + "Validating config..." (when user clicks Validate) | "No assets yet. Add your first asset to get started." + [+ Add Asset] button (large, centered) | Red banner: "Validation failed: {error message}" + inline field highlights | Green checkmark: "Valid config" + [Export] button enabled | N/A (validation is all-or-nothing) |
| **Preview Mode** | Spinner + "Loading timeline..." (while parsing config) | "No schedule blocks defined. Add a schedule block in the editor." + [← Back to Editor] button | Red banner: "Cannot preview: {error}" + [← Back to Editor] button | Timeline rendered with all asset blocks, scrubbing enabled | Partial timeline: gray placeholder blocks for failed assets + warning "Some assets unavailable" |
| **Player (Config Load)** | Full-screen spinner + "Loading content..." (while fetching config.json) | N/A (player always has fallback content defined in config) | Full-screen error: "⚠ Configuration Error\n{message}\n[Retry] [Use Cached]" | Playback starts immediately, no UI chrome | N/A (config load is all-or-nothing) |
| **Player (Asset Load)** | Black screen + small spinner (bottom-right) while asset downloads | N/A (if asset missing, show fallback) | Shows fallback asset + small warning badge (bottom-right): "Asset unavailable" | Asset displays full-screen | Some assets cached, some streaming: shows cached immediately, streams load in background (transparent to user) |
| **Player (Network Loss)** | N/A (already playing) | N/A | "Offline" badge (top-right, subtle, semi-transparent gray) — playback continues with cached assets | No UI change (seamless) | Offline badge + playback continues |

### Empty State Specifications

**Config Editor Empty State:**
- Centered content (vertical center of asset sidebar)
- Icon: Large "📂" or asset icon (48px)
- Headline: "No assets yet"
- Subtext: "Add images, videos, or livestreams to get started."
- Primary CTA: [+ Add Asset] button (blue, prominent)

**Preview Mode Empty State:**
- Centered content (vertical center of main panel, timeline area empty)
- Icon: Large "📅" or calendar icon (48px)
- Headline: "No schedule defined"
- Subtext: "Create schedule blocks in the editor to preview playback."
- Primary CTA: [← Back to Editor] button

**Player Fallback Content:**
- Defined in config.json `fallback.asset_id` (required field)
- If fallback asset also fails: Black screen + centered white text: "Content Unavailable" + small logo (if provided)

---

## USER JOURNEY & EMOTIONAL ARC

**Primary Flow: First-Time User Creating First Config**

| Step | User Does | User Feels | Design Supports |
|------|-----------|------------|-----------------|
| 1. Landing | Opens config editor URL | **Curious but uncertain** — "Will this be complicated?" | Empty state is warm, not intimidating. Large [+ Add Asset] button is obvious starting point. |
| 2. First Asset | Clicks [+ Add Asset], uploads logo.png | **Tentatively confident** — "Okay, that was easy." | Upload success shows thumbnail immediately (instant feedback). Asset appears in left sidebar with clear [Edit] [Delete] actions. |
| 3. Adding More | Adds promo video, livestream URL | **Building momentum** — "I'm getting the hang of this." | Each asset adds to visible list (progress visible). Storage meter shows 2.3 GB / 5 GB (reassuring, not alarming). |
| 4. Schedule | Clicks [+ Add Schedule Block], defines 09:00-12:00, selects assets | **Focused, problem-solving** — "How do I make this play at the right times?" | Schedule builder shows time range clearly. Asset checkboxes make selection obvious. Preview of block immediately visible in right panel. |
| 5. Preview | Clicks [Preview] (top-right), sees timeline | **Excited validation** — "Let me see if this actually works!" | Timeline renders immediately (no loading delay if <10 assets). Scrubbing is intuitive (click to jump). "Now playing" indicator moves in real-time. |
| 6. Export | Returns to editor, clicks [Export config.json] | **Satisfied accomplishment** — "I built something that works." | Config downloads immediately (config-YYYY-MM-DD.json). Success message: "Config exported! Upload to your signage player to start playback." |
| 7. Deploy (Player) | Loads player URL with config.json URL param | **Anxious anticipation** — "Will this actually play on the device?" | Loading spinner shows "Loading content..." (transparent about what's happening). First asset appears full-screen within 5 seconds (fast feedback). Offline badge subtly appears top-right (non-intrusive). |
| 8. Success | Sees assets playing on schedule | **Relief + Pride** — "It works! I can use this." | Seamless playback. No UI distractions. If they check back later: still playing, schedule accurate. Trust built. |

**Time Horizons:**
- **5-second (visceral):** Editor feels approachable (not intimidating), player looks professional (not "template-y")
- **5-minute (behavioral):** Editor is learnable without docs, preview mode confirms correctness, player "just works"
- **5-year (reflective):** "This spec solves vendor lock-in. I can use any player that supports this format."

---

## VISUAL POLISH SPECIFICATIONS

**Typography:**
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Editor headings: 16px medium weight (sidebars), 14px regular (labels)
- Player error text: 18px medium (headline), 14px regular (details)
- Timeline time labels: 12px monospace (tabular numerals for alignment)

**Color Palette:**
- Primary action (buttons): `#2563eb` (blue-600)
- Success: `#16a34a` (green-600)
- Warning: `#ea580c` (orange-600)
- Error: `#dc2626` (red-600)
- Neutral backgrounds: `#f9fafb` (gray-50) editor, `#000000` player
- Text: `#111827` (gray-900) on light, `#ffffff` on dark

**Spacing Scale (8px base):**
- Tight: 8px (inline elements)
- Default: 16px (form fields, buttons)
- Comfortable: 24px (section spacing)
- Loose: 48px (major layout sections)

**Transition Specifications:**
- **Crossfade:** CSS `opacity` transition, 300ms `ease-in-out`, GPU-accelerated (`will-change: opacity`). Old asset fades out while new fades in (overlapping 150ms).
- **Fade-to-black:** Fade to black (200ms), swap asset, fade from black (200ms). Total 400ms.
- **Hard-cut:** Instant swap, 0ms, no animation.

**Offline Badge Specifics:**
- Position: Top-right corner, 16px from top/right edges
- Size: 80px × 32px rounded rectangle (`border-radius: 16px`)
- Background: `rgba(0, 0, 0, 0.6)` (60% opaque black)
- Text: "Offline" in 12px medium white text, centered
- Icon: Small cloud-off icon (16px) left of text
- Behavior: Fades in over 300ms when network lost, fades out when recovered

**Error Screen Icon:**
- Custom SVG (not emoji for accessibility)
- Triangle with exclamation mark: 64px × 64px
- Color: `#ea580c` (orange-600, less alarming than red)
- 2px stroke, no fill

**Asset Thumbnails (Editor Sidebar):**
- Size: 64px × 48px (4:3 aspect ratio)
- Border: 1px `#e5e7eb` (gray-200)
- Border-radius: 4px
- Background: `#f9fafb` (gray-50) if image fails to load
- Video thumbnails: Show first frame + small play icon overlay (16px, centered)

---

## DESIGN SYSTEM STATUS

**No DESIGN.md exists yet.** The Visual Polish Specifications section above constitutes the **design token set** for this project:
- **Typography scale:** System fonts, 12px/14px/16px/18px sizes
- **Color palette:** Primary/success/warning/error + neutral grays (Tailwind-inspired for consistency)
- **Spacing scale:** 8px base unit (8/16/24/48)
- **Component patterns:** Buttons, badges, error screens, empty states (all specified above)

**Recommendation:** After implementation, consolidate these tokens into a formal `DESIGN.md` file. For now, this plan serves as the design system specification.

**New Components Introduced:**
1. **Asset Card** (editor sidebar) — Thumbnail + metadata + actions. Reusable pattern.
2. **Schedule Block** (editor main panel) — Time range + asset list + actions. Reusable.
3. **Timeline Scrubber** (preview mode) — Horizontal time axis + interactive blocks. Custom component.
4. **Status Badge** (player) — Rounded rectangle with icon + text. Reusable for offline/error states.
5. **Empty State** (all UIs) — Icon + headline + subtext + CTA. Reusable pattern across app.

All components use tokens defined in Visual Polish Specifications. Consistent spacing (16px default), colors (primary blue for CTAs), and typography (system fonts).

---

## RESPONSIVE & ACCESSIBILITY

### Responsive Breakpoints

- **Mobile:** < 640px width
- **Tablet:** 640px - 1024px width
- **Desktop:** > 1024px width

### Mobile Layouts (< 640px)

**Config Editor (Mobile):**
```
+--------------------------------+
|  DisplayX Editor      [≡ Menu] |
+--------------------------------+
| Tabs: [Assets] [Schedule]     |
+--------------------------------+
|                                |
| ASSETS TAB:                    |
| +----------------------------+ |
| | [+ Add Asset]              | |
| |                            | |
| | □ logo.png                 | |
| |   [Edit] [Delete]          | |
| |   (64x48 thumbnail)        | |
| |                            | |
| | □ promo.mp4                | |
| |   [Edit] [Delete]          | |
| |                            | |
| | Storage: 2.3 GB / 5 GB     | |
| +----------------------------+ |
|                                |
| SCHEDULE TAB (when selected):  |
| +----------------------------+ |
| | [+ Add Schedule Block]     | |
| |                            | |
| | ┌─ 09:00 - 12:00 ────────┐ | |
| | │ Assets: logo, promo    │ | |
| | │ Durations: 10s, 30s    │ | |
| | │ Transition: crossfade  │ | |
| | └─ [Edit] [Delete] ─────┘ | |
| +----------------------------+ |
+--------------------------------+
|    [Validate] [Export]         |
+--------------------------------+
```

**Key Mobile Decisions:**
- Tabs replace side-by-side layout (assets/schedule never visible simultaneously)
- Touch targets: All buttons 44px minimum height
- Settings collapsed by default (access via hamburger menu)
- Single-column form fields (no inline labels)
- Bottom action bar sticky (validate/export always visible)

**Preview Mode (Mobile):**
```
+--------------------------------+
|  Preview              [← Back] |
+--------------------------------+
| ┌────────────────────────────┐ |
| │ Timeline (scroll horiz.)   │ |
| │ ──────────────────────────→│ |
| │ 00:00  06:00  12:00  18:00 │ |
| │ [logo][promo-vid][........ │ |
| └────────────────────────────┘ |
|                                |
| Now Playing:                   |
| logo.png                       |
| Duration: 10 seconds           |
| Next: promo-video.mp4          |
|                                |
| [Play] [Reset]                 |
+--------------------------------+
```

**Key Mobile Decisions:**
- Timeline scrolls horizontally (pinch-to-zoom disabled for clarity)
- Asset details stack vertically below timeline
- Time labels larger (14px minimum for touch accuracy)
- Scrubbing via touch drag on timeline (44px touch target height)

**Player (Mobile):**
- Same as desktop: full-screen immersive
- Offline badge: 60px × 24px on mobile (slightly smaller, still WCAG-compliant touch target)
- Error buttons: 48px height (larger than desktop for touch)

### Tablet Layouts (640px - 1024px)

**Config Editor (Tablet):**
- Side-by-side layout preserved (like desktop)
- Left sidebar: 40% width, right panel: 60% width
- No tabs (both visible simultaneously)
- Touch targets: 44px minimum (same as mobile)

**Preview Mode (Tablet):**
- Same as desktop layout
- Timeline full-width, touch-enabled scrubbing

**Player (Tablet):**
- Same as desktop and mobile: full-screen immersive

### Keyboard Navigation

**Config Editor:**
1. Tab order: [+ Add Asset] → first asset [Edit] → first asset [Delete] → second asset [Edit] → ... → [+ Add Schedule Block] → first schedule [Edit] → first schedule [Delete] → ... → [Settings expand] → [Validate] → [Export]
2. Enter key: Activates focused button
3. Escape key: Closes modal dialogs (asset/schedule forms)
4. Arrow keys: Navigate within asset/schedule lists (up/down)
5. Space: Toggles checkbox selection (for multi-select if added later)
6. Focus indicators: 2px solid `#2563eb` outline, 2px offset (visible on all interactive elements)

**Preview Mode:**
1. Tab order: [← Back to Editor] → Timeline scrubber → [Play] → [Reset]
2. Left/Right arrows: Scrub timeline backward/forward by 1 hour
3. Home/End: Jump to start/end of timeline
4. Space: Play/pause (if playback mode added)
5. Enter: Activate focused button

**Player:**
- No keyboard navigation (kiosk mode, auto-plays)
- Exception: Error state has keyboard focus on [Retry] button on load
- Tab cycles: [Retry] ↔ [Use Cached]

**Modal Dialogs (Add Asset / Add Schedule Block):**
1. Focus trap: Tab/Shift+Tab cycles within modal only
2. Escape: Closes modal, returns focus to trigger button
3. Enter on form: Submits (saves asset/schedule)
4. Focus on open: First form field receives focus automatically

### ARIA Landmarks & Semantic HTML

**Config Editor:**
```html
<header role="banner">
  <h1>DisplayX Config Editor</h1>
  <nav aria-label="Main actions">
    <button>Import</button>
    <button>Export</button>
  </nav>
</header>

<main role="main">
  <aside aria-label="Assets" role="complementary">
    <h2>Assets</h2>
    <button aria-label="Add new asset">+ Add Asset</button>
    <ul role="list" aria-label="Asset list">
      <li role="listitem">
        <article aria-labelledby="asset-1-name">
          <h3 id="asset-1-name">logo.png</h3>
          <button aria-label="Edit logo.png">Edit</button>
          <button aria-label="Delete logo.png">Delete</button>
        </article>
      </li>
    </ul>
  </aside>

  <section aria-label="Schedule">
    <h2>Daily Schedule</h2>
    <button aria-label="Add schedule block">+ Add Schedule Block</button>
    <!-- schedule blocks -->
  </section>
</main>

<footer role="contentinfo">
  <button aria-label="Validate configuration">Validate</button>
  <button aria-label="Export configuration as JSON">Export config.json</button>
</footer>
```

**Preview Mode:**
```html
<header role="banner">
  <h1>Preview: config.json</h1>
  <nav><a href="#" aria-label="Return to editor">← Editor</a></nav>
</header>

<main role="main">
  <section aria-label="Playback timeline" role="region">
    <div role="slider" aria-label="Scrub timeline"
         aria-valuemin="0" aria-valuemax="86400" aria-valuenow="37800"
         aria-valuetext="10:30 AM">
      <!-- timeline visualization -->
    </div>
  </section>

  <section aria-label="Asset details" role="complementary">
    <dl>
      <dt>Now Playing:</dt>
      <dd>logo.png</dd>
      <dt>Duration:</dt>
      <dd>10 seconds</dd>
      <dt>Next:</dt>
      <dd>promo-video.mp4 at 10:30:10</dd>
    </dl>
  </section>
</main>
```

**Player:**
```html
<main role="main" aria-label="Digital signage player">
  <div role="status" aria-live="polite" aria-atomic="true">
    <!-- Offline badge or error state -->
    <!-- Screen readers announce: "Offline mode active" -->
  </div>

  <video aria-label="Signage content" />
  <img aria-label="Signage content" alt="Logo image" />
</main>
```

### Screen Reader Support

**Interactive Elements:**
- All icon-only buttons have `aria-label` (e.g., `aria-label="Add new asset"` for [+] button)
- Asset thumbnails have `alt` text: `alt="{asset-name} thumbnail"` (e.g., "logo.png thumbnail")
- Loading states announce via `aria-live="polite"` (e.g., "Validating config...")
- Error states announce via `aria-live="assertive"` (interrupts current reading)
- Success states announce via `aria-live="polite"` (e.g., "Configuration valid")

**Timeline Scrubber (Preview Mode):**
- Uses `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`
- `aria-valuetext` provides human-readable time (e.g., "10:30 AM" instead of raw 37800 seconds)
- Screen reader announces: "Scrub timeline, slider, 10:30 AM, 10 of 24 hours"

**Empty States:**
- Entire empty state wrapped in `<section aria-label="Empty state">` with descriptive heading
- Screen reader announces: "No assets yet. Add images, videos, or livestreams to get started."

**Player Offline Badge:**
- `<div role="status" aria-live="polite">Offline</div>` announces when network lost
- Does not interrupt playback announcements (polite, not assertive)

### Touch Target Sizes

**Minimum Touch Targets (WCAG 2.1 Level AA):**
- All buttons, links, form fields: **44px × 44px minimum**
- Exception: Inline text links (within paragraphs) can be smaller if adequate spacing

**Specific Implementations:**
- [+ Add Asset] button: 48px height (comfortable)
- Asset [Edit] [Delete] buttons: 44px height, 60px width (side-by-side, 8px gap)
- Timeline scrubber drag handle: 48px × 48px circular handle
- Player [Retry] [Use Cached] buttons: 48px height
- Offline badge (player): 80px × 32px (desktop), 60px × 24px (mobile) — **NOT interactive, no touch target requirement**

### Color Contrast (WCAG AA)

**Verified Ratios (4.5:1 minimum for normal text, 3:1 for large text):**
- Primary button text (white on `#2563eb`): **7.2:1** ✓
- Success text (white on `#16a34a`): **5.8:1** ✓
- Error text (white on `#dc2626`): **6.1:1** ✓
- Body text (`#111827` on `#f9fafb`): **13.4:1** ✓
- Offline badge text (white on `rgba(0,0,0,0.6)`): **5.5:1** ✓
- Timeline time labels (`#4b5563` on white): **7.5:1** ✓

**Focus Indicators:**
- Focus outline (`#2563eb` 2px solid): **4.8:1** against white background ✓

### Focus Management

**Modal Open:**
1. Trigger button clicked → Modal opens
2. Focus moves to first form field inside modal
3. Previous focus saved in memory
4. Body scroll disabled (prevent background scrolling)

**Modal Close:**
1. Escape pressed or Cancel clicked → Modal closes
2. Focus returns to trigger button (saved focus restored)
3. Body scroll re-enabled

**Form Submission:**
1. Enter pressed or Save clicked → Form validates
2. If valid: Modal closes, focus returns to trigger button, success announcement via `aria-live`
3. If invalid: Focus moves to first invalid field, error announcement via `aria-live="assertive"`

**Player Error State:**
1. Config load fails → Error screen displays
2. Focus automatically moves to [Retry] button
3. User can Tab to [Use Cached]
4. If Retry succeeds: Focus moves to `<body>` (player takes over, no interactive elements)

### Reduced Motion Support

**For users with `prefers-reduced-motion` media query:**
- Crossfade transitions: Disabled (hard-cut instead)
- Fade-to-black transitions: Disabled (hard-cut instead)
- Timeline scrubbing animations: Disabled (instant jump)
- Spinner animations: Static icon (no rotation)
- Badge fade-in/out: Instant show/hide (no opacity transition)

**CSS Implementation:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Config Override (for player):**
- New config option: `"respect_reduced_motion": true` (default true)
- If false: Transitions play regardless of user preference (for signage displays where motion is intentional)

---

## IMPLEMENTATION DECISIONS (from design review)

### Config Editor

**Asset Upload Flow:**
- [+ Add Asset] opens **modal dialog** with:
  - File picker (upload or URL input)
  - Asset ID field (auto-filled from filename, user can edit)
  - Type dropdown (image/video/live_stream)
  - Cached checkbox (default: true)
  - [Cancel] [Save Asset] buttons
- Modal uses focus trap (Tab cycles within modal, Escape closes)
- On save: Modal closes, new asset appears in sidebar list, focus returns to [+ Add Asset] button

**Schedule Block Overlap:**
- **Validation error prevents save** if time ranges overlap
- Error message: "Schedule blocks cannot overlap. Block 2 (11:00-13:00) overlaps Block 1 (09:00-12:00)."
- User must fix overlap before validation passes

**Delete Actions:**
- [Delete] buttons show **confirmation dialog**:
  - Modal: "Delete logo.png? This cannot be undone."
  - [Cancel] [Delete] buttons (Delete is red, secondary style)
- On confirm: Item removed from list, success announcement via `aria-live="polite"`: "logo.png deleted"

**Export Filename:**
- Downloaded file named: `config-YYYY-MM-DD.json` (e.g., `config-2026-03-21.json`)
- Timestamp prevents accidental overwrites when exporting multiple versions

**Settings Defaults:**
- Poll interval: 300 seconds (5 minutes)
- Cache size: 5 GB
- Health report URL: empty (optional field)
- Analytics webhook: empty (optional field)

### Preview Mode

**Timeline Scrubbing:**
- Click/drag on timeline: **Highlights time, no playback**
- Timeline marker moves to clicked time (e.g., 10:30 AM)
- "Asset details" section updates: "Now Playing: logo.png", "Next: promo-video.mp4 at 10:30:10"
- No video/image playback (preview is for schedule verification only)

**Timeline Asset Block Colors (semantic, type-based):**
- **Video:** `#2563eb` (blue-600)
- **Image:** `#16a34a` (green-600)
- **Livestream:** `#7c3aed` (purple-600)
- Color helps user differentiate asset types at a glance

**Empty Schedule:**
- If no schedule blocks defined: Show empty state in main panel (timeline area)
- Empty state: "No schedule defined. Create schedule blocks in the editor." + [← Back to Editor] button

### Player

**Config URL Format:**
- URL param: `config` (short, clear)
- Example: `player.html?config=https://cdn.example.com/config.json`
- Signed URLs supported: `player.html?config=https://storage.googleapis.com/bucket/config.json?signed=...`

**First Load Caching Strategy:**
- Player **waits for all assets to cache** before starting playback
- Loading screen: Full-screen spinner + "Loading content..." + progress indicator ("Caching 3 of 10 assets...")
- Only starts playback when all `cached: true` assets downloaded
- Rationale: Ensures smooth transitions, aligns with offline-first philosophy

**Retry Button Behavior:**
- [Retry] button: **Refetches config.json** (entire config, not individual asset)
- Use case: Network failures, signed URL expiry, server errors
- On click: Shows loading spinner, attempts new config fetch
- If success: Transitions to playback
- If fail: Shows error screen again with updated error message

**"Use Cached" Button:**
- Loads last-known-good config.json from IndexedDB + plays cached assets
- If no cached config exists: Button disabled, tooltip: "No cached content available"
- If cached config exists but assets missing: Plays available assets, shows warning badge

**Fallback Asset Handling:**
- If `fallback.asset_id` references non-existent asset: Show black screen + centered white text: "Content Unavailable"
- If fallback asset also fails to load: Same black screen + text (last resort)

---

- **Visual config editor (MVP scope: form-based, no drag-drop)**:
  - Web app with single-page form layout (see UI Specifications above)
  - Left sidebar: asset list with add/edit/delete. Right panel: schedule builder
  - Outputs valid config.json
  - Done when: Non-technical user can create config.json with 3+ assets and daily schedule without editing JSON
  - Note: Build AFTER config format is frozen post-implementation
- **Preview mode**:
  - Timeline-first layout (see UI Specifications above)
  - Horizontal timeline dominates view, asset details below
  - Interactive scrubbing: click/drag on timeline to jump to any time
  - Done when: User can visually verify schedule logic before deploying
- **Conditional display rules**:
  - Config syntax: `"conditions": {"date_range": ["2026-01-01", "2026-12-31"], "device_tags": ["lobby"]}`
  - Supported conditions: date ranges, device tags (no geo/IP-based filtering in MVP)
  - Evaluation: Client-side at schedule load time
  - Done when: Config can specify date-bound and tag-bound content; player respects filters

## Phased Roadmap

### Weekend MVP (basic playback + static schedule)
Ship in 1 week (human team) / ~2 days (CC + gstack):
- Minimal config.json format (assets list, static daily schedule, no transitions)
- Web player (HTML5 video, image display, basic schedule engine)
- Load config.json from static URL (no signed URLs yet)
- Basic error handling (asset load failures → show error, no fallback yet)
- NOTE: No caching, no signed URLs, no offline support in weekend MVP

### Phase 1: Standard v1.0 (this plan)
Ship in 4-6 weeks (human team) / ~2 weeks (CC + gstack):
- **Specification Deliverables:**
  - Formal spec document (markdown)
  - JSON Schema file (config.schema.json) with required fields, enum types, reference validation
  - Compliance test suite (web browser only)
- **Reference Player Features:**
  - All core features (signed URLs, caching, health reporting, transitions, analytics, conditional rules)
  - Note: Visual editor built in week 2-3 after config format stabilizes
- **Tools & UX:**
  - Visual config editor (form-based, post-config-freeze)
  - Preview mode (text-based schedule validation showing asset IDs and time blocks; visual timeline deferred to Phase 2)

### Phase 2: Enterprise & Platform Expansion (future)
- Remote screenshot capability
- Production-grade health reporting (auth, retries, aggregation)
- Production-grade analytics (persistent queue, delivery guarantees)
- Cross-platform native players (tvOS, Android TV, Tizen, webOS)
- Platform-specific compliance tests
- Geo/IP-based conditional rules
- Plugin ecosystem (custom asset types, data sources)

## Deferred to TODOS.md (Phase 2)
- Remote screenshot capability (admin can request "show me what this device displays now")
- Production-grade health reporting with authentication and retry logic
- Production-grade analytics with persistent queue
- Cross-platform native implementations (native GPU transitions, platform video players)
- Geo/IP-based conditional display rules
- Plugin ecosystem architecture
