/**
 * Loading Manager
 * Handles loading states, spinners, and skeleton loaders
 */

class LoadingManager {
  constructor() {
    this.activeLoaders = new Set();
  }

  /**
   * Show loading spinner in element
   */
  show(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (!element) return;

    this.activeLoaders.add(elementId);

    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.innerHTML = `
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-message">${message}</p>
      </div>
    `;

    // Add styles
    this.addStyles();

    element.style.position = 'relative';
    element.appendChild(loader);
  }

  /**
   * Hide loading spinner from element
   */
  hide(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const loader = element.querySelector('.loading-overlay');
    if (loader) {
      loader.remove();
    }

    this.activeLoaders.delete(elementId);
  }

  /**
   * Show full page loading overlay
   */
  showFullPage(message = 'Loading...') {
    if (document.getElementById('full-page-loader')) return;

    const loader = document.createElement('div');
    loader.id = 'full-page-loader';
    loader.className = 'loading-overlay full-page';
    loader.innerHTML = `
      <div class="loading-content">
        <div class="spinner large"></div>
        <p class="loading-message">${message}</p>
      </div>
    `;

    this.addStyles();
    document.body.appendChild(loader);
  }

  /**
   * Hide full page loading overlay
   */
  hideFullPage() {
    const loader = document.getElementById('full-page-loader');
    if (loader) {
      loader.remove();
    }
  }

  /**
   * Create skeleton loader for cards/lists
   */
  showSkeleton(elementId, count = 3, type = 'card') {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = `skeleton skeleton-${type}`;
      
      if (type === 'card') {
        skeleton.innerHTML = `
          <div class="skeleton-header"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        `;
      } else if (type === 'list') {
        skeleton.innerHTML = `
          <div class="skeleton-avatar"></div>
          <div class="skeleton-text">
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        `;
      } else if (type === 'table') {
        skeleton.innerHTML = `
          <div class="skeleton-line"></div>
        `;
      }
      
      element.appendChild(skeleton);
    }

    this.addStyles();
  }

  /**
   * Show loading button state
   */
  showButtonLoading(buttonId, text = 'Loading...') {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `
      <span class="button-spinner"></span>
      <span>${text}</span>
    `;

    this.addStyles();
  }

  /**
   * Hide loading button state
   */
  hideButtonLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Submit';
    delete button.dataset.originalText;
  }

  /**
   * Add loading styles to document
   */
  addStyles() {
    if (document.getElementById('loading-manager-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'loading-manager-styles';
    styles.textContent = `
      /* Loading Overlay */
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        border-radius: inherit;
      }

      .loading-overlay.full-page {
        position: fixed;
        z-index: 9999;
        background: rgba(255, 255, 255, 0.98);
      }

      .loading-content {
        text-align: center;
      }

      /* Spinner */
      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #4caf50;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 15px;
      }

      .spinner.large {
        width: 60px;
        height: 60px;
        border-width: 4px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-message {
        color: #666;
        font-size: 0.95rem;
        font-family: 'Poppins', sans-serif;
        margin: 0;
      }

      /* Button Spinner */
      .button-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        margin-right: 8px;
        vertical-align: middle;
      }

      /* Skeleton Loaders */
      .skeleton {
        background: #f0f0f0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 15px;
        animation: pulse 1.5s ease-in-out infinite;
      }

      .skeleton-card {
        min-height: 200px;
      }

      .skeleton-list {
        display: flex;
        gap: 15px;
        align-items: center;
        min-height: 80px;
      }

      .skeleton-header {
        height: 120px;
        background: #e0e0e0;
        border-radius: 8px;
        margin-bottom: 15px;
      }

      .skeleton-avatar {
        width: 50px;
        height: 50px;
        background: #e0e0e0;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .skeleton-text {
        flex: 1;
      }

      .skeleton-line {
        height: 12px;
        background: #e0e0e0;
        border-radius: 4px;
        margin-bottom: 10px;
      }

      .skeleton-line.short {
        width: 60%;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      /* Progress Bar */
      .progress-bar-container {
        width: 100%;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
        margin: 10px 0;
      }

      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4caf50, #2e7d32);
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .progress-bar.indeterminate {
        width: 30%;
        animation: indeterminate 1.5s ease-in-out infinite;
      }

      @keyframes indeterminate {
        0% {
          transform: translateX(-100%);
        }
        100% {
          transform: translateX(400%);
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Show progress bar
   */
  showProgress(elementId, progress = 0) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let progressBar = element.querySelector('.progress-bar-container');
    
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'progress-bar-container';
      progressBar.innerHTML = '<div class="progress-bar"></div>';
      element.appendChild(progressBar);
      this.addStyles();
    }

    const bar = progressBar.querySelector('.progress-bar');
    
    if (progress < 0) {
      // Indeterminate progress
      bar.classList.add('indeterminate');
      bar.style.width = '30%';
    } else {
      // Determinate progress
      bar.classList.remove('indeterminate');
      bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  }

  /**
   * Hide progress bar
   */
  hideProgress(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const progressBar = element.querySelector('.progress-bar-container');
    if (progressBar) {
      progressBar.remove();
    }
  }

  /**
   * Clear all loaders
   */
  clearAll() {
    this.activeLoaders.forEach(elementId => {
      this.hide(elementId);
    });
    this.hideFullPage();
  }
}

// Create global loading manager instance
const loading = new LoadingManager();
