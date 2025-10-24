/**
 * Admin Contacts Manager
 * Handles viewing, filtering, and managing contact form submissions
 */

class AdminContactsManager {
  constructor() {
    this.api = new APIManager();
    this.contacts = [];
    this.currentContact = null;
    this.currentPage = 1;
    this.totalPages = 1;
    this.filters = {
      status: '',
      search: ''
    };
    
    this.init();
  }

  async init() {
    // Check admin auth
    await this.checkAdminAuth();
    
    // Load initial data
    await this.loadStatistics();
    await this.loadContacts();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  async checkAdminAuth() {
    try {
      const user = await this.api.getCurrentUser();
      if (!user || user.role !== 'admin') {
        showNotification('Access denied. Admin privileges required.', 'error');
        setTimeout(() => window.location.href = '/dashboard.html', 2000);
        return;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/login.html';
    }
  }

  setupEventListeners() {
    // Filter controls
    document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
    document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());
    
    // Search on Enter key
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.applyFilters();
      }
    });

    // Reply form
    document.getElementById('replyMessage').addEventListener('input', (e) => {
      this.updateCharCounter(e.target.value);
    });

    document.getElementById('sendReply').addEventListener('click', () => this.sendReply());
    document.getElementById('openReplyFromView').addEventListener('click', () => this.openReplyFromView());

    // Status filter quick select
    document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
  }

  async loadStatistics() {
    try {
      Loading.show();
      const response = await this.api.getContactStats();
      
      if (response.success) {
        const stats = response.data;
        
        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statNew').textContent = stats.byStatus?.new || 0;
        document.getElementById('statRead').textContent = stats.byStatus?.read || 0;
        document.getElementById('statReplied').textContent = stats.byStatus?.replied || 0;
        document.getElementById('statArchived').textContent = stats.byStatus?.archived || 0;
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
      showNotification('Failed to load statistics', 'error');
    } finally {
      Loading.hide();
    }
  }

  async loadContacts(page = 1) {
    try {
      Loading.show();
      
      const params = {
        page,
        limit: 20,
        ...this.filters
      };

      const response = await this.api.getContacts(params);
      
      if (response.success) {
        this.contacts = response.data;
        this.currentPage = response.currentPage;
        this.totalPages = response.totalPages;
        
        this.renderContactsTable();
        this.renderPagination();
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      showNotification('Failed to load contacts', 'error');
      this.renderEmptyState();
    } finally {
      Loading.hide();
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
              <button class="btn-action btn-reply" onclick="adminContacts.openReplyModal('${contact._id}')">
                Reply
              </button>
            ` : ''}
            ${contact.status !== 'archived' ? `
              <button class="btn-action btn-archive" onclick="adminContacts.archiveContact('${contact._id}')">
                Archive
              </button>
            ` : ''}
            <button class="btn-action btn-delete" onclick="adminContacts.deleteContact('${contact._id}')">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
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
      Loading.show();
      const response = await this.api.getContact(contactId);
      
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
      showNotification('Failed to load contact details', 'error');
    } finally {
      Loading.hide();
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
      await this.api.markContactAsRead(contactId);
      
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
    const message = document.getElementById('replyMessage').value.trim();

    if (message.length < 10) {
      showNotification('Reply must be at least 10 characters', 'error');
      return;
    }

    if (!this.currentContact) {
      showNotification('No contact selected', 'error');
      return;
    }

    try {
      Loading.show();
      const response = await this.api.replyToContact(this.currentContact._id, message);
      
      if (response.success) {
        showNotification('Reply sent successfully!', 'success');
        this.closeModal('replyModal');
        
        // Reload data
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      const errorMsg = error.response?.data?.message || 'Failed to send reply';
      showNotification(errorMsg, 'error');
    } finally {
      Loading.hide();
    }
  }

  async archiveContact(contactId) {
    if (!confirm('Are you sure you want to archive this contact?')) {
      return;
    }

    try {
      Loading.show();
      const response = await this.api.archiveContact(contactId);
      
      if (response.success) {
        showNotification('Contact archived successfully', 'success');
        
        // Reload data
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      }
    } catch (error) {
      console.error('Failed to archive contact:', error);
      showNotification('Failed to archive contact', 'error');
    } finally {
      Loading.hide();
    }
  }

  async deleteContact(contactId) {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return;
    }

    try {
      Loading.show();
      const response = await this.api.deleteContact(contactId);
      
      if (response.success) {
        showNotification('Contact deleted successfully', 'success');
        
        // Reload data
        await this.loadStatistics();
        await this.loadContacts(this.currentPage);
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      showNotification('Failed to delete contact', 'error');
    } finally {
      Loading.hide();
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

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
});
