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
                if (tab && tab.id) {
                    saveAndApply(tab.id);
                }
            });
        });
    } catch (err) {
        console.error('Failed to initialize state from storage:', err);
    }
}

/**
 * Saves current toggle state to storage and alerts the content script
 * @param {number} tabId 
 */
async function saveAndApply(tabId) {
    const state = {};
    KEYS.forEach(key => {
        const el = document.getElementById(key);
        state[key] = el ? el.checked : false;
    });

    try {
        // Save to local storage
        await chrome.storage.local.set(state);

        // Broadcast state change to the content script in the active tab
        await chrome.tabs.sendMessage(tabId, { action: 'applyStyles', state });

        // Show success indicator
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'تم التطبيق ✓';
            setTimeout(() => {
                statusEl.textContent = '';
            }, 500);
        }
    } catch (err) {
        console.error('Failed to save or apply state:', err);
    }
}

// Kick off initialization after DOM is loaded
document.addEventListener('DOMContentLoaded', init);
