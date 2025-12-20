/**
 * Notification Manager
 * Unified notification system for user feedback
 */

class NotificationManager {
  constructor() {
    this.container = null;
    this.defaultDuration = 3000;
    this.init();
  }

  /**
   * Initialize notification container
   */
  init() {
    // Create container if it doesn't exist
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
      `;
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }

  /**
   * Show notification
   */
  show(message, type = 'info', duration = this.defaultDuration) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // Notification styles
    const styles = {
      padding: '15px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minWidth: '300px',
      fontSize: '0.95rem',
      fontFamily: 'inherit',
      animation: 'slideInRight 0.3s ease',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    };

    // Type-specific colors and icons
    const typeConfig = {
      success: {
        bg: '#e8f5e9',
        color: '#2e7d32',
        icon: '✓',
        border: '2px solid #4caf50'
      },
      error: {
        bg: '#ffebee',
        color: '#c62828',
        icon: '✕',
        border: '2px solid #f44336'
      },
      warning: {
        bg: '#fff3e0',
        color: '#ef6c00',
        icon: '⚠',
        border: '2px solid #ff9800'
      },
      info: {
        bg: '#e3f2fd',
        color: '#1565c0',
        icon: 'ℹ',
        border: '2px solid #2196f3'
      }
    };

    const config = typeConfig[type] || typeConfig.info;

    // Apply styles
    Object.assign(notification.style, styles);
    notification.style.backgroundColor = config.bg;
    notification.style.color = config.color;
    notification.style.border = config.border;

    // Create icon
    const icon = document.createElement('span');
    icon.textContent = config.icon;
    icon.style.cssText = `
      font-size: 1.2rem;
      font-weight: bold;
      flex-shrink: 0;
    `;

    // Create message
    const messageElement = document.createElement('span');
    messageElement.textContent = message;
    messageElement.style.flex = '1';

    // Create close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
      flex-shrink: 0;
    `;
    closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';

    // Assemble notification
    notification.appendChild(icon);
    notification.appendChild(messageElement);
    notification.appendChild(closeBtn);

    // Add animation keyframes if not exists
    if (!document.getElementById('notification-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'notification-styles';
      styleSheet.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
        .notification:hover {
          transform: scale(1.02);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
      `;
      document.head.appendChild(styleSheet);
    }

    // Close function
    const close = () => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    };

    // Close on click
    notification.onclick = close;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      close();
    };

    // Add to container
    this.container.appendChild(notification);

    // Auto close after duration
    if (duration > 0) {
      setTimeout(close, duration);
    }

    return notification;
  }

  /**
   * Show success notification
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  /**
   * Show error notification
   */
  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  /**
   * Show warning notification
   */
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Show info notification
   */
  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  /**
   * Show loading notification (doesn't auto-close)
   */
  loading(message = 'Loading...') {
    const notification = this.show(message, 'info', 0);

    // Add spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 16px;
      height: 16px;
      border: 2px solid #1565c0;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    `;

    // Add spinner animation
    if (!document.getElementById('spinner-animation')) {
      const style = document.createElement('style');
      style.id = 'spinner-animation';
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    // Replace icon with spinner
    const icon = notification.querySelector('span');
    icon.replaceWith(spinner);

    return notification;
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Confirm dialog
   */
  confirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      animation: scaleIn 0.3s ease;
    `;

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      margin: 0 0 25px 0;
  font-size: 1.1rem;
  color: #333;
  font-family: inherit;
      line-height: 1.6;
    `;

    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = `
      display: flex;
      gap: 15px;
      justify-content: flex-end;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 10px 20px;
      border: 1px solid #ddd;
      background: #f5f5f5;
      color: #333;
      border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
      font-weight: 600;
      transition: all 0.2s;
    `;
    cancelBtn.onmouseover = () => cancelBtn.style.background = '#e0e0e0';
    cancelBtn.onmouseout = () => cancelBtn.style.background = '#f5f5f5';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.cssText = `
      padding: 10px 20px;
      border: none;
      background: #4caf50;
      color: white;
      border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
      font-weight: 600;
      transition: all 0.2s;
    `;
    confirmBtn.onmouseover = () => confirmBtn.style.background = '#388e3c';
    confirmBtn.onmouseout = () => confirmBtn.style.background = '#4caf50';

    // Add animations
    if (!document.getElementById('dialog-animations')) {
      const style = document.createElement('style');
      style.id = 'dialog-animations';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    const close = () => {
      overlay.style.animation = 'fadeIn 0.2s ease reverse';
      setTimeout(() => document.body.removeChild(overlay), 200);
    };

    cancelBtn.onclick = () => {
      close();
      if (onCancel) onCancel();
    };

    confirmBtn.onclick = () => {
      close();
      if (onConfirm) onConfirm();
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        close();
        if (onCancel) onCancel();
      }
    };

    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(confirmBtn);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonsDiv);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }
}

// Create global notification manager instance
const notify = new NotificationManager();

// Backward compatibility - replace alert with notify
window.showNotification = (message, type = 'success') => {
  notify[type] ? notify[type](message) : notify.info(message);
};
