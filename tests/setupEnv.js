// Global test environment setup for SAS (root)
// Bridge to backend setup when available; define minimal globals for frontend tests.

try {
  // If backend-specific env setup exists, load it to configure DB and server vars
  require('../backend/tests/setupEnv');
} catch (_) {
  // No-op if backend setup not present
}

// Minimal client-side config and helpers used by frontend scripts
if (typeof global.CONFIG === 'undefined') {
  global.CONFIG = {
    API_BASE_URL: 'http://localhost:5001/api',
    PAGINATION: { DEFAULT_PAGE_SIZE: 20 }
  };
}

// Safe notify shim
if (typeof global.notify === 'undefined') {
  const noop = () => ({ remove() {} });
  global.notify = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    confirm: (msg, cb) => cb && cb(),
    loading: () => ({ remove() {} })
  };
}

// Safe authManager shim
if (typeof global.authManager === 'undefined') {
  global.authManager = {
    isAdmin: () => true,
    getAuthHeaders: () => ({}),
    getAuthHeadersForUpload: () => ({}),
    getUser: () => ({ id: 'admin1' }),
    requireAdmin: () => {}
  };
}

// Safe navbarManager shim
if (typeof global.navbarManager === 'undefined') {
  global.navbarManager = { setupNavbar: () => {} };
}

// Simple escapeHtml helper used in UI rendering
if (typeof global.escapeHtml === 'undefined') {
  global.escapeHtml = (s) => String(s).replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// API shim (overridden per-test as needed)
if (typeof global.api === 'undefined') {
  global.api = {
    get: jest.fn(),
    getAdminUsers: jest.fn(),
    bulkUpdateUsers: jest.fn(),
    bulkDeleteUsers: jest.fn(),
    getActivityLogs: jest.fn()
  };
}

// Ensure contact-related API shims exist for frontend tests
global.api.getContactStats = global.api.getContactStats || jest.fn(() => Promise.resolve({ success: true, data: { total: 0, byStatus: {} } }));
global.api.getContacts = global.api.getContacts || jest.fn(() => Promise.resolve({ success: true, data: [], currentPage: 1, totalPages: 1 }));
global.api.getContact = global.api.getContact || jest.fn((id) => Promise.resolve({ success: true, data: { _id: id, name: 'User', email: 'u@example.com', subject: 'Hello', message: 'Hi', status: 'read', createdAt: Date.now() } }));
global.api.markContactAsRead = global.api.markContactAsRead || jest.fn(() => Promise.resolve({ success: true }));
global.api.replyToContact = global.api.replyToContact || jest.fn(() => Promise.resolve({ success: true }));
global.api.archiveContact = global.api.archiveContact || jest.fn(() => Promise.resolve({ success: true }));
global.api.deleteContact = global.api.deleteContact || jest.fn(() => Promise.resolve({ success: true }));
global.api.bulkUpdateContacts = global.api.bulkUpdateContacts || jest.fn(() => Promise.resolve({ success: true }));

// Admin users IDs endpoint shim
global.api.getAdminUserIds = global.api.getAdminUserIds || jest.fn(() => Promise.resolve({ total: 0, ids: [] }));

// utils shim with storage and truncate
if (typeof global.utils === 'undefined') {
  const store = new Map();
  global.utils = {
    truncate: (str, len) => (String(str).length > len ? String(str).slice(0, len - 1) + '…' : String(str)),
    storage: {
      get: (k) => store.get(k),
      set: (k, v) => store.set(k, v),
      remove: (k) => store.delete(k)
    }
  };
}

// Generic API error handler used in admin-users.js
if (typeof global.handleAPIError === 'undefined') {
  global.handleAPIError = (err) => notify.error(err && err.message ? err.message : String(err));
}
