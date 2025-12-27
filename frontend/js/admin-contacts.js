/**
 * Admin Contacts Manager
 * Handles viewing, filtering, and managing contact form submissions
 */

class AdminContactsManager {
  constructor() {
    // Use global api manager and auth manager
    this.contacts = [];
    this.currentContact = null;
    this.currentPage = 1;
    this.totalPages = 1;
  this.selected = new Set();
    this.filters = {
      status: '',
      search: ''
    };
    // aria-live region for announcements
    try {
      let live = document.getElementById('ariaLive');
      if (!live) {
        live = document.createElement('div');
        live.id = 'ariaLive';
        live.setAttribute('role', 'status');
        live.setAttribute('aria-live', 'polite');
        live.style.position = 'absolute';
        live.style.left = '-9999px';
        document.body.appendChild(live);
      }
      this._ariaLive = live;
    } catch (_) {}
    
    this.init();
  }

  async init() {
  // Enforce admin access
    try { authManager && authManager.requireAdmin && authManager.requireAdmin(); } catch (e) {}
  // Restore filters/page from URL
  try { this.restoreFromUrl(); } catch (_) {}

    // Load initial data
    await this.loadStatistics();
    await this.loadContacts();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Filter controls
    const applyBtn = document.getElementById('applyFilters'); if (applyBtn) applyBtn.addEventListener('click', () => this.applyFilters());
    const clearBtn = document.getElementById('clearFilters'); if (clearBtn) clearBtn.addEventListener('click', () => this.clearFilters());
    
    // Search on Enter key
    const searchEl = document.getElementById('searchInput');
    if (searchEl) {
      searchEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.applyFilters(); });
      // Debounced input for faster filtering
      let t; searchEl.addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => this.applyFilters(), 300); });
    }

    // Reply form
    const replyMsg = document.getElementById('replyMessage');
    if (replyMsg) replyMsg.addEventListener('input', (e) => { this.updateCharCounter(e.target.value); });

    const sendBtn = document.getElementById('sendReply'); if (sendBtn) sendBtn.addEventListener('click', () => this.sendReply());
    const openReplyBtn = document.getElementById('openReplyFromView'); if (openReplyBtn) openReplyBtn.addEventListener('click', () => this.openReplyFromView());

    // Status filter quick select
    const statusFilter = document.getElementById('statusFilter'); if (statusFilter) statusFilter.addEventListener('change', () => this.applyFilters());

    // Bulk actions
    const bulkArchiveBtn = document.getElementById('bulkArchive');
    const bulkDeleteBtn = document.getElementById('bulkDelete');
    const bulkUnarchiveBtn = document.getElementById('bulkUnarchive');
    if (bulkArchiveBtn) bulkArchiveBtn.addEventListener('click', () => this.bulkArchiveSelected());
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteSelected());
    if (bulkUnarchiveBtn) bulkUnarchiveBtn.addEventListener('click', () => this.bulkUnarchiveSelected());

    // Popstate restore
    window.addEventListener('popstate', () => { this.restoreFromUrl(); this.loadContacts(this.currentPage || 1); });
  }

  async loadStatistics() {
    try {
      loading.show('statsDashboard', 'Loading stats...');
      const response = await api.getContactStats();
      
      if (response.success) {
        const stats = response.data;
        // Guard DOM operations for test environments missing elements
        try { const el = document.getElementById('statTotal'); if (el) el.textContent = stats.total || 0; } catch(_) {}
        try { const el = document.getElementById('statNew'); if (el) el.textContent = stats.byStatus?.new || 0; } catch(_) {}
        try { const el = document.getElementById('statRead'); if (el) el.textContent = stats.byStatus?.read || 0; } catch(_) {}
        try { const el = document.getElementById('statReplied'); if (el) el.textContent = stats.byStatus?.replied || 0; } catch(_) {}
        try { const el = document.getElementById('statArchived'); if (el) el.textContent = stats.byStatus?.archived || 0; } catch(_) {}
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
      notify.error('Failed to load statistics');
    } finally {
      loading.hide('statsDashboard');
    }
  }

  async loadContacts(page = 1) {
    try {
      loading.show('contactsTableContainer', 'Loading contacts...');
      
      const params = {
        page,
        limit: 20,
        ...this.filters
      };

      const response = await api.getContacts(params);
      
      if (response.success) {
        this.contacts = response.data;
        this.currentPage = response.currentPage;
        this.totalPages = response.totalPages;
        
        this.renderContactsTable();
        this.renderPagination();
        // reflect state in URL
        try { this.updateUrlParams(); } catch (_) {}
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      notify.error('Failed to load contacts');
      this.renderEmptyState();
    } finally {
      loading.hide('contactsTableContainer');
    }
  }

  renderContactsTable() {
    const container = document.getElementById('contactsTableContainer');
    
    if (!this.contacts || this.contacts.length === 0) {
      this.renderEmptyState();
      return;
    }

    const html = `
      <table class="contacts-table">
        <thead>
          <tr>
            <th width="4%"><input type="checkbox" id="selectAllContacts"></th>
            <th width="25%">Contact Info</th>
            <th width="15%">Subject</th>
            <th width="30%">Message</th>
            <th width="10%">Status</th>
            <th width="12%">Date</th>
            <th width="8%">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.contacts.map(contact => this.renderContactRow(contact)).join('')}
        </tbody>
      </table>
    `;
    
    container.innerHTML = html;

    // Bind checkbox selection
    const selectAll = document.getElementById('selectAllContacts');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        container.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
          cb.checked = checked;
          const id = cb.dataset.id;
          if (checked) this.selected.add(id); else this.selected.delete(id);
        });
        this.updateBulkButtons();
      });
    }

    container.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
      // reflect current selection state
      try { cb.checked = this.selected.has(String(cb.dataset.id)); } catch (_) {}
      cb.addEventListener('change', (e) => {
        const id = String(e.target.dataset.id);
        if (e.target.checked) this.selected.add(id); else this.selected.delete(id);
        this.updateBulkButtons();
      });
    });
    this.updateBulkButtons();
  }

  renderContactRow(contact) {
    const date = new Date(contact.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const time = new Date(contact.createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <tr data-contact-id="${contact._id}">
        <td><input type="checkbox" data-id="${contact._id}"></td>
        <td>
          <div class="contact-name">${this.escapeHtml(contact.name)}</div>
          <div class="contact-email">${this.escapeHtml(contact.email)}</div>
        </td>
        <td>${this.escapeHtml(contact.subject)}</td>
        <td>
          <div class="message-preview">${this.escapeHtml(contact.message)}</div>
        </td>
        <td>
          <span class="status-badge ${contact.status}">${contact.status}</span>
        </td>
        <td>
          <div class="contact-date">${date}</div>
          <div class="contact-date">${time}</div>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-action btn-view" onclick="adminContacts.viewContact('${contact._id}')">
              View
            </button>
            ${contact.status !== 'replied' ? `
              <button class="btn-action btn-reply" onclick="adminContacts.openReplyModal('${contact._id}')">Reply</button>
            ` : ''}
            ${contact.status === 'archived' ? `
              <button class="btn-action" onclick="adminContacts.unarchiveContact('${contact._id}')">Unarchive</button>
            ` : `
              <button class="btn-action btn-archive" onclick="adminContacts.archiveContact('${contact._id}')">Archive</button>
            `}
            <button class="btn-action btn-delete" onclick="adminContacts.deleteContact('${contact._id}')">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  updateBulkButtons() {
    const count = this.selected.size;
    const bulkArchiveBtn = document.getElementById('bulkArchive');
    const bulkDeleteBtn = document.getElementById('bulkDelete');
    const bulkUnarchiveBtn = document.getElementById('bulkUnarchive');
    if (bulkArchiveBtn) bulkArchiveBtn.disabled = count === 0;
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = count === 0;
    if (bulkUnarchiveBtn) bulkUnarchiveBtn.disabled = count === 0;
    try { this._announce(count ? `${count} contacts selected` : 'Selection cleared'); } catch (_) {}
  }

  async bulkArchiveSelected() {
    const ids = Array.from(this.selected);
    if (!ids.length) { notify.info('No contacts selected'); return; }
    notify.confirm(`Archive ${ids.length} selected contact(s)?`, async () => {
      try {
        loading.showFullPage('Archiving contacts...');
        await api.bulkUpdateContacts(ids, 'archived');
        notify.success('Selected contacts archived');
        this._announce('Bulk archive completed');
        this.selected.clear();
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      } catch (e) {
        console.error(e);
        notify.error('Failed to archive selected contacts');
      } finally {
        loading.hideFullPage();
      }
    });
  }

  async bulkUnarchiveSelected() {
    const ids = Array.from(this.selected);
    if (!ids.length) { notify.info('No contacts selected'); return; }
    notify.confirm(`Unarchive ${ids.length} selected contact(s)?`, async () => {
      try {
        loading.showFullPage('Unarchiving contacts...');
        await api.bulkUpdateContacts(ids, 'read');
        notify.success('Selected contacts unarchived');
        this._announce('Bulk unarchive completed');
        this.selected.clear();
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      } catch (e) {
        console.error(e);
        notify.error('Failed to unarchive selected contacts');
      } finally {
        loading.hideFullPage();
      }
    });
  }

  async bulkDeleteSelected() {
    const ids = Array.from(this.selected);
    if (!ids.length) { notify.info('No contacts selected'); return; }
    notify.confirm(`Delete ${ids.length} selected contact(s)? This cannot be undone.`, async () => {
      try {
        loading.showFullPage('Deleting contacts...');
        // Delete sequentially to keep it simple and safe
        for (const id of ids) {
          try { await api.deleteContact(id); } catch (e) { console.warn('Delete failed for', id, e); }
        }
        notify.success('Selected contacts deleted');
        this._announce('Bulk delete completed');
        this.selected.clear();
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      } catch (e) {
        console.error(e);
        notify.error('Failed to delete selected contacts');
      } finally {
        loading.hideFullPage();
      }
    });
  }

  renderPagination() {
    const container = document.getElementById('paginationContainer');
    
    if (this.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    const html = `
      <button ${this.currentPage === 1 ? 'disabled' : ''} 
              onclick="adminContacts.loadContacts(1)">
        First
      </button>
      <button ${this.currentPage === 1 ? 'disabled' : ''} 
              onclick="adminContacts.loadContacts(${this.currentPage - 1})">
        Previous
      </button>
      <span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>
      <button ${this.currentPage === this.totalPages ? 'disabled' : ''} 
              onclick="adminContacts.loadContacts(${this.currentPage + 1})">
        Next
      </button>
      <button ${this.currentPage === this.totalPages ? 'disabled' : ''} 
              onclick="adminContacts.loadContacts(${this.totalPages})">
        Last
      </button>
    `;
    
    container.innerHTML = html;
  }

  renderEmptyState() {
    const container = document.getElementById('contactsTableContainer');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No Contacts Found</div>
        <div class="empty-state-text">
          ${this.filters.status || this.filters.search 
            ? 'Try adjusting your filters to see more results.' 
            : 'No contact messages have been received yet.'}
        </div>
      </div>
    `;
  }

  async viewContact(contactId) {
    try {
      loading.showFullPage('Loading contact...');
      const response = await api.getContact(contactId);
      
      if (response.success) {
        this.currentContact = response.data;
        this.renderContactDetails();
        this.openModal('viewContactModal');
        
        // Mark as read if it's new
        if (this.currentContact.status === 'new') {
          await this.markAsRead(contactId);
        }
      }
    } catch (error) {
      console.error('Failed to load contact details:', error);
      notify.error('Failed to load contact details');
    } finally {
      loading.hideFullPage();
    }
  }

  renderContactDetails() {
    const contact = this.currentContact;
    const date = new Date(contact.createdAt).toLocaleString();

    let html = `
      <div class="contact-detail-section">
        <div class="detail-label">Name</div>
        <div class="detail-value">${this.escapeHtml(contact.name)}</div>
      </div>

      <div class="contact-detail-section">
        <div class="detail-label">Email</div>
        <div class="detail-value">${this.escapeHtml(contact.email)}</div>
      </div>

      <div class="contact-detail-section">
        <div class="detail-label">Subject</div>
        <div class="detail-value">${this.escapeHtml(contact.subject)}</div>
      </div>

      <div class="contact-detail-section">
        <div class="detail-label">Message</div>
        <div class="detail-value">${this.escapeHtml(contact.message).replace(/\n/g, '<br>')}</div>
      </div>

      <div class="contact-detail-section">
        <div class="detail-label">Status</div>
        <div class="detail-value">
          <span class="status-badge ${contact.status}">${contact.status}</span>
        </div>
      </div>

      <div class="contact-detail-section">
        <div class="detail-label">Received</div>
        <div class="detail-value">${date}</div>
      </div>
    `;

    // Add reply history if exists
    if (contact.reply && contact.reply.message) {
      const replyDate = new Date(contact.reply.repliedAt).toLocaleString();
      const repliedBy = contact.reply.repliedBy?.name || 'Admin';
      
      html += `
        <div class="reply-history">
          <div class="reply-header">
            <strong>Reply sent by ${repliedBy}</strong> on ${replyDate}
          </div>
          <div class="reply-message">${this.escapeHtml(contact.reply.message).replace(/\n/g, '<br>')}</div>
        </div>
      `;
    }

    document.getElementById('contactDetailsBody').innerHTML = html;
  }

  async markAsRead(contactId) {
    try {
      await api.markContactAsRead(contactId);
      
      // Update local data
      const contact = this.contacts.find(c => c._id === contactId);
      if (contact) {
        contact.status = 'read';
        this.renderContactsTable();
      }
      
      // Reload statistics
      await this.loadStatistics();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  openReplyModal(contactId) {
    const contact = this.contacts.find(c => c._id === contactId);
    if (!contact) return;

    this.currentContact = contact;
    
    document.getElementById('replyToInfo').textContent = 
      `${contact.name} (${contact.email})`;
    document.getElementById('replyMessage').value = '';
    document.getElementById('replyCharCounter').textContent = '0 / 10 characters minimum';
    
    this.openModal('replyModal');
  }

  openReplyFromView() {
    if (!this.currentContact) return;
    
    this.closeModal('viewContactModal');
    this.openReplyModal(this.currentContact._id);
  }

  updateCharCounter(text) {
    const length = text.trim().length;
    const counter = document.getElementById('replyCharCounter');
    counter.textContent = `${length} / 10 characters minimum`;
    counter.style.color = length >= 10 ? '#4CAF50' : '#666';
  }

  async sendReply() {
    const notifyUser = {
      error: (msg) => {
        if (typeof globalThis.showNotification === 'function') {
          globalThis.showNotification(msg, 'error');
          return;
        }
        try { notify && notify.error && notify.error(msg); } catch (_) {}
      },
      success: (msg) => {
        if (typeof globalThis.showNotification === 'function') {
          globalThis.showNotification(msg, 'success');
          return;
        }
        try { notify && notify.success && notify.success(msg); } catch (_) {}
      }
    };

    const messageEl = document.getElementById('replyMessage');
    const message = (messageEl?.value || '').trim();

    if (message.length < 10) {
      notifyUser.error('Reply must be at least 10 characters');
      return;
    }

    if (!this.currentContact?._id) {
      notifyUser.error('No contact selected');
      return;
    }

    try {
      const sendBtn = document.getElementById('sendReply');
      try { if (sendBtn) sendBtn.disabled = true; } catch (_) {}

      loading.showFullPage('Sending reply...');
      const response = await api.replyToContact(this.currentContact._id, message);

      if (response?.success) {
        notifyUser.success('Reply sent successfully!');
        this.closeModal('replyModal');

        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      } else {
        notifyUser.error('Failed to send reply');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      notifyUser.error('Failed to send reply');
    } finally {
      loading.hideFullPage();
      try {
        const sendBtn = document.getElementById('sendReply');
        if (sendBtn) sendBtn.disabled = false;
      } catch (_) {}
    }
  }
// ...existing code...

  async archiveContact(contactId) {
    if (!confirm('Are you sure you want to archive this contact?')) {
      return;
    }

    try {
      // disable row action buttons while processing
      const row = document.querySelector(`tr[data-contact-id="${contactId}"]`);
      try { row && row.querySelectorAll('.btn-action').forEach(b => b.disabled = true); } catch(_) {}
      loading.showFullPage('Archiving...');
      const response = await api.archiveContact(contactId);
      
      if (response.success) {
        notify.success('Contact archived successfully');
        
        // Reload data
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      }
    } catch (error) {
      console.error('Failed to archive contact:', error);
      notify.error('Failed to archive contact');
    } finally {
      loading.hideFullPage();
      try { const row = document.querySelector(`tr[data-contact-id="${contactId}"]`); row && row.querySelectorAll('.btn-action').forEach(b => b.disabled = false); } catch(_) {}
    }
  }

  async unarchiveContact(contactId) {
    try {
      const row = document.querySelector(`tr[data-contact-id="${contactId}"]`);
      try { row && row.querySelectorAll('.btn-action').forEach(b => b.disabled = true); } catch(_) {}
      loading.showFullPage('Unarchiving...');
      await api.bulkUpdateContacts([contactId], 'read');
      notify.success('Contact unarchived');
      await this.loadStatistics();
      await this.loadContacts(this.currentPage);
    } catch (error) {
      console.error('Failed to unarchive contact:', error);
      notify.error('Failed to unarchive contact');
    } finally {
      loading.hideFullPage();
      try { const row = document.querySelector(`tr[data-contact-id="${contactId}"]`); row && row.querySelectorAll('.btn-action').forEach(b => b.disabled = false); } catch(_) {}
    }
  }

  async deleteContact(contactId) {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return;
    }

    try {
      const row = document.querySelector(`tr[data-contact-id="${contactId}"]`);
      try { row && row.querySelectorAll('.btn-action').forEach(b => b.disabled = true); } catch(_) {}
      loading.showFullPage('Deleting...');
      const response = await api.deleteContact(contactId);
      
      if (response.success) {
        notify.success('Contact deleted successfully');
        
        // Reload data
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      notify.error('Failed to delete contact');
    } finally {
      loading.hideFullPage();
      try { const row = document.querySelector(`tr[data-contact-id="${contactId}"]`); row && row.querySelectorAll('.btn-action').forEach(b => b.disabled = false); } catch(_) {}
    }
  }

  applyFilters() {
    this.filters.status = document.getElementById('statusFilter').value;
    this.filters.search = document.getElementById('searchInput').value.trim();
    
    this.currentPage = 1;
    this.loadContacts(1);
  }

  clearFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('searchInput').value = '';
    
    this.filters = {
      status: '',
      search: ''
    };
    
    this.loadContacts(1);
  }

  // URL state sync
  updateUrlParams() {
    try {
      const params = new URLSearchParams();
      if (this.filters.status) params.set('status', this.filters.status);
      if (this.filters.search) params.set('search', this.filters.search);
      if (this.currentPage) params.set('page', String(this.currentPage));
      const qs = params.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      history.replaceState({}, '', newUrl);
    } catch (_) {}
  }

  restoreFromUrl() {
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get('status') || '';
    const search = sp.get('search') || '';
    const page = parseInt(sp.get('page') || '1', 10) || 1;
    this.filters.status = status;
    this.filters.search = search;
    this.currentPage = page;
    // reflect in inputs if present
    try {
      const sf = document.getElementById('statusFilter'); if (sf) sf.value = status;
      const si = document.getElementById('searchInput'); if (si) si.value = search;
    } catch (_) {}
  }

  _announce(text) {
    try { if (this._ariaLive) this._ariaLive.textContent = String(text || ''); } catch (_) {}
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      // Focus trap for accessibility
      this._trapCleanup = this._trapFocus(modal);
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
      try { this._trapCleanup && this._trapCleanup(); } catch(_) {}
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Basic focus trap implementation
  _trapFocus(container) {
    const focusable = container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return () => {};
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    container.addEventListener('keydown', handler);
    try { first.focus(); } catch(_) {}
    return () => container.removeEventListener('keydown', handler);
  }
}

// Global functions for onclick handlers
let adminContacts;

function closeModal(modalId) {
  if (adminContacts) {
    adminContacts.closeModal(modalId);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  adminContacts = new AdminContactsManager();
  try { window.adminContacts = adminContacts; } catch (_) {}
});
