/**
 * Authentication Utilities
 * Handles authentication, user session, and token management
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    this.user = this.getUser();
    this.serverInstanceId = localStorage.getItem('serverInstanceId');
    
    // Check server instance on initialization (detects server restart)
    this.checkServerInstance();
  }

  /**
   * Check if server has restarted by verifying instance ID
   * If server restarted, automatically logout user
   */
  async checkServerInstance() {
    // Only check if user is logged in
    if (!this.isAuthenticated()) {
      return;
    }

    try {
      // Make a lightweight API call to get current server instance ID
      const response = await fetch('/api/test', {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const currentInstanceId = data.serverInstanceId;
        
        // If we have a stored instance ID and it doesn't match current, server restarted
        if (this.serverInstanceId && currentInstanceId && this.serverInstanceId !== currentInstanceId) {
          console.log('🔄 Server restart detected. Logging out for security...');
          this.clearAuth();
          alert('Server was restarted. Please log in again.');
          window.location.href = 'login.html';
          return;
        }
        
        // Store/update the current instance ID
        if (currentInstanceId) {
          localStorage.setItem('serverInstanceId', currentInstanceId);
          this.serverInstanceId = currentInstanceId;
        }
      }
    } catch (error) {
      console.error('Error checking server instance:', error);
      // Don't logout on network errors, only on instance mismatch
    }
  }

  /**
   * Validate server instance ID from API response
   * Call this after every API request to detect server restarts
   */
  validateServerInstance(responseData) {
    if (!responseData || typeof responseData !== 'object') {
      return true; // No data to validate
    }

    const currentInstanceId = responseData.serverInstanceId;
    
    // If response has instance ID, validate it
    if (currentInstanceId) {
      // If we have a stored instance ID and it doesn't match, server restarted
      if (this.serverInstanceId && this.serverInstanceId !== currentInstanceId) {
        console.log('🔄 Server restart detected. Logging out for security...');
        this.clearAuth();
        alert('Server was restarted. Please log in again.');
        window.location.href = 'login.html';
        return false;
      }
      
      // Update stored instance ID
      localStorage.setItem('serverInstanceId', currentInstanceId);
      this.serverInstanceId = currentInstanceId;
    }
    
    return true;
  }

  /**
   * Get stored token
   */
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  }

  /**
   * Get stored user object
   */
  getUser() {
    try {
      const userStr = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  /**
   * Set authentication data
   */
  setAuth(token, user, serverInstanceId = null) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
    this.token = token;
    this.user = user;
    
    // Store server instance ID if provided
    if (serverInstanceId) {
      localStorage.setItem('serverInstanceId', serverInstanceId);
      this.serverInstanceId = serverInstanceId;
    }
  }

  /**
   * Clear authentication data
   */
  clearAuth() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    localStorage.removeItem('serverInstanceId');
    this.token = null;
    this.user = null;
    this.serverInstanceId = null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    const user = this.getUser();
    return user && user.role === CONFIG.USER_ROLES.ADMIN;
  }

  /**
   * Require authentication - redirect to login if not authenticated
   */
  requireAuth(message = 'Please login to access this page.') {
    if (!this.isAuthenticated()) {
      alert(message);
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  /**
   * Require admin role - redirect to dashboard if not admin
   */
  requireAdmin(message = 'Access denied. Admin privileges required.') {
    if (!this.requireAuth()) return false;
    
    if (!this.isAdmin()) {
      alert(message);
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  }

  /**
   * Logout user
   */
  logout() {
    this.clearAuth();
    window.location.href = 'login.html';
  }

  /**
   * Logout with a short visual delay (allows button animation)
   */
  logoutWithDelay(delayMs = 220) {
    this.clearAuth();
    setTimeout(() => {
      window.location.href = 'login.html';
    }, Math.max(0, delayMs));
  }

  /**
   * Handle logout button click
   */
  setupLogoutButton(buttonId = 'navLogout') {
    const logoutBtn = document.getElementById(buttonId);
    if (logoutBtn) {
      // Ensure initial state variables for animation
      const applyState = (state) => {
        if (!state) return;
        for (const key in state) {
          logoutBtn.style.setProperty(key, state[key]);
        }
      };

      const STATES = {
        'default': {
          '--figure-duration': '100', '--transform-figure': 'none', '--walking-duration': '100',
          '--transform-arm1': 'none', '--transform-wrist1': 'none', '--transform-arm2': 'none', '--transform-wrist2': 'none',
          '--transform-leg1': 'none', '--transform-calf1': 'none', '--transform-leg2': 'none', '--transform-calf2': 'none'
        },
        'hover': {
          '--figure-duration': '100', '--transform-figure': 'translateX(1.5px)', '--walking-duration': '100',
          '--transform-arm1': 'rotate(-5deg)', '--transform-wrist1': 'rotate(-15deg)', '--transform-arm2': 'rotate(5deg)', '--transform-wrist2': 'rotate(6deg)',
          '--transform-leg1': 'rotate(-10deg)', '--transform-calf1': 'rotate(5deg)', '--transform-leg2': 'rotate(20deg)', '--transform-calf2': 'rotate(-20deg)'
        },
        'walking1': {
          '--figure-duration': '300', '--transform-figure': 'translateX(11px)', '--walking-duration': '300',
          '--transform-arm1': 'translateX(-4px) translateY(-2px) rotate(120deg)', '--transform-wrist1': 'rotate(-5deg)',
          '--transform-arm2': 'translateX(4px) rotate(-110deg)', '--transform-wrist2': 'rotate(-5deg)', '--transform-leg1': 'translateX(-3px) rotate(80deg)',
          '--transform-calf1': 'rotate(-30deg)', '--transform-leg2': 'translateX(4px) rotate(-60deg)', '--transform-calf2': 'rotate(20deg)'
        },
        'walking2': {
          '--figure-duration': '400', '--transform-figure': 'translateX(17px)', '--walking-duration': '300',
          '--transform-arm1': 'rotate(60deg)', '--transform-wrist1': 'rotate(-15deg)', '--transform-arm2': 'rotate(-45deg)', '--transform-wrist2': 'rotate(6deg)',
          '--transform-leg1': 'rotate(-5deg)', '--transform-calf1': 'rotate(10deg)', '--transform-leg2': 'rotate(10deg)', '--transform-calf2': 'rotate(-20deg)'
        },
        'falling1': {
          '--figure-duration': '1600', '--walking-duration': '400', '--transform-arm1': 'rotate(-60deg)', '--transform-wrist1': 'none',
          '--transform-arm2': 'rotate(30deg)', '--transform-wrist2': 'rotate(120deg)', '--transform-leg1': 'rotate(-30deg)', '--transform-calf1': 'rotate(-20deg)', '--transform-leg2': 'rotate(20deg)'
        },
        'falling2': {
          '--walking-duration': '300', '--transform-arm1': 'rotate(-100deg)', '--transform-arm2': 'rotate(-60deg)', '--transform-wrist2': 'rotate(60deg)',
          '--transform-leg1': 'rotate(80deg)', '--transform-calf1': 'rotate(20deg)', '--transform-leg2': 'rotate(-60deg)'
        },
        'falling3': {
          '--walking-duration': '500', '--transform-arm1': 'rotate(-30deg)', '--transform-wrist1': 'rotate(40deg)', '--transform-arm2': 'rotate(50deg)', '--transform-wrist2': 'none',
          '--transform-leg1': 'rotate(-30deg)', '--transform-leg2': 'rotate(20deg)', '--transform-calf2': 'none'
        }
      };

      // Hover state updates (purely visual)
      logoutBtn.addEventListener('mouseenter', () => applyState(STATES['hover']));
      logoutBtn.addEventListener('mouseleave', () => applyState(STATES['default']));

      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Start animation sequence only once
        if (!logoutBtn.dataset.animating) {
          logoutBtn.dataset.animating = '1';

          // Sequence: walking1 -> walking2 -> falling1 -> falling2 -> falling3
          logoutBtn.classList.add('clicked');
          applyState(STATES['walking1']);
          setTimeout(() => {
            logoutBtn.classList.add('door-slammed');
            applyState(STATES['walking2']);
            setTimeout(() => {
              logoutBtn.classList.add('falling');
              applyState(STATES['falling1']);
              setTimeout(() => {
                applyState(STATES['falling2']);
                setTimeout(() => {
                  applyState(STATES['falling3']);
                }, parseInt(STATES['falling2']['--walking-duration']) || 300);
              }, parseInt(STATES['falling1']['--walking-duration']) || 400);
            }, parseInt(STATES['walking2']['--figure-duration']) || 400);
          }, parseInt(STATES['walking1']['--figure-duration']) || 300);

          // Clear auth immediately for correctness/tests; redirect after ~1200ms so animation is visible
          this.logoutWithDelay(1200);
        }
      }, { passive: false });
    }
  }

  /**
   * Get authorization headers for API requests
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * Get authorization headers for file uploads (no Content-Type)
   */
  getAuthHeadersForUpload() {
    const headers = {};
    
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }
}

// Create global auth manager instance
const authManager = new AuthManager();
