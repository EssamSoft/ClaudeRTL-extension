'use strict';

/* =========================================================================
   Content script
   - Reflects the saved toggle state as attributes on <html>.
   - The merged stylesheet (injected by the background worker) gates every
     rule on these attributes, so toggling = adding/removing one attribute.
   - Storage is the single source of truth; the popup only writes to it.
   ========================================================================= */

// Toggle key (in chrome.storage.local) -> attribute on <html>.
const FEATURES = {
  'rtl': 'data-rtl',
  'code-rtl': 'data-code-rtl',
  'big-text': 'data-big-text',
  'input-ltr': 'data-input-ltr',
  'extra-width': 'data-extra-width'
};

const KEYS = Object.keys(FEATURES);

/**
 * Reflect the given state onto <html> as data-* attributes.
 * @param {Record<string, boolean>} state
 */
function applyState(state) {
  if (!state) return;
  const root = document.documentElement;
  KEYS.forEach(key => {
    if (state[key]) root.setAttribute(FEATURES[key], '');
    else root.removeAttribute(FEATURES[key]);
  });
}

/** Read the saved state from storage and reflect it onto <html>. */
function syncFromStorage() {
  chrome.storage.local.get(KEYS, (state) => {
    if (chrome.runtime.lastError) {
      console.error('Claude RTL: storage error:', chrome.runtime.lastError);
      return;
    }
    applyState(state);
  });
}

// 1. Apply saved state on load.
try {
  syncFromStorage();
} catch (err) {
  console.error('Claude RTL: failed to load initial state:', err);
}

// 2. Ask the background worker to inject the stylesheet into this tab.
try {
  chrome.runtime.sendMessage({ action: 'injectCss' });
} catch (err) {
  console.error('Claude RTL: failed to request CSS injection:', err);
}

// 3. React to toggle changes live, without any tab messaging.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (!KEYS.some(key => key in changes)) return;
  syncFromStorage();
});
