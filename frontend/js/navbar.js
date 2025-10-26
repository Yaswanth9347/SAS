/**
 * Navbar Manager
 * Handles navbar setup, user display, and dynamic menu items
 */

class NavbarManager {
  constructor() {
    this.navMenu = null;
    this.navUser = null;
    this.hamburger = null;
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

    // Setup mobile hamburger menu
    this.setupHamburgerMenu();

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
          
          // Close mobile menu on navigation
          this.closeMobileMenu();
          
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
   * Setup mobile hamburger menu toggle
   */
  setupHamburgerMenu() {
    // Check if hamburger already exists
    this.hamburger = document.querySelector('.hamburger');
    
    if (!this.hamburger) {
      // Create hamburger menu element
      const navContainer = document.querySelector('.nav-container');
      if (!navContainer) return;
      
      this.hamburger = document.createElement('div');
      this.hamburger.className = 'hamburger';
      this.hamburger.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
      `;
      
      // Insert hamburger before the nav menu
      navContainer.appendChild(this.hamburger);
    }
    
    // Add click event listener
    this.hamburger.addEventListener('click', () => this.toggleMobileMenu());
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-container') && this.navMenu.classList.contains('active')) {
        this.closeMobileMenu();
      }
    });
  }

  /**
   * Toggle mobile menu open/close
   */
  toggleMobileMenu() {
    this.hamburger.classList.toggle('active');
    this.navMenu.classList.toggle('active');
    
    // Prevent body scroll when menu is open
    if (this.navMenu.classList.contains('active')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  /**
   * Close mobile menu
   */
  closeMobileMenu() {
    this.hamburger?.classList.remove('active');
    this.navMenu?.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Update user display in navbar
   */
  updateUserDisplay() {
    if (this.navUser) {
      const user = authManager.getUser();
      const userName = user?.name || user?.username || 'User';
      
      // Create avatar element
      const avatarHTML = this.createAvatarHTML(user);
      
      // Update navbar user display with avatar + name
      this.navUser.innerHTML = `
        ${avatarHTML}
        <span class="nav-user-name">Welcome, ${userName}</span>
      `;
    }
  }

  /**
   * Create avatar HTML with fallback to initials
   */
  createAvatarHTML(user) {
    if (!user) {
      return '<div class="nav-avatar"><span>?</span></div>';
    }

    const avatarUrl = user.avatar;
    
    if (avatarUrl) {
      // User has avatar - display image
      return `
        <div class="nav-avatar">
          <img src="${avatarUrl}" alt="${user.name || user.username}" 
               onerror="this.parentElement.innerHTML='<span>${this.getInitials(user)}</span>'">
        </div>
      `;
    } else {
      // No avatar - display initials
      const initials = this.getInitials(user);
      return `<div class="nav-avatar"><span>${initials}</span></div>`;
    }
  }

  /**
   * Get user initials from name or username
   */
  getInitials(user) {
    if (!user) return '?';
    
    const name = user.name || user.username || '?';
    const parts = name.trim().split(/\s+/);
    
    if (parts.length >= 2) {
      // First name + Last name initials
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else {
      // Single name - first 2 letters
      return name.substring(0, 2).toUpperCase();
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
