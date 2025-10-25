/**
 * Navbar Manager
 * Handles navbar setup, user display, and dynamic menu items
 */

class NavbarManager {
  constructor() {
    this.navMenu = null;
    this.navUser = null;
    this.currentPage = this.getCurrentPage();
  }

  /**
   * Get current page name from URL
   */
  getCurrentPage() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1);
    return page || 'index.html';
  }

  /**
   * Setup complete navbar with dynamic menu items
   */
  setupNavbar() {
    this.navMenu = document.getElementById('navMenu');
    this.navUser = document.getElementById('navUser');

    if (!this.navMenu) {
      console.warn('Navbar menu element not found');
      return;
    }

    // Update user display
    this.updateUserDisplay();

    // Remove public Contact link from the main navbar — Contact will be reachable from About page only
    try {
      const contactAnchors = this.navMenu.querySelectorAll('a[href="contact.html"]');
      contactAnchors.forEach(a => {
        const li = a.closest('li');
        if (li) li.remove();
      });
    } catch (e) {
      // non-fatal
    }

    // Add admin menu items if user is admin
    if (authManager.isAdmin()) {
      this.addAdminMenuItems();
    }

    // Highlight active page
    this.highlightActivePage();

    // Setup logout button
    authManager.setupLogoutButton('navLogout');

    // Ensure nav link clicks behave correctly (workaround for any unexpected handlers)
    // This makes sure clicking the Contact link always navigates to the correct page
    try {
      this.navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.removeEventListener('click', link._navHandler);
        const handler = (ev) => {
          // allow logout / special links to behave normally
          if (link.classList.contains('logout-btn')) return;
          const href = link.getAttribute('href');
          if (!href || href === '#') return;
          ev.preventDefault();
          ev.stopPropagation();
          window.location.href = href;
        };
        link.addEventListener('click', handler);
        link._navHandler = handler;
      });
    } catch (e) {
      console.warn('Nav link fixup failed', e);
    }
  }

  /**
   * Update user display in navbar
   */
  updateUserDisplay() {
    if (this.navUser) {
      const user = authManager.getUser();
      this.navUser.textContent = `Welcome, ${user?.name || user?.username || 'User'}`;
    }
  }

  /**
   * Add admin-only menu items
   */
  addAdminMenuItems() {
    if (!this.navMenu) return;

    const userNameLi = this.navUser?.parentElement;
    if (!userNameLi) return;

    // Check if admin menu items already exist
    const existingAdminLink = this.navMenu.querySelector('a[href="analytics.html"]');
    if (existingAdminLink) {
      console.log('Admin menu items already added');
      return;
    }

    // Admin menu items configuration
    const adminMenuItems = [
      { href: 'schools.html', label: 'Schools' },
      { href: 'analytics.html', label: 'Analytics' },
      { href: 'reports.html', label: 'Reports' }
    ];

    // Insert admin menu items before user display
    adminMenuItems.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="${item.href}" class="nav-link">${item.label}</a>`;
      this.navMenu.insertBefore(li, userNameLi);
    });
  }

  /**
   * Highlight the active page in navbar
   */
  highlightActivePage() {
    if (!this.navMenu) return;

    const links = this.navMenu.querySelectorAll('.nav-link');
    links.forEach(link => {
      link.classList.remove('active');
      
      const href = link.getAttribute('href');
      if (href === this.currentPage) {
        link.classList.add('active');
      }
    });
  }

  /**
   * Update navbar for specific page (if needed)
   */
  setActivePage(pageName) {
    const links = this.navMenu?.querySelectorAll('.nav-link');
    links?.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === pageName) {
        link.classList.add('active');
      }
    });
  }
}

// Create global navbar manager instance
const navbarManager = new NavbarManager();

/**
 * Legacy function for backward compatibility
 */
function setupNavbar() {
  navbarManager.setupNavbar();
}
