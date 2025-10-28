/**
 * App Initialization
 * Main initialization file that runs on every page
 */

(function() {
  'use strict';

  /**
   * Initialize common app functionality
   */
  function initApp() {
    // Setup navbar globally (shows limited items when not logged in)
    if (typeof navbarManager !== 'undefined') {
      try { navbarManager.setupNavbar(); } catch (e) { console.warn('Navbar setup failed', e); }

      // For pages that require authentication, enforce login after navbar is ready
    const authenticatedPages = [
  'dashboard.html', 
  'visits.html', 
  'schools.html', 
  'teams.html',
  'visit-gallery.html', 
  'schedule-visit.html', 
  'visit-report.html',
  'analytics.html', 
  'reports.html',
  'admin-users.html',
  'settings.html'
      ];

      const currentPage = window.location.pathname.split('/').pop();

      if (authenticatedPages.includes(currentPage)) {
        // Check authentication
        if (!authManager.isAuthenticated()) {
          authManager.requireAuth();
          return;
        }
      }
    }

    // Initialize accessibility utilities
    try {
      if (typeof a11y !== 'undefined') {
        a11y.ensureSkipLink();
        a11y.ensureMainLandmark();
        a11y.ensureAriaLive();
      }
    } catch (e) { console.warn('A11y init failed', e); }

    // Add global error handler
    window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled promise rejection:', event.reason);
      
      if (typeof notify !== 'undefined') {
        notify.error('An unexpected error occurred. Please try again.');
      }
    });

    // Add global online/offline handlers
    window.addEventListener('offline', function() {
      if (typeof notify !== 'undefined') {
        notify.warning('You are offline. Some features may not work.', 0);
      }
    });

    window.addEventListener('online', function() {
      if (typeof notify !== 'undefined') {
        notify.success('You are back online!');
      }
    });

    // Prevent form resubmission on page refresh
    if (window.history.replaceState) {
      window.history.replaceState(null, null, window.location.href);
    }

    console.log('SAS App initialized successfully');

    // Inject theme stylesheet (once) and apply saved theme and accessibility prefs
    try {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!document.getElementById('themeStylesheet')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/themes.css';
        link.id = 'themeStylesheet';
        head.appendChild(link);
      }

      // Apply theme from localStorage preferences
      const prefsStr = localStorage.getItem(CONFIG.STORAGE_KEYS.PREFERENCES);
      const prefs = prefsStr ? JSON.parse(prefsStr) : null;
      const theme = prefs?.theme || 'system';
      applyTheme(theme);
      // Apply font size and high contrast
      const fontSize = prefs?.fontSize || 'medium';
      const highContrast = !!prefs?.highContrast;
      if (typeof a11y !== 'undefined') {
        a11y.applyFontSize(fontSize);
        a11y.applyHighContrast(highContrast);
      }
    } catch (e) {
      console.warn('Theme init failed', e);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  /**
   * Global helper to handle API errors
   */
  window.handleAPIError = function(error) {
    console.error('API Error:', error);
    
    const message = error.message || 'An error occurred. Please try again.';
    
    if (typeof notify !== 'undefined') {
      notify.error(message);
    } else {
      alert(message);
    }

    // If unauthorized, redirect to login
    if (message.toLowerCase().includes('unauthorized') || 
        message.toLowerCase().includes('token')) {
      authManager.clearAuth();
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    }
  };

  /**
   * Global helper to format status badges
   */
  window.getStatusBadge = function(status) {
    const statusMap = {
      'completed': { class: 'status-completed', text: 'Completed' },
      'scheduled': { class: 'status-scheduled', text: 'Scheduled' },
      'cancelled': { class: 'status-cancelled', text: 'Cancelled' },
      'pending': { class: 'status-scheduled', text: 'Pending' }
    };

    const config = statusMap[status?.toLowerCase()] || { 
      class: 'status-scheduled', 
      text: utils.capitalize(status || 'Unknown') 
    };

    return `<span class="status-badge ${config.class}">${config.text}</span>`;
  };

  /**
   * Global helper to safely render text (prevent XSS)
   */
  window.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Global helper to format dates
   */
  window.formatDate = function(date, format = 'short') {
    return utils.formatDate(date, format);
  };

  /**
   * Global helper to render "No Data" state
   */
  window.renderNoData = function(container, message = 'No data available') {
    if (typeof container === 'string') {
      container = document.getElementById(container);
    }
    
    if (!container) return;

    container.innerHTML = `
      <div class="no-data" style="
        text-align: center;
        padding: 60px 20px;
        color: #999;
      ">
        <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;"></i>
        <p style="font-size: 1.2rem; margin: 0;">${escapeHtml(message)}</p>
      </div>
    `;
  };

  /**
   * Global helper to render error state
   */
  window.renderError = function(container, message = 'Failed to load data') {
    if (typeof container === 'string') {
      container = document.getElementById(container);
    }
    
    if (!container) return;

    container.innerHTML = `
      <div class="error-state" style="
        text-align: center;
        padding: 60px 20px;
        color: #c62828;
      ">
        <i class="fas fa-exclamation-triangle" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
        <p style="font-size: 1.2rem; margin: 0 0 15px 0;">${escapeHtml(message)}</p>
        <button onclick="location.reload()" style="
          padding: 10px 20px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
        ">Try Again</button>
      </div>
    `;
  };

  /**
   * Apply theme to document root
   */
  window.applyTheme = function(theme) {
    const root = document.documentElement;
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'light') {
      body.classList.add('theme-light');
    } else if (theme === 'dark') {
      body.classList.add('theme-dark');
    } else {
      // system: remove explicit class; CSS prefers defaults
    }
  };

})();
