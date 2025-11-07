/**
 * Application Configuration
 * Central configuration for the SAS application
 * Supports development and production environments
 */

// Environment detection
const isProduction = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  
  // Production indicators
  return (
    hostname.includes('onrender.com') ||
    hostname.includes('render.com') ||
    hostname.includes('herokuapp.com') ||
    hostname.includes('vercel.app') ||
    hostname.includes('netlify.app') ||
    (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && hostname !== '')
  );
};

// Get API base URL based on environment
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5001/api';
  }
  
  // Production environment - use environment variable or current origin
  if (isProduction()) {
    // Check if REACT_APP_API_URL is defined (for build-time configuration)
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL;
    }
    
    // If backend and frontend are on same domain (recommended for Render)
    // This works when both are served from the same Render service
    return window.location.origin + '/api';
    
    // Alternative: If backend is on different subdomain/domain, uncomment and configure:
    // return 'https://your-backend.onrender.com/api';
  }
  
  // Development environment - use localhost
  return window.location.origin + '/api';
};

const CONFIG = {
  // Environment
  IS_PRODUCTION: isProduction(),
  
  // API Configuration
  API_BASE_URL: getApiBaseUrl(),
  
  // Storage Keys
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER: 'user',
    PREFERENCES: 'preferences'
  },
  
  // Gallery Settings
  GALLERY: {
    AUTO_SCROLL_INTERVAL: 5000, // 5 seconds
    DESKTOP_HEIGHT: 600,
    MOBILE_HEIGHT: 400,
    MAX_WIDTH: 1400
  },
  
  // File Upload Settings
  FILE_UPLOAD: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/quicktime']
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
  },
  
  // Status Options
  VISIT_STATUS: {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  // Role Options
  USER_ROLES: {
    ADMIN: 'admin',
    VOLUNTEER: 'volunteer'
  },
  
  // Debug mode (only in development)
  DEBUG: !isProduction()
};

// Log configuration in development
if (CONFIG.DEBUG) {
  console.log('🔧 App Configuration:', {
    environment: CONFIG.IS_PRODUCTION ? 'production' : 'development',
    apiBaseUrl: CONFIG.API_BASE_URL,
    hostname: window.location.hostname
  });
}

// Freeze config to prevent modifications
Object.freeze(CONFIG);
