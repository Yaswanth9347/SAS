/**
 * Application Configuration
 * Central configuration for the SAS application
 */

// Resolve API base for split frontend/backend hosting.
// Priority: runtime override (window.__API_BASE_URL__/window.API_BASE_URL), then meta tag, then window origin, then localhost fallback.
const runtimeApiBase = typeof window !== 'undefined' && (window.__API_BASE_URL__ || window.API_BASE_URL);
const metaApiBase = typeof document !== 'undefined'
  ? (document.querySelector('meta[name="api-base-url"]')?.content || null)
  : null;
const originApiBase = typeof window !== 'undefined' && window.location && window.location.origin;
const CONFIG = {
  // API Configuration
  API_BASE_URL: (runtimeApiBase || metaApiBase || originApiBase || 'http://localhost:5001') + '/api',
  
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
  }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
