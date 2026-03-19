const CSS_FILES = {
  'rtl': 'main-rtl.css',
  'code-rtl': 'code-rtl.css',
  'big-text': 'big-text.css',
  'extra-width': 'extra-width.css'
};

const LINK_IDS = {
  'rtl': 'claude-styler-link-rtl',
  'code-rtl': 'claude-styler-link-code-rtl',
  'big-text': 'claude-styler-link-big-text',
  'extra-width': 'claude-styler-link-extra-width'
};

function applyStyles(state) {
  if (!state) return;

  Object.keys(CSS_FILES).forEach(key => {
    const linkId = LINK_IDS[key];
    let el = document.getElementById(linkId);

    if (state[key]) {
      // Create link element if not already present
      if (!el) {
        el = document.createElement('link');
        el.id = linkId;
        el.rel = 'stylesheet';
        el.type = 'text/css';
        // Needs web_accessible_resources in manifest.json to work
        el.href = chrome.runtime.getURL(CSS_FILES[key]);
        document.head.appendChild(el);
      }
    } else {
      // Remove link element when toggled off
      if (el) {
        el.remove();
      }
    }
  });
}

// 1. Listen for dynamic message from popup toggles
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'applyStyles' && msg.state) {
    applyStyles(msg.state);
    sendResponse({ success: true });
  }
});

// 2. Load and apply stored state as soon as the page loads
try {
  const keys = Object.keys(CSS_FILES);
  chrome.storage.local.get(keys, (state) => {
    if (chrome.runtime.lastError) {
      console.error('Extension storage error:', chrome.runtime.lastError);
      return;
    }
    applyStyles(state);
  });
} catch (err) {
  console.error('Failed to load initial extension state:', err);
}
