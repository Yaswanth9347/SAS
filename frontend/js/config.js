/**
 * Application Configuration
 * Central configuration for the SAS application
 */

const CONFIG = {
  // API Configuration
  // Prefer current origin at runtime; fallback to 5002 for local dev
  API_BASE_URL: (typeof window !== 'undefined' && window.location && window.location.origin
    ? window.location.origin
    : 'http://localhost:5002') + '/api',
  
  // Storage Keys
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER: 'user'
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
