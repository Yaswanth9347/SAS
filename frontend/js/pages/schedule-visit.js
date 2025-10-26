/**
 * Schedule Visit Page
 * Functionality for scheduling new school visits with validation
 */

class ScheduleVisitManager {
  constructor() {
    this.user = null;
    this.init();
  }

  /**
   * Initialize schedule visit page
   */
  init() {
    // Check authentication
    authManager.requireAuth();
    this.user = authManager.getUser();
    
    // Setup navbar
    navbarManager.setupNavbar();
    
    // Set minimum date to today
    document.getElementById('visitDate').min = new Date().toISOString().split('T')[0];
    
    // Load teams and schools
    this.loadTeamsAndSchools();
    
    // Setup form submission
    this.setupFormSubmission();
  }

  /**
   * Load teams and schools for dropdowns
   */
  async loadTeamsAndSchools() {
    try {
      loading.show('team', 'Loading...');
      loading.show('school', 'Loading...');
      
      const [teamsData, schoolsData] = await Promise.all([
        api.getTeams(),
        api.getSchools()
      ]);

      loading.hide('team');
      loading.hide('school');

      if (teamsData.success) {
        const teamSelect = document.getElementById('team');
        teamSelect.innerHTML = '<option value="">Select Team</option>' +
          teamsData.data.map(team => 
            `<option value="${team._id}">${escapeHtml(team.name)} (${team.members.length} members)</option>`
          ).join('');
      }

      if (schoolsData.success) {
        const schoolSelect = document.getElementById('school');
        schoolSelect.innerHTML = '<option value="">Select School</option>' +
          schoolsData.data.map(school => 
            `<option value="${school._id}" data-classes="${school.availableClasses}">
              ${escapeHtml(school.name)} (${school.availableClasses} classes available)
            </option>`
          ).join('');

        // Add change event to show school info
        schoolSelect.addEventListener('change', () => this.showSchoolInfo());
      }

      // Load upcoming visits
      this.loadUpcomingVisits();
    } catch (error) {
      loading.hide('team');
      loading.hide('school');
      handleAPIError(error);
    }
  }

  /**
   * Show school information when selected
   */
  showSchoolInfo() {
    const schoolSelect = document.getElementById('school');
    const selectedOption = schoolSelect.options[schoolSelect.selectedIndex];
    const schoolInfo = document.getElementById('schoolInfo');

    if (selectedOption.value) {
      schoolInfo.innerHTML = `
        <p><strong>Available Classes:</strong> ${selectedOption.dataset.classes}</p>
      `;
      schoolInfo.style.display = 'block';
    } else {
      schoolInfo.style.display = 'none';
    }
  }

  /**
   * Check team availability for selected date
   */
  async checkAvailability() {
    const visitDate = document.getElementById('visitDate').value;
    const teamId = document.getElementById('team').value;

    if (!visitDate || !teamId) {
      notify.warning('Please select both date and team');
      return;
    }

    try {
      loading.show('availabilityResult', 'Checking...');
      const data = await api.getVisits(`?date=${visitDate}&team=${teamId}`);
      loading.hide('availabilityResult');
      
      const resultDiv = document.getElementById('availabilityResult');

      if (data.data && data.data.length > 0) {
        resultDiv.innerHTML = `
          <div class="availability-warning">
            <h4>⚠️ Team Not Available</h4>
            <p>This team already has a visit scheduled on ${utils.formatDate(visitDate)}.</p>
          </div>
        `;
      } else {
        resultDiv.innerHTML = `
          <div class="availability-success">
            <h4>✅ Team Available</h4>
            <p>This team is available on ${utils.formatDate(visitDate)}.</p>
          </div>
        `;
      }
      resultDiv.style.display = 'block';
    } catch (error) {
      loading.hide('availabilityResult');
      handleAPIError(error);
    }
  }

