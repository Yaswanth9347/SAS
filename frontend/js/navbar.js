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

    // Remove direct Profile/Settings/Users links from main navbar (will live under kebab menu)
    try {
      const toRemove = ['profile.html', 'settings.html', 'admin-users.html'];
      toRemove.forEach(href => {
        this.navMenu.querySelectorAll(`a[href="${href}"]`).forEach(a => {
          const li = a.closest('li');
          if (li) li.remove();
        });
      });
    } catch (e) {
      // non-fatal
    }

    // Ensure notification bell for authenticated users
    if (authManager.isAuthenticated()) {
      this.ensureNotificationBell();
    }

    // Ensure kebab (three-dots) menu on the right with Profile/Users/Settings
    this.ensureKebabMenu();

    // Highlight active page
    this.highlightActivePage();
    // Set aria-current on active link for screen readers
    try {
      const current = this.getCurrentPage();
      this.navMenu.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        link.removeAttribute('aria-current');
        if (href === current) link.setAttribute('aria-current', 'page');
      });
    } catch(e){}

    // Setup logout button
    authManager.setupLogoutButton('navLogout');
  // Replace logout text with icon (door exit), keeping accessibility
  this.ensureLogoutIcon();

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
   * Replace the Logout button text with an accessible door-exit icon
   */
  ensureLogoutIcon() {
    const logout = document.getElementById('navLogout');
    if (!logout) return;

    // Ensure classes and a11y labels
    logout.classList.add('logout-btn', 'logoutButton', 'logoutButton--dark');
    if (!logout.getAttribute('aria-label')) logout.setAttribute('aria-label', 'Logout');
    logout.setAttribute('title', 'Logout');

    // Replace content with animated doorway/figure/door and text
    const content = `
      <svg class="doorway" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path d="M93.4 86.3H58.6c-1.9 0-3.4-1.5-3.4-3.4V17.1c0-1.9 1.5-3.4 3.4-3.4h34.8c1.9 0 3.4 1.5 3.4 3.4v65.8c0 1.9-1.5 3.4-3.4 3.4z"></path>
        <path class="bang" d="M40.5 43.7L26.6 31.4l-2.5 6.7zM41.9 50.4l-19.5-4-1.4 6.3zM40 57.4l-17.7 3.9 3.9 5.7z"></path>
      </svg>
      <svg class="figure" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="52.1" cy="32.4" r="6.4"></circle>
        <path d="M50.7 62.8c-1.2 2.5-3.6 5-7.2 4-3.2-.9-4.9-3.5-4-7.8.7-3.4 3.1-13.8 4.1-15.8 1.7-3.4 1.6-4.6 7-3.7 4.3.7 4.6 2.5 4.3 5.4-.4 3.7-2.8 15.1-4.2 17.9z"></path>
        <g class="arm1">
          <path d="M55.5 56.5l-6-9.5c-1-1.5-.6-3.5.9-4.4 1.5-1 3.7-1.1 4.6.4l6.1 10c1 1.5.3 3.5-1.1 4.4-1.5.9-3.5.5-4.5-.9z"></path>
          <path class="wrist1" d="M69.4 59.9L58.1 58c-1.7-.3-2.9-1.9-2.6-3.7.3-1.7 1.9-2.9 3.7-2.6l11.4 1.9c1.7.3 2.9 1.9 2.6 3.7-.4 1.7-2 2.9-3.8 2.6z"></path>
        </g>
        <g class="arm2">
          <path d="M34.2 43.6L45 40.3c1.7-.6 3.5.3 4 2 .6 1.7-.3 4-2 4.5l-10.8 2.8c-1.7.6-3.5-.3-4-2-.6-1.6.3-3.4 2-4z"></path>
          <path class="wrist2" d="M27.1 56.2L32 45.7c.7-1.6 2.6-2.3 4.2-1.6 1.6.7 2.3 2.6 1.6 4.2L33 58.8c-.7 1.6-2.6 2.3-4.2 1.6-1.7-.7-2.4-2.6-1.7-4.2z"></path>
        </g>
        <g class="leg1">
          <path d="M52.1 73.2s-7-5.7-7.9-6.5c-.9-.9-1.2-3.5-.1-4.9 1.1-1.4 3.8-1.9 5.2-.9l7.9 7c1.4 1.1 1.7 3.5.7 4.9-1.1 1.4-4.4 1.5-5.8.4z"></path>
          <path class="calf1" d="M52.6 84.4l-1-12.8c-.1-1.9 1.5-3.6 3.5-3.7 2-.1 3.7 1.4 3.8 3.4l1 12.8c.1 1.9-1.5 3.6-3.5 3.7-2 0-3.7-1.5-3.8-3.4z"></path>
        </g>
        <g class="leg2">
          <path d="M37.8 72.7s1.3-10.2 1.6-11.4 2.4-2.8 4.1-2.6c1.7.2 3.6 2.3 3.4 4l-1.8 11.1c-.2 1.7-1.7 3.3-3.4 3.1-1.8-.2-4.1-2.4-3.9-4.2z"></path>
          <path class="calf2" d="M29.5 82.3l9.6-10.9c1.3-1.4 3.6-1.5 5.1-.1 1.5 1.4.4 4.9-.9 6.3l-8.5 9.6c-1.3 1.4-3.6 1.5-5.1.1-1.4-1.3-1.5-3.5-.2-5z"></path>
        </g>
      </svg>
      <svg class="door" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path d="M93.4 86.3H58.6c-1.9 0-3.4-1.5-3.4-3.4V17.1c0-1.9 1.5-3.4 3.4-3.4h34.8c1.9 0 3.4 1.5 3.4 3.4v65.8c0 1.9-1.5 3.4-3.4 3.4z"></path>
        <circle cx="66" cy="50" r="3.7"></circle>
      </svg>
      <span class="button-text">Log Out</span>
    `;

    logout.innerHTML = content;
    // Let CSS drive layout/styling
    logout.style.removeProperty('display');
    logout.style.removeProperty('alignItems');
    logout.style.removeProperty('justifyContent');
    logout.style.removeProperty('gap');
    logout.style.removeProperty('padding');
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
      this.hamburger.setAttribute('role', 'button');
      this.hamburger.setAttribute('tabindex', '0');
      this.hamburger.setAttribute('aria-label', 'Toggle navigation menu');
      this.hamburger.setAttribute('aria-expanded', 'false');
      
      // Insert hamburger before the nav menu
      navContainer.appendChild(this.hamburger);
    }
    
    // Add click and keyboard event listeners
    this.hamburger.addEventListener('click', () => this.toggleMobileMenu());
    this.hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleMobileMenu();
      }
    });
    
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
    const expanded = this.navMenu.classList.contains('active');
    this.hamburger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    
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

    // Support both `profileImage` (server) and legacy `avatar` property
    const avatarUrl = user.profileImage || user.avatar;

    if (avatarUrl) {
      // User has avatar - display image
      return `
        <div class="nav-avatar">
          <img src="${avatarUrl}" alt="${user.name || user.username}" 
               onerror="this.parentElement.innerHTML='<span>${this.getInitials(user)}</span>'" />
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

    // Admin menu items configuration (Users moved into kebab menu)
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
   * Ensure kebab (three-dots) dropdown exists with Profile, Users (admin), Settings
   */
  ensureKebabMenu() {
    if (!this.navMenu) return;

    // If it exists, rebuild items based on current auth state
    let existing = this.navMenu.querySelector('#navMore');
    let dropdown;
    let li;

    // Determine anchor point to insert before (prefer logout button li, else before user li, else append)
    const logoutLi = this.navMenu.querySelector('#navLogout')?.closest('li') || null;
    const userNameLi = this.navUser?.parentElement || null;

    if (!existing) {
      li = document.createElement('li');
      li.style.position = 'relative';
      li.innerHTML = `
        <button id="navMore" class="nav-link" aria-label="More options" aria-haspopup="true" aria-expanded="false" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <span aria-hidden="true" style="font-size:20px;line-height:1">⋮</span>
        </button>
        <div id="moreDropdown" class="more-dropdown" role="menu" aria-label="More" style="display:none;position:absolute;right:0;top:100%;margin-top:8px;z-index:1100;background:#fff;color:#333;min-width:180px;box-shadow:0 6px 24px rgba(0,0,0,0.2);border-radius:8px;overflow:hidden;">
          <div class="more-list" style="display:flex;flex-direction:column;">
          </div>
        </div>
      `;
      // Place kebab AFTER the Logout button (kebab becomes rightmost)
      if (logoutLi) this.navMenu.insertBefore(li, logoutLi.nextSibling);
      else if (userNameLi) this.navMenu.insertBefore(li, userNameLi.nextSibling);
      else this.navMenu.appendChild(li);
      existing = li.querySelector('#navMore');
      dropdown = li.querySelector('#moreDropdown');
    } else {
      li = existing.closest('li');
      dropdown = li.querySelector('#moreDropdown');
      // Ensure position: kebab AFTER the Logout button
      if (logoutLi) this.navMenu.insertBefore(li, logoutLi.nextSibling);
    }

    const listEl = li.querySelector('.more-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    // Build items based on auth/role
    const items = [];
    if (authManager.isAuthenticated()) {
      items.push({ href: 'profile.html', label: 'Profile' });
    }
    if (authManager.isAdmin()) {
      items.push({ href: 'admin-users.html', label: 'Users' });
    }
    if (authManager.isAuthenticated()) {
      items.push({ href: 'settings.html', label: 'Settings' });
    }

    // Render items
    if (!items.length) {
      // If no items, remove kebab entirely
      li.remove();
      return;
    }

    listEl.innerHTML = items.map(it => `
      <a href="${it.href}" class="nav-link" role="menuitem" style="padding:10px 12px;text-decoration:none;color:#333;white-space:nowrap;">${it.label}</a>
    `).join('');

    // Toggle behavior
    const toggle = (show) => {
      const willShow = typeof show === 'boolean' ? show : dropdown.style.display === 'none';
      dropdown.style.display = willShow ? 'block' : 'none';
      existing.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    };

    existing._moreHandler && existing.removeEventListener('click', existing._moreHandler);
    const clickHandler = (e) => { e.preventDefault(); toggle(); };
    existing.addEventListener('click', clickHandler);
    existing._moreHandler = clickHandler;

    existing._keyHandler && existing.removeEventListener('keydown', existing._keyHandler);
    const keyHandler = (e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); toggle(); } if (e.key==='Escape') toggle(false); };
    existing.addEventListener('keydown', keyHandler);
    existing._keyHandler = keyHandler;

    // Close on outside click
    document._moreOutside && document.removeEventListener('click', document._moreOutside);
    const outside = (e) => { if (!li.contains(e.target)) toggle(false); };
    document.addEventListener('click', outside);
    document._moreOutside = outside;
  }

  /**
   * Ensure a Settings menu item exists for authenticated users
   */
  ensureSettingsLink() {
    if (!this.navMenu) return;
    const existing = this.navMenu.querySelector('a[href="settings.html"]');
    if (existing) return;

    // Insert Settings before user display (navUser li)
    const userNameLi = this.navUser?.parentElement;
    if (!userNameLi) return;
    const li = document.createElement('li');
    li.innerHTML = '<a href="settings.html" class="nav-link">Settings</a>';
    this.navMenu.insertBefore(li, userNameLi);
  }

  ensureNotificationBell() {
    if (!this.navMenu) return;
    if (this.navMenu.querySelector('#navNotifications')) return;

    const userNameLi = this.navUser?.parentElement;
    if (!userNameLi) return;

    const li = document.createElement('li');
    li.innerHTML = `
      <button id="navNotifications" class="nav-link notif-btn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false" style="position:relative;background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">
        <span class="notif-bell" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;">
          <svg class="bell-svg" width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path class="bell-body" d="M24 6c-6.6 0-12 5.4-12 12v6.5c0 1.9-.8 3.7-2.2 5l-1.7 1.6c-.7.6-.3 1.9.6 1.9H39c.9 0 1.3-1.2.6-1.9l-1.7-1.6c-1.4-1.3-2.2-3.1-2.2-5V18c0-6.6-5.4-12-12-12Z" stroke="currentColor" stroke-width="2"/>
            <path class="bell-clapper" d="M20 37a4 4 0 0 0 8 0" stroke="currentColor" stroke-width="2"/>
            <circle class="clapper" cx="24" cy="36" r="2.2" fill="currentColor" />
          </svg>
        </span>
        <span id="notifCount" class="notif-count" style="position:absolute;top:-6px;right:-6px;background:#e53935;color:#fff;border-radius:10px;padding:1px 6px;font-size:12px;display:none;">0</span>
      </button>
      <div id="notifDropdown" class="notif-dropdown" role="menu" aria-label="Notifications" style="display:none;position:absolute;right:0;z-index:1100;background:#fff;color:#333;min-width:320px;max-width:380px;box-shadow:0 6px 24px rgba(0,0,0,0.2);border-radius:8px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #eee;">
          <strong>Notifications</strong>
          <button id="notifMarkAll" class="btn" style="padding:6px 10px;font-size:12px;">Mark all read</button>
        </div>
        <div id="notifList" style="max-height:360px;overflow:auto;">
          <div style="padding:12px;color:#666;">Loading...</div>
        </div>
        <div style="padding:8px 12px;border-top:1px solid #eee;text-align:right;">
          <a href="notifications.html" class="nav-link" style="color:#3f51b5;">View all</a>
        </div>
      </div>
    `;

    this.navMenu.insertBefore(li, userNameLi);

    const btn = li.querySelector('#navNotifications');
    const dropdown = li.querySelector('#notifDropdown');
    const listEl = li.querySelector('#notifList');
    const countEl = li.querySelector('#notifCount');
    const markAllBtn = li.querySelector('#notifMarkAll');

    const toggle = (show) => {
      const willShow = typeof show === 'boolean' ? show : dropdown.style.display === 'none';
      dropdown.style.display = willShow ? 'block' : 'none';
      btn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
      if (willShow) this.loadNotifications(listEl, countEl);
    };

    btn.addEventListener('click', () => toggle());
    btn.addEventListener('keydown', (e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); toggle(); } });
    document.addEventListener('click', (e) => { if (!li.contains(e.target)) dropdown.style.display='none'; });
    markAllBtn.addEventListener('click', async () => {
      try { await api.markAllNotificationsRead(); this.loadNotifications(listEl, countEl); } catch(e){ handleAPIError(e); }
    });
  }

  async loadNotifications(listEl, countEl) {
    try {
      const res = await api.getNotifications({ page: 1, limit: 10 });
      const items = res?.data || [];
      const unread = items.filter(i => !i.read).length;
      countEl.style.display = unread ? 'inline-block' : 'none';
      countEl.textContent = String(unread);
      // Animate bell when there are unread notifications
      try {
        const btn = document.getElementById('navNotifications');
        if (btn) {
          if (unread) btn.classList.add('has-unread'); else btn.classList.remove('has-unread');
        }
      } catch(_) {}
      if (!items.length) {
        listEl.innerHTML = '<div style="padding:12px;color:#666;">No notifications</div>';
        return;
      }
      listEl.innerHTML = items.map(n => `
        <div class="notif-item" style="display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid #eee;${n.read?'opacity:.7':''}">
          <div style="font-size:18px">${n.type==='visit'?'📅':(n.type==='team'?'👥':'🔔')}</div>
          <div style="flex:1">
            <div style="font-weight:600">${escapeHtml(n.title)}</div>
            <div style="font-size:13px;color:#555">${escapeHtml(n.message)}</div>
            <div style="font-size:12px;color:#999">${new Date(n.createdAt).toLocaleString()}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            ${n.link?`<a href="${n.link}" class="nav-link" style="color:#3f51b5">Open</a>`:''}
            <button class="btn" data-id="${n._id}" data-action="${n.read?'unread':'read'}" style="padding:4px 8px;font-size:12px;">Mark ${n.read?'unread':'read'}</button>
          </div>
        </div>
      `).join('');
      // Bind buttons
      listEl.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          try {
            if (action==='read') await api.markNotificationRead(id); else await api.markNotificationUnread(id);
            await this.loadNotifications(listEl, countEl);
          } catch(e){ handleAPIError(e); }
        });
      });
    } catch (e) {
      console.error('Notifications load failed', e);
      listEl.innerHTML = '<div style="padding:12px;color:#c62828">Failed to load notifications</div>';
    }
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
