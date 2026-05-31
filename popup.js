'use strict';

const KEYS = ['rtl', 'code-rtl', 'big-text', 'extra-width'];

/**
 * Gets the current active tab
 * @returns {Promise<chrome.tabs.Tab|undefined>}
 */
async function getCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    } catch (err) {
        console.error('Failed to get current tab:', err);
        return undefined;
    }
}

/**
 * Initializes the popup logic
 */
async function init() {
    const tab = await getCurrentTab();
    const isClaude = tab?.url && tab.url.startsWith('https://claude.ai');

    const controlsEl = document.getElementById('controls');
    const notClaudeEl = document.getElementById('not-claude');

    // Display warning if not on Claude.ai
    if (!isClaude) {
        // if (controlsEl) controlsEl.style.display = 'none';
        if (notClaudeEl) notClaudeEl.style.display = 'block';
        return;
    }

    try {
        // Load previously saved state from storage
        const stored = await chrome.storage.local.get(KEYS);

        KEYS.forEach(key => {
            const el = document.getElementById(key);
            if (!el) return;

            // Update UI with stored state
            if (stored[key]) el.checked = true;

            // Listen for user changes
            el.addEventListener('change', () => {
                saveState();
            });
        });
    } catch (err) {
        console.error('Failed to initialize state from storage:', err);
    }
}

/**
 * Saves current toggle state to storage.
 * The content script observes chrome.storage.onChanged and applies the styles,
 * so no tab messaging is needed (which avoids "Receiving end does not exist"
 * when a tab has no live content script, e.g. after reloading the extension).
 */
async function saveState() {
    const state = {};
    KEYS.forEach(key => {
        const el = document.getElementById(key);
        state[key] = el ? el.checked : false;
    });

    try {
        // Storage is the single source of truth; live tabs react via onChanged.
        await chrome.storage.local.set(state);

        // Show success indicator
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'تم التطبيق ✓';
            setTimeout(() => {
                statusEl.textContent = '';
            }, 500);
        }
    } catch (err) {
        console.error('Failed to save state:', err);
    }
}

// Kick off initialization after DOM is loaded
document.addEventListener('DOMContentLoaded', init);
