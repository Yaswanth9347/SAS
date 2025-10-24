# SAS Frontend JavaScript Modules

This directory contains shared JavaScript modules used across the SAS application.

## 📁 Module Overview

### Core Modules (Load in this order)

1. **config.js** - Application configuration constants
2. **utils.js** - Common utility functions
3. **auth.js** - Authentication and session management
4. **api.js** - Centralized API calls
5. **navbar.js** - Navbar setup and management
6. **notifications.js** - User feedback and notifications
7. **loading.js** - Loading states and spinners
8. **app.js** - Application initialization

## 🚀 Usage

### Basic Setup (Add to every HTML page)

```html
<!-- Load modules in order -->
<script src="js/config.js"></script>
<script src="js/utils.js"></script>
<script src="js/auth.js"></script>
<script src="js/api.js"></script>
<script src="js/navbar.js"></script>
<script src="js/notifications.js"></script>
<script src="js/loading.js"></script>
<script src="js/app.js"></script>
```

### Quick Start Examples

#### Authentication
```javascript
// Check if user is logged in
if (!authManager.isAuthenticated()) {
  authManager.requireAuth();
}

// Get current user
const user = authManager.getUser();

// Check if admin
if (authManager.isAdmin()) {
  // Show admin features
}

// Logout
authManager.logout();
```

#### API Calls
```javascript
// Get data
const visits = await api.getVisits();

// Create data
const newVisit = await api.createVisit({
  school: schoolId,
  team: teamId,
  date: visitDate
});

// Update data
await api.updateVisit(visitId, { status: 'completed' });

// Delete data
await api.deleteVisit(visitId);

// Custom API call
const data = await api.get('/custom-endpoint');
```

#### Notifications
```javascript
// Success message
notify.success('Visit created successfully!');

// Error message
notify.error('Failed to load data');

// Warning message
notify.warning('Please fill all required fields');

// Info message
notify.info('Processing your request...');

// Loading notification
const loader = notify.loading('Uploading files...');
// ... do work ...
loader.click(); // Close it

// Confirmation dialog
notify.confirm(
  'Are you sure you want to delete this visit?',
  () => {
    // User clicked Confirm
    deleteVisit();
  },
  () => {
    // User clicked Cancel
    console.log('Cancelled');
  }
);
```

#### Loading States
```javascript
// Show loading in element
loading.show('content-div', 'Loading visits...');
// ... fetch data ...
loading.hide('content-div');

// Full page loading
loading.showFullPage('Please wait...');
// ... do work ...
loading.hideFullPage();

// Skeleton loaders
loading.showSkeleton('visits-list', 5, 'card');

// Button loading
loading.showButtonLoading('submit-btn', 'Saving...');
// ... save data ...
loading.hideButtonLoading('submit-btn');

// Progress bar
loading.showProgress('upload-area', 0);
// ... during upload ...
loading.showProgress('upload-area', 50);
loading.showProgress('upload-area', 100);
loading.hideProgress('upload-area');
```

#### Utilities
```javascript
// Date formatting
utils.formatDate(new Date(), 'long'); // "October 22, 2025"
utils.formatDateForInput(new Date()); // "2025-10-22"
utils.timeAgo(someDate); // "2 hours ago"

// Validation
if (!utils.isValidEmail(email)) {
  notify.error('Invalid email format');
}

if (!utils.isValidPhone(phone)) {
  notify.error('Invalid phone number');
}

// File handling
const size = utils.formatFileSize(1024000); // "1 MB"

// Text manipulation
const short = utils.truncate(longText, 100); // Truncate to 100 chars
const capitalized = utils.capitalize('hello'); // "Hello"

// Export to CSV
utils.exportToCSV(dataArray, 'visits-report.csv');

// Debounce function
const debouncedSearch = utils.debounce((query) => {
  searchAPI(query);
}, 500);

// Storage helpers
utils.storage.set('key', { data: 'value' });
const data = utils.storage.get('key');
```

#### Navbar
```javascript
// Setup navbar (automatically called by app.js)
navbarManager.setupNavbar();

// Manual active page highlight
navbarManager.setActivePage('dashboard.html');
```

## 🔧 Configuration

Edit `config.js` to customize:

```javascript
const CONFIG = {
  API_BASE_URL: 'http://localhost:5001/api', // Change for production
  FILE_UPLOAD: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
  },
  // ... more settings
};
```

## 🎯 Migration Guide

### Old Code → New Code

#### Authentication
```javascript
// ❌ Old
const token = localStorage.getItem('token');
if (!token) {
  alert('Please login');
  window.location.href = 'login.html';
}

// ✅ New
authManager.requireAuth();
```

#### API Calls
```javascript
// ❌ Old
const response = await fetch('/api/visits', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();

// ✅ New
const data = await api.getVisits();
```

#### Notifications
```javascript
// ❌ Old
alert('Success!');

// ✅ New
notify.success('Success!');
```

#### Date Formatting
```javascript
// ❌ Old
new Date(date).toLocaleDateString();

// ✅ New
utils.formatDate(date);
```

## 📝 Module Details

### config.js
- Application-wide constants
- API base URL
- File upload limits
- Status and role enums

### utils.js
- Date formatting functions
- Validation helpers
- Text manipulation
- File utilities
- Storage helpers
- Export functions

### auth.js
- Token management
- User session handling
- Authentication checks
- Authorization headers
- Logout functionality

### api.js
- Centralized API calls
- Automatic auth headers
- Error handling
- REST methods (GET, POST, PUT, DELETE)
- File upload handling

### navbar.js
- Dynamic navbar setup
- Admin menu injection
- Active page highlighting
- User display

### notifications.js
- Toast notifications
- Confirmation dialogs
- Success/Error/Warning/Info messages
- Loading indicators
- Auto-dismiss timers

### loading.js
- Loading overlays
- Spinners
- Skeleton loaders
- Progress bars
- Button loading states

### app.js
- Global initialization
- Error handlers
- Helper functions
- Utility wrappers

## 🐛 Debugging

Enable debug mode in console:
```javascript
localStorage.setItem('debug', 'true');
```

## 📦 Benefits

- **Code Reusability**: Write once, use everywhere
- **Consistency**: Unified UI/UX patterns
- **Maintainability**: Update in one place
- **Error Handling**: Centralized error management
- **Type Safety**: JSDoc comments for better IDE support
- **Performance**: Shared instances, no duplication

## 🔄 Update All Pages

To migrate existing pages, replace inline code with module calls. See examples above.

---

**Version**: 1.0.0  
**Last Updated**: October 22, 2025
