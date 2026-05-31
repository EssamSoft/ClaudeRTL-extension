# Remote, Merged, Toggle-Driven CSS — Design

**Date:** 2026-05-31
**Status:** Approved (pending implementation plan)

## Goal

Let the extension's styling be updated without republishing the extension, by
hosting one merged CSS file on a remote server. Merge the four separate CSS
files into a single file whose rules are gated by attributes on the page root,
so toggles flip attributes instead of adding/removing `<link>` tags.

## Decisions

- **Freshness:** Cache-first + background refresh. Inject cached CSS instantly
  on page load; fetch the latest in the background; updates apply on next load.
- **Hosting:** GitHub. Serve `styles.css` via
  `https://raw.githubusercontent.com/<user>/<repo>/main/styles.css`.
  - Caveat: raw URLs sit behind a CDN with a ~5-minute cache, so edits appear
    within ~5 min. GitHub Pages is a drop-in alternative for instant updates.
- **Toggles:** Keep the existing four features and keys: `rtl`, `code-rtl`,
  `big-text`, `extra-width`.

## Why not `input:checked`?

The original idea was a single file gated by `input:checked[name=toggleRTL]`.
That cannot work: the toggle checkboxes live in the popup, a separate document
from the claude.ai page, so page CSS cannot observe them. Instead the content
script writes the toggle state onto `<html>` as `data-*` attributes, and the
merged CSS gates each block on those attributes.

## Why not a remote `<link>`?

Pointing a `<link rel="stylesheet">` at a remote URL is subject to claude.ai's
Content Security Policy and will likely be blocked. Instead the background
service worker `fetch()`es the CSS text (allowed via `host_permissions`) and
injects it with `chrome.scripting.insertCSS`, which is privileged and bypasses
the page CSP.

## Components

1. **`styles.css`** — one merged file, hosted on GitHub *and* bundled in the
   extension as a fallback. Every rule is gated by a root attribute:
   ```css
   html[data-rtl] .font-claude-message { direction: rtl; }
   html[data-rtl] table, html[data-rtl] pre { direction: ltr; }
   html[data-code-rtl] pre, html[data-code-rtl] code { direction: rtl; text-align: right; }
   html[data-big-text] main p { font-size: 18px !important; }
   html[data-extra-width] .w-full.max-w-3xl { max-width: 95vw !important; }
   ```
   The merge preserves the exact rules currently in `main-rtl.css`,
   `code-rtl.css`, `big-text.css`, and `extra-width.css`, each prefixed with its
   gating attribute.

2. **`background.js`** (new service worker) — owns the remote CSS lifecycle:
   - Fetch the remote file, cache the text in `chrome.storage.local`.
   - Inject the cached CSS into claude.ai tabs via `chrome.scripting.insertCSS`.
   - On each injection, kick a background refresh; if the fetched text differs
     from the cache, update the cache (applies on next load).

3. **`content.js`** (modified) — no longer creates `<link>` tags. Reads toggle
   state from storage and sets/removes `data-*` attributes on `<html>`. Listens
   for popup messages and updates attributes live.

4. **`popup.js` / `popup.html`** — unchanged behavior; same four toggle keys.
   Saves state and notifies the content script.

## Data flow

- **Page load:** content script sets `<html>` attributes from stored toggles →
  background injects cached `styles.css` once via `insertCSS` → background
  fetches the remote file; if changed, updates the cache for next load.
- **User flips a toggle:** popup saves state → content script adds/removes one
  `data-*` attribute on `<html>`. No re-fetch, no re-inject — the gated CSS
  reacts instantly because the full file is already injected.

## Fallback chain (never breaks)

`storage cache` → `bundled styles.css` (first run / server unreachable) →
remote refresh updates the cache. A failed or empty fetch keeps the last good
cache.

## Manifest changes

- Add `"scripting"` permission.
- Add host permission `https://raw.githubusercontent.com/*`.
- Add `"background": { "service_worker": "background.js" }`.
- Remove `web_accessible_resources` and the four separate CSS files (merged into
  `styles.css`; keep one bundled copy as fallback).

## Attribute mapping

| Toggle key (storage) | Root attribute   |
|----------------------|------------------|
| `rtl`                | `data-rtl`       |
| `code-rtl`           | `data-code-rtl`  |
| `big-text`           | `data-big-text`  |
| `extra-width`        | `data-extra-width` |

## Trade-offs / risks

- **Privacy/optics:** the extension now contacts GitHub on each load. Note this
  in the store description.
- **Web Store review:** remotely-hosted CSS injected via `insertCSS` is data,
  not executable code, and is allowed — but reviewers scrutinize remote content,
  so keep the remote file CSS-only.
- **~5-min update lag** with raw GitHub URLs.

## Out of scope

- Live re-injection of updated CSS within an already-open tab (updates apply on
  next page load).
- Changing or adding new toggle features.
- A version/manifest endpoint (plain file diff is sufficient for cache-first).
