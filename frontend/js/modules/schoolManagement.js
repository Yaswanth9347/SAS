/**
 * Enhanced School Management Module
 * Provides UI components for: Contact Persons, Contact History, Ratings, Availability
 */

class SchoolManagement {
  constructor() {
    this.currentSchool = null;
  }

  /**
   * Open enhanced school details modal with tabs
   */
  openSchoolDetailsModal(school) {
    this.currentSchool = school;
    
    // Close any existing modal
    const existingModal = document.querySelector('.school-details-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'school-details-modal';
    modal.innerHTML = `
      <div class="school-details-overlay"></div>
      <div class="school-details-container">
        <div class="details-header">
          <h2>${escapeHtml(school.name)}</h2>
          <button class="close-details" aria-label="Close">&times;</button>
        </div>
        
        <!-- Tab Navigation -->
        <div class="details-tabs">
          <button class="tab-btn active" data-tab="overview">
            <i class="fas fa-info-circle"></i> Overview
          </button>
          <button class="tab-btn" data-tab="contacts">
            <i class="fas fa-users"></i> Contacts
            ${school.contactPersons?.length ? `<span class="tab-badge">${school.contactPersons.length}</span>` : ''}
          </button>
          <button class="tab-btn" data-tab="history">
            <i class="fas fa-history"></i> History
            ${school.contactHistory?.length ? `<span class="tab-badge">${school.contactHistory.length}</span>` : ''}
          </button>
          <button class="tab-btn" data-tab="ratings">
            <i class="fas fa-star"></i> Ratings
            ${school.ratings?.length ? `<span class="tab-badge">${school.ratings.length}</span>` : ''}
          </button>
          <button class="tab-btn" data-tab="availability">
            <i class="fas fa-calendar-alt"></i> Availability
          </button>
        </div>
        
        <div class="details-body">
          <!-- Overview Tab -->
          <div class="tab-content active" data-content="overview">
            ${this.renderOverviewTab(school)}
          </div>
          
          <!-- Contacts Tab -->
          <div class="tab-content" data-content="contacts">
            ${this.renderContactsTab(school)}
          </div>
          
          <!-- History Tab -->
          <div class="tab-content" data-content="history">
            ${this.renderHistoryTab(school)}
          </div>
          
          <!-- Ratings Tab -->
          <div class="tab-content" data-content="ratings">
            ${this.renderRatingsTab(school)}
          </div>
          
          <!-- Availability Tab -->
          <div class="tab-content" data-content="availability">
            ${this.renderAvailabilityTab(school)}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Initialize modal
    requestAnimationFrame(() => {
      modal.classList.add('open');
      this.initializeTabHandlers(modal);
      this.initializeEventHandlers(modal, school);
    });
  }

  /**
   * Render Overview Tab
   */
  renderOverviewTab(school) {
    const formatAddress = (addr) => {
      if (!addr) return 'Not provided';
      const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'Not provided';
    };

    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    };

    const avgRating = school.stats?.averageRating || 0;
    
    return `
      <div class="details-grid">
        <div class="details-section">
          <h3><i class="fas fa-school"></i> School Information</h3>
          <div class="detail-item">
            <span class="label">Address</span>
            <span class="value">${escapeHtml(formatAddress(school.address))}</span>
          </div>
          <div class="detail-item">
            <span class="label">Status</span>
            <span class="value">
              <span class="status-badge ${school.isActive ? 'active' : 'inactive'}">
                ${school.isActive ? 'Active' : 'Inactive'}
              </span>
            </span>
          </div>
          <div class="detail-item">
            <span class="label">Total Classes</span>
            <span class="value"><span class="highlight-count">${school.totalClasses || 0}</span></span>
          </div>
          <div class="detail-item">
            <span class="label">Available Classes</span>
            <span class="value">
              <span class="highlight-count ${(school.availableClasses || 0) === 0 ? 'warn' : ''}">
                ${school.availableClasses || 0}
              </span>
            </span>
          </div>
        </div>
        
        <div class="details-section">
          <h3><i class="fas fa-chart-bar"></i> Statistics</h3>
          <div class="detail-item">
            <span class="label">Total Visits</span>
            <span class="value">${school.stats?.totalVisits || 0}</span>
          </div>
          <div class="detail-item">
            <span class="label">Completed Visits</span>
            <span class="value">${school.stats?.completedVisits || 0}</span>
          </div>
          <div class="detail-item">
            <span class="label">Average Rating</span>
            <span class="value">
              ${avgRating > 0 ? `<span class="highlight-count">${avgRating}</span> / 5` : 'No ratings yet'}
            </span>
          </div>
          <div class="detail-item">
            <span class="label">Last Visit</span>
            <span class="value">${formatDate(school.stats?.lastVisitDate)}</span>
          </div>
        </div>
      </div>
      
      <!-- Primary Contact (Legacy) -->
      ${school.contactPerson?.name ? `
        <div class="details-section full-width">
          <h3><i class="fas fa-user"></i> Primary Contact (Legacy)</h3>
          <div class="detail-item">
            <span class="label">Name</span>
            <span class="value">${escapeHtml(school.contactPerson.name)}</span>
          </div>
          ${school.contactPerson.phone ? `
            <div class="detail-item">
              <span class="label">Phone</span>
              <span class="value">${escapeHtml(school.contactPerson.phone)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="details-footer">
        <div class="timestamp">
          <span>Created: ${formatDate(school.createdAt)}</span>
          <span>Updated: ${formatDate(school.updatedAt)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render Contacts Tab - Multiple Contact Persons
   */
  renderContactsTab(school) {
    const contacts = school.contactPersons || [];
    
    if (contacts.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No contact persons added yet.</p>
          <button class="add-contact-btn" data-action="add-contact">
            <i class="fas fa-plus"></i> Add Contact Person
          </button>
        </div>
      `;
    }
    
    return `
      <div class="contact-persons-list">
        ${contacts.map(contact => `
          <div class="contact-person-card ${contact.isPrimary ? 'primary' : ''}" data-contact-id="${contact._id}">
            <div class="contact-info">
              <div class="contact-name">
                ${escapeHtml(contact.name)}
                ${contact.isPrimary ? '<span class="primary-badge">Primary</span>' : ''}
              </div>
              ${contact.position ? `<div class="contact-position">${escapeHtml(contact.position)}</div>` : ''}
              <div class="contact-details">
                ${contact.phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(contact.phone)}</span>` : ''}
                ${contact.email ? `<span><i class="fas fa-envelope"></i> ${escapeHtml(contact.email)}</span>` : ''}
              </div>
              ${contact.notes ? `<div class="contact-notes" style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-secondary)">${escapeHtml(contact.notes)}</div>` : ''}
            </div>
            <div class="contact-actions">
              <button class="btn-edit" data-action="edit-contact" data-contact-id="${contact._id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-delete" data-action="delete-contact" data-contact-id="${contact._id}">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="add-contact-btn" data-action="add-contact">
        <i class="fas fa-plus"></i> Add Contact Person
      </button>
    `;
  }

  /**
   * Render History Tab - Contact History
   */
  renderHistoryTab(school) {
    const history = school.contactHistory || [];
    
    if (history.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <p>No contact history recorded yet.</p>
          <button class="add-history-btn" data-action="add-history">
            <i class="fas fa-plus"></i> Add Contact History
          </button>
        </div>
      `;
    }
    
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    };
    
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return `
      <div class="contact-history-list">
        ${sortedHistory.map(entry => {
          const isFollowUpPending = entry.followUpDate && !entry.followUpCompleted;
          const isOverdue = isFollowUpPending && new Date(entry.followUpDate) < new Date();
          
          return `
            <div class="history-entry ${isFollowUpPending ? (isOverdue ? 'follow-up-overdue' : 'follow-up-pending') : ''}" data-history-id="${entry._id}">
              <div class="history-header">
                <div class="history-type">
                  <span class="type-badge ${entry.type}">${entry.type}</span>
                </div>
                <span class="history-date">${formatDate(entry.date)}</span>
              </div>
              
              ${entry.subject ? `<div class="history-subject">${escapeHtml(entry.subject)}</div>` : ''}
              ${entry.notes ? `<div class="history-notes">${escapeHtml(entry.notes)}</div>` : ''}
              
              <div class="history-meta">
                ${entry.contactedBy?.name ? `
                  <span><i class="fas fa-user"></i> ${escapeHtml(entry.contactedBy.name)}</span>
                ` : ''}
                ${entry.contactPerson ? `
                  <span><i class="fas fa-id-card"></i> ${escapeHtml(entry.contactPerson)}</span>
                ` : ''}
                ${entry.outcome ? `
                  <span class="outcome-badge ${entry.outcome}">${entry.outcome.replace(/-/g, ' ')}</span>
                ` : ''}
              </div>
              
              ${isFollowUpPending ? `
                <div class="follow-up-alert ${isOverdue ? 'overdue' : ''}">
                  <i class="fas fa-bell"></i>
                  Follow-up ${isOverdue ? 'was due' : 'scheduled for'}: ${new Date(entry.followUpDate).toLocaleDateString()}
                </div>
              ` : ''}
              
              <div class="history-actions">
                <button class="btn-edit" data-action="edit-history" data-history-id="${entry._id}">
                  <i class="fas fa-edit"></i> Edit
                </button>
                ${isFollowUpPending ? `
                  <button class="btn-complete" data-action="complete-followup" data-history-id="${entry._id}" style="background:#28a745;color:white;">
                    <i class="fas fa-check"></i> Complete Follow-up
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <button class="add-history-btn" data-action="add-history">
        <i class="fas fa-plus"></i> Add Contact History
      </button>
    `;
  }

  /**
   * Render Ratings Tab
   */
  renderRatingsTab(school) {
    const ratings = school.ratings || [];
    
    // Calculate averages
    const calcAvg = (field) => {
      const values = ratings.filter(r => r[field]).map(r => r[field]);
      return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 0;
    };
    
    const avgCooperation = calcAvg('cooperation');
    const avgFacilities = calcAvg('facilities');
    const avgEngagement = calcAvg('studentEngagement');
    const avgOverall = calcAvg('overallExperience');
    const overallAvg = ((parseFloat(avgCooperation) + parseFloat(avgFacilities) + parseFloat(avgEngagement) + parseFloat(avgOverall)) / 4).toFixed(1);
    
    const renderStars = (value) => {
      let stars = '';
      for (let i = 1; i <= 5; i++) {
        stars += `<i class="fas fa-star ${i <= value ? '' : 'empty'}"></i>`;
      }
      return stars;
    };
    
    return `
      ${ratings.length > 0 ? `
        <div class="ratings-summary">
          <div class="overall-rating">
            <div class="rating-value">${overallAvg}</div>
            <div class="rating-label">Overall Rating</div>
            <div class="rating-count">${ratings.length} rating${ratings.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="rating-breakdown">
            <div class="rating-category">
              <span class="category-name">Cooperation</span>
              <div class="rating-bar"><div class="rating-bar-fill" style="width:${avgCooperation * 20}%"></div></div>
              <span class="category-value">${avgCooperation}</span>
            </div>
            <div class="rating-category">
              <span class="category-name">Facilities</span>
              <div class="rating-bar"><div class="rating-bar-fill" style="width:${avgFacilities * 20}%"></div></div>
              <span class="category-value">${avgFacilities}</span>
            </div>
            <div class="rating-category">
              <span class="category-name">Student Engagement</span>
              <div class="rating-bar"><div class="rating-bar-fill" style="width:${avgEngagement * 20}%"></div></div>
              <span class="category-value">${avgEngagement}</span>
            </div>
            <div class="rating-category">
              <span class="category-name">Overall Experience</span>
              <div class="rating-bar"><div class="rating-bar-fill" style="width:${avgOverall * 20}%"></div></div>
              <span class="category-value">${avgOverall}</span>
            </div>
          </div>
        </div>
      ` : ''}
      
      ${ratings.length === 0 ? `
        <div class="empty-state">
          <i class="fas fa-star"></i>
          <p>No ratings yet. Be the first to rate this school!</p>
        </div>
      ` : `
        <div class="ratings-list">
          ${ratings.map(rating => `
            <div class="rating-card" data-rating-id="${rating._id}">
              <div class="rating-header">
                <span class="rating-user">
                  <i class="fas fa-user-circle"></i> ${escapeHtml(rating.ratedBy?.name || 'Unknown')}
                </span>
                <span class="rating-date">${new Date(rating.date).toLocaleDateString()}</span>
              </div>
              
              <div class="rating-stars">
                ${renderStars(Math.round((rating.cooperation + rating.facilities + rating.studentEngagement + rating.overallExperience) / 4))}
              </div>
              
              <div class="rating-scores">
                <div class="score-item">
                  <span class="score-label">Cooperation</span>
                  <span class="score-value">${rating.cooperation || '-'}/5</span>
                </div>
                <div class="score-item">
                  <span class="score-label">Facilities</span>
                  <span class="score-value">${rating.facilities || '-'}/5</span>
                </div>
                <div class="score-item">
                  <span class="score-label">Student Engagement</span>
                  <span class="score-value">${rating.studentEngagement || '-'}/5</span>
                </div>
                <div class="score-item">
                  <span class="score-label">Overall</span>
                  <span class="score-value">${rating.overallExperience || '-'}/5</span>
                </div>
              </div>
              
              ${rating.positives || rating.improvements || rating.generalComments ? `
                <div class="rating-feedback">
                  ${rating.positives ? `<p><strong>Positives:</strong> ${escapeHtml(rating.positives)}</p>` : ''}
                  ${rating.improvements ? `<p><strong>Improvements:</strong> ${escapeHtml(rating.improvements)}</p>` : ''}
                  ${rating.generalComments ? `<p><strong>Comments:</strong> ${escapeHtml(rating.generalComments)}</p>` : ''}
                </div>
              ` : ''}
              
              <span class="recommend-badge ${rating.wouldRecommend ? 'yes' : 'no'}">
                <i class="fas fa-${rating.wouldRecommend ? 'thumbs-up' : 'thumbs-down'}"></i>
                ${rating.wouldRecommend ? 'Would Recommend' : 'Would Not Recommend'}
              </span>
            </div>
          `).join('')}
        </div>
      `}
      
      <button class="add-rating-btn" data-action="add-rating">
        <i class="fas fa-plus"></i> Add Rating
      </button>
    `;
  }

  /**
   * Render Availability Tab
   */
  renderAvailabilityTab(school) {
    const availability = school.availability || {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeSlots = ['morning', 'afternoon', 'evening'];
    
    const formatDate = (date) => new Date(date).toLocaleDateString();
    
    return `
      <div class="availability-container">
        <div class="availability-section">
          <h4><i class="fas fa-calendar-day"></i> Preferred Days</h4>
          <div class="preferred-days">
            ${days.map(day => `
              <button class="day-chip ${availability.preferredDays?.includes(day) ? 'selected' : ''}" data-day="${day}">
                ${day}
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="availability-section">
          <h4><i class="fas fa-clock"></i> Preferred Time Slots</h4>
          <div class="time-slots">
            ${timeSlots.map(slot => `
              <button class="time-chip ${availability.preferredTimeSlots?.includes(slot) ? 'selected' : ''}" data-slot="${slot}">
                ${slot}
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="availability-section">
          <h4><i class="fas fa-calendar-times"></i> Unavailable Dates</h4>
          <div class="unavailable-dates-list">
            ${availability.unavailableDates?.length ? availability.unavailableDates.map((period, idx) => `
              <div class="unavailable-date-item" data-index="${idx}">
                <div>
                  <div class="date-range">${formatDate(period.startDate)} - ${formatDate(period.endDate)}</div>
                  ${period.reason ? `<div class="date-reason">${escapeHtml(period.reason)}</div>` : ''}
                </div>
                <button class="remove-date" data-action="remove-date" data-index="${idx}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `).join('') : '<p style="color:var(--text-secondary);font-size:0.9rem;">No unavailable dates set</p>'}
          </div>
          <button class="add-history-btn" data-action="add-unavailable-date" style="margin-top:0.5rem;">
            <i class="fas fa-plus"></i> Add Unavailable Period
          </button>
        </div>
        
        <div class="availability-section">
          <h4><i class="fas fa-cog"></i> Settings</h4>
          <div class="availability-settings">
            <div class="setting-item">
              <label>Max Visits Per Month</label>
              <input type="number" id="maxVisitsPerMonth" value="${availability.maxVisitsPerMonth || 4}" min="1" max="30">
            </div>
            <div class="setting-item">
              <label>Advance Notice (Days)</label>
              <input type="number" id="advanceNoticeDays" value="${availability.advanceNoticeDays || 7}" min="1" max="60">
            </div>
          </div>
        </div>
        
        <div class="availability-section special-instructions">
          <h4><i class="fas fa-sticky-note"></i> Special Instructions</h4>
          <textarea id="specialInstructions" placeholder="Any special instructions for scheduling visits...">${escapeHtml(availability.specialInstructions || '')}</textarea>
        </div>
        
        <button class="save-availability-btn" data-action="save-availability">
          <i class="fas fa-save"></i> Save Availability
        </button>
      </div>
    `;
  }

  /**
   * Initialize tab handlers
   */
  initializeTabHandlers(modal) {
    const tabs = modal.querySelectorAll('.tab-btn');
    const contents = modal.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        modal.querySelector(`[data-content="${tabName}"]`).classList.add('active');
      });
    });
  }

  /**
   * Initialize all event handlers
   */
  initializeEventHandlers(modal, school) {
    // Close handlers
    modal.querySelector('.close-details').addEventListener('click', () => this.closeModal(modal));
    modal.querySelector('.school-details-overlay').addEventListener('click', () => this.closeModal(modal));
    
    // Contact person actions
    modal.querySelectorAll('[data-action="add-contact"]').forEach(btn => {
      btn.addEventListener('click', () => this.openContactPersonModal(school));
    });
    
    modal.querySelectorAll('[data-action="edit-contact"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contactId = e.currentTarget.dataset.contactId;
        const contact = school.contactPersons?.find(c => c._id === contactId);
        if (contact) this.openContactPersonModal(school, contact);
      });
    });
    
    modal.querySelectorAll('[data-action="delete-contact"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contactId = e.currentTarget.dataset.contactId;
        this.deleteContactPerson(school._id, contactId);
      });
    });
    
    // Contact history actions
    modal.querySelectorAll('[data-action="add-history"]').forEach(btn => {
      btn.addEventListener('click', () => this.openContactHistoryModal(school));
    });
    
    modal.querySelectorAll('[data-action="edit-history"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const historyId = e.currentTarget.dataset.historyId;
        const history = school.contactHistory?.find(h => h._id === historyId);
        if (history) this.openContactHistoryModal(school, history);
      });
    });
    
    modal.querySelectorAll('[data-action="complete-followup"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const historyId = e.currentTarget.dataset.historyId;
        this.completeFollowUp(school._id, historyId);
      });
    });
    
    // Rating actions
    modal.querySelectorAll('[data-action="add-rating"]').forEach(btn => {
      btn.addEventListener('click', () => this.openRatingModal(school));
    });
    
    // Availability actions
    const availabilityTab = modal.querySelector('[data-content="availability"]');
    if (availabilityTab) {
      // Day selection
      availabilityTab.querySelectorAll('.day-chip').forEach(chip => {
        chip.addEventListener('click', () => chip.classList.toggle('selected'));
      });
      
      // Time slot selection
      availabilityTab.querySelectorAll('.time-chip').forEach(chip => {
        chip.addEventListener('click', () => chip.classList.toggle('selected'));
      });
      
      // Add unavailable date
      availabilityTab.querySelectorAll('[data-action="add-unavailable-date"]').forEach(btn => {
        btn.addEventListener('click', () => this.openUnavailableDateModal(school));
      });
      
      // Remove unavailable date
      availabilityTab.querySelectorAll('[data-action="remove-date"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.removeUnavailableDate(school, index);
        });
      });
      
      // Save availability
      availabilityTab.querySelectorAll('[data-action="save-availability"]').forEach(btn => {
        btn.addEventListener('click', () => this.saveAvailability(school._id, modal));
      });
    }
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  }

  /**
   * Open Contact Person Modal
   */
  openContactPersonModal(school, contact = null) {
    const overlay = document.createElement('div');
    overlay.className = 'sub-modal-overlay';
    overlay.innerHTML = `
      <div class="sub-modal">
        <div class="sub-modal-header">
          <h3>${contact ? 'Edit Contact Person' : 'Add Contact Person'}</h3>
          <button class="sub-modal-close">&times;</button>
        </div>
        <div class="sub-modal-body">
          <div class="form-group">
            <label>Name *</label>
            <input type="text" id="contactName" value="${contact ? escapeHtml(contact.name) : ''}" required>
          </div>
          <div class="form-group">
            <label>Position</label>
            <input type="text" id="contactPosition" value="${contact ? escapeHtml(contact.position || '') : ''}" placeholder="e.g., Principal, Vice Principal">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" id="contactPhone" value="${contact ? escapeHtml(contact.phone || '') : ''}" maxlength="10">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="contactEmail" value="${contact ? escapeHtml(contact.email || '') : ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="contactNotes" rows="3">${contact ? escapeHtml(contact.notes || '') : ''}</textarea>
          </div>
          <div class="form-group form-checkbox">
            <input type="checkbox" id="contactIsPrimary" ${contact?.isPrimary ? 'checked' : ''}>
            <label for="contactIsPrimary">Set as Primary Contact</label>
          </div>
        </div>
        <div class="sub-modal-footer">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-save">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    
    overlay.querySelector('.sub-modal-close').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-save').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('contactName').value.trim(),
        position: document.getElementById('contactPosition').value.trim(),
        phone: document.getElementById('contactPhone').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        notes: document.getElementById('contactNotes').value.trim(),
        isPrimary: document.getElementById('contactIsPrimary').checked
      };
      
      if (!data.name) {
        notify.error('Name is required');
        return;
      }
      
      try {
        loading.showFullPage('Saving...');
        let result;
        if (contact) {
          result = await api.updateContactPerson(school._id, contact._id, data);
        } else {
          result = await api.addContactPerson(school._id, data);
        }
        loading.hideFullPage();
        
        if (result.success) {
          notify.success(contact ? 'Contact updated!' : 'Contact added!');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          this.refreshSchoolDetails(school._id);
        } else {
          notify.error(result.message || 'Failed to save contact');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    });
  }

  /**
   * Delete Contact Person
   */
  async deleteContactPerson(schoolId, contactId) {
    notify.confirm('Are you sure you want to delete this contact person?', async () => {
      try {
        loading.showFullPage('Deleting...');
        const result = await api.deleteContactPerson(schoolId, contactId);
        loading.hideFullPage();
        
        if (result.success) {
          notify.success('Contact deleted!');
          this.refreshSchoolDetails(schoolId);
        } else {
          notify.error(result.message || 'Failed to delete contact');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    });
  }

  /**
   * Open Contact History Modal
   */
  openContactHistoryModal(school, history = null) {
    const overlay = document.createElement('div');
    overlay.className = 'sub-modal-overlay';
    overlay.innerHTML = `
      <div class="sub-modal">
        <div class="sub-modal-header">
          <h3>${history ? 'Edit Contact History' : 'Add Contact History'}</h3>
          <button class="sub-modal-close">&times;</button>
        </div>
        <div class="sub-modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>Type *</label>
              <select id="historyType">
                <option value="call" ${history?.type === 'call' ? 'selected' : ''}>Call</option>
                <option value="email" ${history?.type === 'email' ? 'selected' : ''}>Email</option>
                <option value="visit" ${history?.type === 'visit' ? 'selected' : ''}>Visit</option>
                <option value="meeting" ${history?.type === 'meeting' ? 'selected' : ''}>Meeting</option>
                <option value="other" ${history?.type === 'other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" id="historyDate" value="${history ? new Date(history.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-group">
            <label>Contact Person</label>
            <select id="historyContactPerson">
              <option value="">Select contact person</option>
              ${school.contactPersons?.map(c => `
                <option value="${escapeHtml(c.name)}" ${history?.contactPerson === c.name ? 'selected' : ''}>
                  ${escapeHtml(c.name)}${c.isPrimary ? ' (Primary)' : ''}
                </option>
              `).join('')}
              <option value="other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Subject</label>
            <input type="text" id="historySubject" value="${history ? escapeHtml(history.subject || '') : ''}" placeholder="Brief subject of the contact">
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="historyNotes" rows="3" placeholder="Details of the conversation...">${history ? escapeHtml(history.notes || '') : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Outcome</label>
            <select id="historyOutcome">
              <option value="">Select outcome</option>
              <option value="successful" ${history?.outcome === 'successful' ? 'selected' : ''}>Successful</option>
              <option value="no-response" ${history?.outcome === 'no-response' ? 'selected' : ''}>No Response</option>
              <option value="follow-up-needed" ${history?.outcome === 'follow-up-needed' ? 'selected' : ''}>Follow-up Needed</option>
              <option value="declined" ${history?.outcome === 'declined' ? 'selected' : ''}>Declined</option>
              <option value="other" ${history?.outcome === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Follow-up Date</label>
            <input type="date" id="historyFollowUpDate" value="${history?.followUpDate ? new Date(history.followUpDate).toISOString().split('T')[0] : ''}">
          </div>
        </div>
        <div class="sub-modal-footer">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-save">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    
    overlay.querySelector('.sub-modal-close').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-save').addEventListener('click', async () => {
      const data = {
        type: document.getElementById('historyType').value,
        date: document.getElementById('historyDate').value,
        contactPerson: document.getElementById('historyContactPerson').value,
        subject: document.getElementById('historySubject').value.trim(),
        notes: document.getElementById('historyNotes').value.trim(),
        outcome: document.getElementById('historyOutcome').value,
        followUpDate: document.getElementById('historyFollowUpDate').value || null
      };
      
      try {
        loading.showFullPage('Saving...');
        let result;
        if (history) {
          result = await api.updateContactHistory(school._id, history._id, data);
        } else {
          result = await api.addContactHistory(school._id, data);
        }
        loading.hideFullPage();
        
        if (result.success) {
          notify.success(history ? 'History updated!' : 'History added!');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          this.refreshSchoolDetails(school._id);
        } else {
          notify.error(result.message || 'Failed to save history');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    });
  }

  /**
   * Complete Follow-up
   */
  async completeFollowUp(schoolId, historyId) {
    try {
      loading.showFullPage('Updating...');
      const result = await api.updateContactHistory(schoolId, historyId, { followUpCompleted: true });
      loading.hideFullPage();
      
      if (result.success) {
        notify.success('Follow-up marked as complete!');
        this.refreshSchoolDetails(schoolId);
      } else {
        notify.error(result.message || 'Failed to update');
      }
    } catch (err) {
      loading.hideFullPage();
      handleAPIError(err);
    }
  }

  /**
   * Open Rating Modal
   */
  openRatingModal(school) {
    const overlay = document.createElement('div');
    overlay.className = 'sub-modal-overlay';
    overlay.innerHTML = `
      <div class="sub-modal">
        <div class="sub-modal-header">
          <h3>Add Rating for ${escapeHtml(school.name)}</h3>
          <button class="sub-modal-close">&times;</button>
        </div>
        <div class="sub-modal-body">
          <div class="form-group">
            <label>Cooperation (1-5)</label>
            <div class="star-rating-input" data-field="cooperation">
              ${[1,2,3,4,5].map(i => `<i class="fas fa-star" data-value="${i}"></i>`).join('')}
            </div>
            <input type="hidden" id="ratingCooperation" value="0">
          </div>
          <div class="form-group">
            <label>Facilities (1-5)</label>
            <div class="star-rating-input" data-field="facilities">
              ${[1,2,3,4,5].map(i => `<i class="fas fa-star" data-value="${i}"></i>`).join('')}
            </div>
            <input type="hidden" id="ratingFacilities" value="0">
          </div>
          <div class="form-group">
            <label>Student Engagement (1-5)</label>
            <div class="star-rating-input" data-field="studentEngagement">
              ${[1,2,3,4,5].map(i => `<i class="fas fa-star" data-value="${i}"></i>`).join('')}
            </div>
            <input type="hidden" id="ratingStudentEngagement" value="0">
          </div>
          <div class="form-group">
            <label>Overall Experience (1-5)</label>
            <div class="star-rating-input" data-field="overallExperience">
              ${[1,2,3,4,5].map(i => `<i class="fas fa-star" data-value="${i}"></i>`).join('')}
            </div>
            <input type="hidden" id="ratingOverallExperience" value="0">
          </div>
          <div class="form-group">
            <label>Positives</label>
            <textarea id="ratingPositives" rows="2" placeholder="What went well?"></textarea>
          </div>
          <div class="form-group">
            <label>Areas for Improvement</label>
            <textarea id="ratingImprovements" rows="2" placeholder="What could be better?"></textarea>
          </div>
          <div class="form-group">
            <label>General Comments</label>
            <textarea id="ratingComments" rows="2" placeholder="Any other feedback..."></textarea>
          </div>
          <div class="form-group form-checkbox">
            <input type="checkbox" id="ratingRecommend" checked>
            <label for="ratingRecommend">Would recommend this school for future visits</label>
          </div>
        </div>
        <div class="sub-modal-footer">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-save">Submit Rating</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    
    // Initialize star rating inputs
    overlay.querySelectorAll('.star-rating-input').forEach(container => {
      const field = container.dataset.field;
      const stars = container.querySelectorAll('i');
      const input = document.getElementById('rating' + field.charAt(0).toUpperCase() + field.slice(1));
      
      stars.forEach(star => {
        star.addEventListener('click', () => {
          const value = parseInt(star.dataset.value);
          input.value = value;
          stars.forEach((s, idx) => {
            s.classList.toggle('active', idx < value);
          });
        });
        
        star.addEventListener('mouseenter', () => {
          const value = parseInt(star.dataset.value);
          stars.forEach((s, idx) => {
            s.style.color = idx < value ? '#ffc107' : '#ddd';
          });
        });
      });
      
      container.addEventListener('mouseleave', () => {
        const value = parseInt(input.value);
        stars.forEach((s, idx) => {
          s.style.color = idx < value ? '#ffc107' : '#ddd';
        });
      });
    });
    
    overlay.querySelector('.sub-modal-close').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-save').addEventListener('click', async () => {
      const data = {
        cooperation: parseInt(document.getElementById('ratingCooperation').value) || null,
        facilities: parseInt(document.getElementById('ratingFacilities').value) || null,
        studentEngagement: parseInt(document.getElementById('ratingStudentEngagement').value) || null,
        overallExperience: parseInt(document.getElementById('ratingOverallExperience').value) || null,
        positives: document.getElementById('ratingPositives').value.trim(),
        improvements: document.getElementById('ratingImprovements').value.trim(),
        generalComments: document.getElementById('ratingComments').value.trim(),
        wouldRecommend: document.getElementById('ratingRecommend').checked
      };
      
      // Validate at least one rating is provided
      if (!data.cooperation && !data.facilities && !data.studentEngagement && !data.overallExperience) {
        notify.error('Please provide at least one rating');
        return;
      }
      
      try {
        loading.showFullPage('Submitting...');
        const result = await api.addSchoolRating(school._id, data);
        loading.hideFullPage();
        
        if (result.success) {
          notify.success('Rating submitted!');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          this.refreshSchoolDetails(school._id);
        } else {
          notify.error(result.message || 'Failed to submit rating');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    });
  }

  /**
   * Open Unavailable Date Modal
   */
  openUnavailableDateModal(school) {
    const overlay = document.createElement('div');
    overlay.className = 'sub-modal-overlay';
    overlay.innerHTML = `
      <div class="sub-modal">
        <div class="sub-modal-header">
          <h3>Add Unavailable Period</h3>
          <button class="sub-modal-close">&times;</button>
        </div>
        <div class="sub-modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>Start Date *</label>
              <input type="date" id="unavailableStart" required>
            </div>
            <div class="form-group">
              <label>End Date *</label>
              <input type="date" id="unavailableEnd" required>
            </div>
          </div>
          <div class="form-group">
            <label>Reason</label>
            <input type="text" id="unavailableReason" placeholder="e.g., Exam period, Holidays">
          </div>
        </div>
        <div class="sub-modal-footer">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-save">Add</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    
    overlay.querySelector('.sub-modal-close').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    });
    
    overlay.querySelector('.btn-save').addEventListener('click', async () => {
      const startDate = document.getElementById('unavailableStart').value;
      const endDate = document.getElementById('unavailableEnd').value;
      const reason = document.getElementById('unavailableReason').value.trim();
      
      if (!startDate || !endDate) {
        notify.error('Start and end dates are required');
        return;
      }
      
      if (new Date(endDate) < new Date(startDate)) {
        notify.error('End date must be after start date');
        return;
      }
      
      const availability = school.availability || {};
      const unavailableDates = availability.unavailableDates || [];
      unavailableDates.push({ startDate, endDate, reason });
      
      try {
        loading.showFullPage('Saving...');
        const result = await api.updateSchoolAvailability(school._id, {
          ...availability,
          unavailableDates
        });
        loading.hideFullPage();
        
        if (result.success) {
          notify.success('Unavailable period added!');
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 300);
          this.refreshSchoolDetails(school._id);
        } else {
          notify.error(result.message || 'Failed to save');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    });
  }

  /**
   * Remove Unavailable Date
   */
  async removeUnavailableDate(school, index) {
    const availability = school.availability || {};
    const unavailableDates = [...(availability.unavailableDates || [])];
    unavailableDates.splice(index, 1);
    
    try {
      loading.showFullPage('Removing...');
      const result = await api.updateSchoolAvailability(school._id, {
        ...availability,
        unavailableDates
      });
      loading.hideFullPage();
      
      if (result.success) {
        notify.success('Removed!');
        this.refreshSchoolDetails(school._id);
      } else {
        notify.error(result.message || 'Failed to remove');
      }
    } catch (err) {
      loading.hideFullPage();
      handleAPIError(err);
    }
  }

  /**
   * Save Availability
   */
  async saveAvailability(schoolId, modal) {
    const availabilityTab = modal.querySelector('[data-content="availability"]');
    
    const preferredDays = Array.from(availabilityTab.querySelectorAll('.day-chip.selected'))
      .map(chip => chip.dataset.day);
    
    const preferredTimeSlots = Array.from(availabilityTab.querySelectorAll('.time-chip.selected'))
      .map(chip => chip.dataset.slot);
    
    const maxVisitsPerMonth = parseInt(document.getElementById('maxVisitsPerMonth').value) || 4;
    const advanceNoticeDays = parseInt(document.getElementById('advanceNoticeDays').value) || 7;
    const specialInstructions = document.getElementById('specialInstructions').value.trim();
    
    // Get existing unavailable dates from current school data
    const unavailableDates = this.currentSchool?.availability?.unavailableDates || [];
    
    const data = {
      preferredDays,
      preferredTimeSlots,
      unavailableDates,
      maxVisitsPerMonth,
      advanceNoticeDays,
      specialInstructions
    };
    
    try {
      loading.showFullPage('Saving availability...');
      const result = await api.updateSchoolAvailability(schoolId, data);
      loading.hideFullPage();
      
      if (result.success) {
        notify.success('Availability saved!');
        this.refreshSchoolDetails(schoolId);
      } else {
        notify.error(result.message || 'Failed to save');
      }
    } catch (err) {
      loading.hideFullPage();
      handleAPIError(err);
    }
  }

  /**
   * Refresh school details
   */
  async refreshSchoolDetails(schoolId) {
    try {
      const result = await api.getSchool(schoolId);
      if (result.success) {
        // Close existing modal
        const existingModal = document.querySelector('.school-details-modal');
        const activeTab = existingModal?.querySelector('.tab-btn.active')?.dataset.tab || 'overview';
        if (existingModal) existingModal.remove();
        
        // Reopen with updated data
        this.openSchoolDetailsModal(result.data);
        
        // Switch to previously active tab
        setTimeout(() => {
          const modal = document.querySelector('.school-details-modal');
          if (modal) {
            const tabBtn = modal.querySelector(`[data-tab="${activeTab}"]`);
            if (tabBtn) tabBtn.click();
          }
        }, 100);
        
        // Refresh the schools list too
        if (typeof window.loadSchools === 'function') {
          window.loadSchools();
        }
      }
    } catch (err) {
      handleAPIError(err);
    }
  }
}

// Export for use
window.schoolManagement = new SchoolManagement();