  /**
   * Setup form submission handler
   */
  setupFormSubmission() {
    document.getElementById('scheduleVisitForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get form values
      const visitDate = document.getElementById('visitDate').value;
      const teamId = document.getElementById('team').value;
      const schoolId = document.getElementById('school').value;
      const assignedClass = document.getElementById('assignedClass').value.trim();
      const childrenCount = parseInt(document.getElementById('expectedChildren').value) || 30;
      
      // Validation array
      const validationErrors = [];
      
      // 1. Validate date (cannot be in the past)
      const selectedDate = new Date(visitDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (!visitDate) {
        validationErrors.push('Please select a visit date');
      } else if (selectedDate < today) {
        validationErrors.push('Visit date cannot be in the past');
      }
      
      // 2. Validate team selection
      if (!teamId) {
        validationErrors.push('Please select a team');
      }
      
      // 3. Validate school selection
      if (!schoolId) {
        validationErrors.push('Please select a school');
      }
      
      // 4. Validate assigned class
      if (!assignedClass) {
        validationErrors.push('Please enter the assigned class');
      } else if (assignedClass.length < 2) {
        validationErrors.push('Assigned class must be at least 2 characters');
      }
      
      // 5. Validate children count
      if (childrenCount < 1) {
        validationErrors.push('Expected children must be at least 1');
      } else if (childrenCount > 500) {
        validationErrors.push('Expected children seems too high (max 500)');
      }
      
      // Show validation errors if any
      if (validationErrors.length > 0) {
        notify.error(validationErrors.join('<br>'));
        return;
      }
      
      // Check team availability before submitting
      try {
        const availabilityCheck = await api.getVisits(`?date=${visitDate}&team=${teamId}`);
        if (availabilityCheck.data && availabilityCheck.data.length > 0) {
          const existingVisit = availabilityCheck.data.find(v => v.status === 'scheduled' || v.status === 'completed');
          if (existingVisit) {
            notify.error(`This team already has a ${existingVisit.status} visit on ${utils.formatDate(visitDate)}. Please choose a different date or team.`);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not check team availability:', err);
        // Continue anyway if availability check fails
      }
      
      const formData = {
        date: visitDate,
        team: teamId,
        school: schoolId,
        assignedClass: assignedClass,
        childrenCount: childrenCount,
        visitTime: document.getElementById('visitTime').value || '09:00',
        status: 'scheduled'
      };

      try {
        loading.showFullPage('Scheduling visit...');
        const data = await api.createVisit(formData);
        loading.hideFullPage();
        
        if (data.success) {
          notify.success('Visit scheduled successfully!');
          e.target.reset();
          document.getElementById('availabilityResult').style.display = 'none';
          document.getElementById('schoolInfo').style.display = 'none';
          // Reset minimum date
          document.getElementById('visitDate').min = new Date().toISOString().split('T')[0];
          this.loadUpcomingVisits();
        } else {
          notify.error(data.message || 'Failed to schedule visit');
        }
      } catch (error) {
        loading.hideFullPage();
        handleAPIError(error);
      }
    });
  }

  /**
   * Load upcoming scheduled visits
   */
  async loadUpcomingVisits() {
    try {
      loading.show('upcomingVisitsList', 'Loading visits...');
      const data = await api.getVisits('?status=scheduled');
      loading.hide('upcomingVisitsList');
      
      const visitsList = document.getElementById('upcomingVisitsList');
      
      if (data.success) {
        if (data.data.length === 0) {
          renderNoData('upcomingVisitsList', 'No upcoming visits scheduled.');
          return;
        }

        visitsList.innerHTML = data.data.map(visit => `
          <div class="visit-card">
            <div class="visit-header">
              <h3>${escapeHtml(visit.school.name)}</h3>
              <span class="visit-status scheduled">Scheduled</span>
            </div>
            <div class="visit-details">
              <p><i class="far fa-calendar-alt"></i> <strong>Date:</strong> ${utils.formatDate(visit.date)}</p>
              <p><i class="fas fa-users"></i> <strong>Team:</strong> ${escapeHtml(visit.team.name)}</p>
              <p><i class="fas fa-chalkboard"></i> <strong>Class:</strong> ${escapeHtml(visit.assignedClass)}</p>
              <p><i class="fas fa-child"></i> <strong>Expected Children:</strong> ${visit.childrenCount}</p>
            </div>
            <div class="visit-actions">
              <button class="btn-small btn-danger" onclick="scheduleVisitManager.cancelVisit('${visit._id}')"><i class="fas fa-times-circle"></i> Cancel</button>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      loading.hide('upcomingVisitsList');
      renderError('upcomingVisitsList', 'Failed to load visits');
    }
  }

  /**
   * Cancel a scheduled visit
   */
  async cancelVisit(visitId) {
    notify.confirm('Are you sure you want to cancel this visit?', async () => {
      try {
        loading.showFullPage('Cancelling visit...');
        const data = await api.cancelVisit(visitId);
        loading.hideFullPage();
        
        if (data.success) {
          notify.success('Visit cancelled successfully!');
          this.loadUpcomingVisits();
        } else {
          notify.error(data.message || 'Failed to cancel visit');
        }
      } catch (error) {
        loading.hideFullPage();
        handleAPIError(error);
      }
    });
  }
}

// Global instance and functions for onclick handlers
let scheduleVisitManager;

function checkAvailability() {
  if (scheduleVisitManager) {
    scheduleVisitManager.checkAvailability();
  }
}

// Initialize schedule visit manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  scheduleVisitManager = new ScheduleVisitManager();
});
