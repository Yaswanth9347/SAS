/**
 * Theme Management
 * Handles theme initialization and persistence
 */
(function () {
    'use strict';

    // Apply theme early to prevent flash
    function applyThemeEarly() {
        try {
            const prefsStr = localStorage.getItem(CONFIG?.STORAGE_KEYS?.PREFERENCES || 'sas_preferences');
            const prefs = prefsStr ? JSON.parse(prefsStr) : null;
            const theme = prefs?.theme || 'system';

            const body = document.body;
            body.classList.remove('theme-light', 'theme-dark');

            if (theme === 'light') {
                body.classList.add('theme-light');
            } else if (theme === 'dark') {
                body.classList.add('theme-dark');
            }
            // system: no explicit class, uses default
        } catch (e) {
            console.warn('Early theme application failed', e);
        }
    }

    // Apply theme immediately if DOM is ready
    if (document.body) {
        applyThemeEarly();
    } else {
        // Wait for body to be available
        document.addEventListener('DOMContentLoaded', applyThemeEarly);
    }
})();
