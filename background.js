'use strict';

/* =========================================================================
   Background service worker
   - Fetches the merged stylesheet from a remote URL (GitHub raw).
   - Caches it in chrome.storage.local (cache-first + background refresh).
   - Injects it into claude.ai tabs via chrome.scripting.insertCSS, which is
     privileged and bypasses the page Content Security Policy.
   ========================================================================= */

// ⚠️ ACTION REQUIRED: replace <user>/<repo> with your public GitHub repo.
//    Format: https://raw.githubusercontent.com/<user>/<repo>/<branch>/styles.css
const CSS_URL =
  'https://raw.githubusercontent.com/EssamSoft/ClaudeRTL-extension/main/styles.css';

const CACHE_KEY = 'cssCache';

/**
 * Fetch the remote CSS text. Allowed (and CORS-exempt) because the extension
 * has host_permissions for raw.githubusercontent.com.
 * @returns {Promise<string>}
 */
async function fetchRemoteCss() {
  const res = await fetch(CSS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/**
 * Read the CSS bundled inside the extension (first-run / offline fallback).
 * @returns {Promise<string>}
 */
async function getBundledCss() {
  const res = await fetch(chrome.runtime.getURL('styles.css'));
  return await res.text();
}

/**
 * Best CSS available right now: cache → bundled fallback.
 * @returns {Promise<string>}
 */
async function getCss() {
  const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
  if (cached && cached.trim()) return cached;
  return await getBundledCss();
}

/**
 * Refresh the cache from the remote server. Keeps the last good cache on
 * failure (offline / server down / empty response). Applies on next load.
 */
async function refreshCss() {
  try {
    const css = await fetchRemoteCss();
    if (css && css.trim()) {
      await chrome.storage.local.set({ [CACHE_KEY]: css });
    }
  } catch (err) {
    console.warn('Claude RTL: CSS refresh failed, keeping cache:', err);
  }
}

/**
 * Inject the current best CSS into a tab. Gated rules stay inert until the
 * content script sets the matching html[data-*] attribute.
 * @param {number} tabId
 */
async function injectInto(tabId) {
  let css;
  try {
    css = await getCss();
  } catch (err) {
    console.error('Claude RTL: could not resolve CSS to inject:', err);
    return;
  }
  if (!css) return;

  try {
    await chrome.scripting.insertCSS({ target: { tabId }, css });
  } catch (err) {
    console.warn('Claude RTL: insertCSS failed:', err);
  }
}

// Seed / refresh the cache when the extension is installed or the worker starts.
chrome.runtime.onInstalled.addListener(refreshCss);
chrome.runtime.onStartup.addListener(refreshCss);

// The content script asks for injection once it has loaded on a claude.ai page.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'injectCss' && sender.tab && sender.tab.id) {
    injectInto(sender.tab.id).then(() => {
      // Refresh in the background for the next load (cache-first).
      refreshCss();
      sendResponse({ success: true });
    });
    return true; // keep the message channel open for the async response
  }
});
