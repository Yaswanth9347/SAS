/**
 * Accessibility Utilities
 * - Inject skip link
 * - Ensure main landmark
 * - Create aria-live region for announcements
 * - Apply font size and high contrast preferences
 */
(function(){
  'use strict';

  function ensureSkipLink() {
    if (document.getElementById('skipToContent')) return;
    const a = document.createElement('a');
    a.id = 'skipToContent';
    a.href = '#mainContent';
    a.textContent = 'Skip to main content';
    a.className = 'skip-link';
    document.body.insertBefore(a, document.body.firstChild);
  }

  function ensureMainLandmark() {
    // If page has an element marked as main, respect it
    if (document.querySelector('[role="main"], main')) return;
    // Try to mark primary container as main
    const candidates = document.querySelectorAll('section .container, .dashboard .container, .settings-page .container, .container');
    for (let el of candidates) {
      if (el && !el.closest('nav') && el.offsetParent !== null) {
        el.setAttribute('role', 'main');
        if (!el.id) el.id = 'mainContent';
        break;
      }
    }
  }

  function ensureAriaLive() {
    if (document.getElementById('ariaLive')) return;
    const live = document.createElement('div');
    live.id = 'ariaLive';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.style.position = 'absolute';
    live.style.left = '-9999px';
    live.style.width = '1px';
    live.style.height = '1px';
    live.style.overflow = 'hidden';
    document.body.appendChild(live);
    window.announce = function(msg){ try { live.textContent = msg || ''; } catch(e){} };
  }

  function applyFontSize(size) {
    const cls = ['text-size-small','text-size-medium','text-size-large','text-size-xlarge'];
    document.body.classList.remove(...cls);
    const map = { small:'text-size-small', medium:'text-size-medium', large:'text-size-large', xlarge:'text-size-xlarge' };
    const chosen = map[size] || 'text-size-medium';
    document.body.classList.add(chosen);
  }

  function applyHighContrast(isOn) {
    document.body.classList.toggle('theme-high-contrast', !!isOn);
  }

  // Expose to global
  window.a11y = {
    ensureSkipLink,
    ensureMainLandmark,
    ensureAriaLive,
    applyFontSize,
    applyHighContrast
  };

  // Initialize basic affordances ASAP
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureSkipLink();
      ensureMainLandmark();
      ensureAriaLive();
    });
  } else {
    ensureSkipLink();
    ensureMainLandmark();
    ensureAriaLive();
  }
})();
