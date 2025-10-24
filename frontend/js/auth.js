/**
 * Authentication Utilities
 * Handles authentication, user session, and token management
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    this.user = this.getUser();
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
  setAuth(token, user) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
    this.token = token;
    this.user = user;
  }

  /**
   * Clear authentication data
   */
  clearAuth() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    this.token = null;
    this.user = null;
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
   * Handle logout button click
   */
  setupLogoutButton(buttonId = 'navLogout') {
    const logoutBtn = document.getElementById(buttonId);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
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
