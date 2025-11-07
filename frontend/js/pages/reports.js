/**
 * Reports Page
 * Reports & Analytics with filters, export functionality
 */

class ReportsManager {
  constructor() {
    this.currentReport = null;
    this.reportData = {};
    this.init();
  }

  /**
   * Initialize reports page
   */
  init() {
    // Check authentication
    authManager.requireAuth();
    this.user = authManager.getUser();
    
    // Setup navbar
    navbarManager.setupNavbar();
    
    // Load initial data
    this.loadStatistics();
    this.loadSchoolsForFilter();
  }

  /**
   * Load statistics for report cards
   */
  async loadStatistics() {
    try {
      const [overview, volunteers, schools] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getVolunteersAnalytics(),
        api.getSchoolsAnalytics()
      ]);

      if (overview.success) {
        const data = overview.data.overview;
        document.getElementById('totalVisitsCount').textContent = data.totalVisits || 0;
        document.getElementById('completedVisitsCount').textContent = data.completedVisits || 0;
        document.getElementById('childrenReachedCount').textContent = (data.totalChildren || 0).toLocaleString();
        document.getElementById('hoursVolunteeredCount').textContent = Math.round((data.completedVisits || 0) * 2.5);
      }

      if (volunteers.success) {
        const data = volunteers.data;
        document.getElementById('totalVolunteersCount').textContent = data.totalVolunteers || 0;
        document.getElementById('activeVolunteersCount').textContent = data.activeVolunteers || 0;
      }

      if (schools.success) {
        const data = schools.data;
        document.getElementById('totalSchoolsCount').textContent = data.totalSchools || 0;
        document.getElementById('schoolsVisitedCount').textContent = data.schoolsWithVisits || 0;
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  /**
   * Load schools for filter dropdown
   */
  async loadSchoolsForFilter() {
    try {
      const data = await api.getSchools();
      
      if (data.success && data.data) {
        const select = document.getElementById('pdfSchoolFilter');
        
        if (!select) {
          console.warn('pdfSchoolFilter element not found');
          return;
        }
        
        data.data.forEach(school => {
          const option = document.createElement('option');
          option.value = school._id;
          option.textContent = school.name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading schools:', error);
    }
  }

  /**
   * Show specific report
   */
  async showReport(type) {
    this.currentReport = type;
    const resultsSection = document.getElementById('resultsSection');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsContent = document.getElementById('resultsContent');
    
    resultsSection.classList.add('active');
    resultsContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading report data...</p></div>';
    
    switch(type) {
      case 'visits':
        resultsTitle.textContent = 'Visits Report';
        await this.loadVisitsReport();
        break;
      case 'volunteers':
        resultsTitle.textContent = 'Volunteers Report';
        await this.loadVolunteersReport();
        break;
      case 'schools':
        resultsTitle.textContent = 'Schools Report';
        await this.loadSchoolsReport();
        break;
      case 'impact':
        resultsTitle.textContent = 'Impact Report';
        await this.loadImpactReport();
        break;
    }
  }

  /**
   * Load visits report
   */
  async loadVisitsReport() {
    try {
      const data = await api.getVisits();
      
      if (data.success) {
        this.reportData.visits = data.data;
        document.getElementById('resultsCount').textContent = `${data.data.length} records`;
        
        if (data.data.length === 0) {
          document.getElementById('resultsContent').innerHTML = '<div class="no-data">No visits found</div>';
          return;
        }
        
        let html = '<table class="results-table"><thead><tr>';
        html += '<th>Date</th><th>School</th><th>Team</th><th>Children</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        
        data.data.forEach(visit => {
          const date = new Date(visit.date).toLocaleDateString();
          const school = visit.school?.name || 'N/A';
          const team = visit.team?.name || 'N/A';
          const children = visit.childrenCount || 0;
          const status = visit.status || 'scheduled';

          html += `<tr>
            <td>${date}</td>
            <td>${school}</td>
            <td>${team}</td>
            <td>${children}</td>
            <td><span class="status-badge status-${status}">${status}</span></td>
          </tr>`;
        });
        
        html += '</tbody></table>';
        document.getElementById('resultsContent').innerHTML = html;
      }
    } catch (error) {
      console.error('Error loading visits report:', error);
      document.getElementById('resultsContent').innerHTML = '<div class="no-data">Error loading report</div>';
    }
  }

  /**
   * Load volunteers report
   */
  async loadVolunteersReport() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users', { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      const data = await res.json();
      
      if (data.success) {
        this.reportData.volunteers = data.data;
        document.getElementById('resultsCount').textContent = `${data.data.length} records`;
        
        if (data.data.length === 0) {
          document.getElementById('resultsContent').innerHTML = '<div class="no-data">No volunteers found</div>';
          return;
        }
        
        let html = '<table class="results-table"><thead><tr>';
        html += '<th>Name</th><th>Email</th><th>Department</th><th>Year</th><th>Role</th>';
        html += '</tr></thead><tbody>';
        
        data.data.forEach(volunteer => {
          html += `<tr>
            <td>${volunteer.name || volunteer.username}</td>
            <td>${volunteer.email || 'N/A'}</td>
            <td>${volunteer.department || 'N/A'}</td>
            <td>${volunteer.year || 'N/A'}</td>
            <td><span class="status-badge status-completed">${volunteer.role || 'volunteer'}</span></td>
          </tr>`;
        });
        
        html += '</tbody></table>';
        document.getElementById('resultsContent').innerHTML = html;
      }
    } catch (error) {
      console.error('Error loading volunteers report:', error);
      document.getElementById('resultsContent').innerHTML = '<div class="no-data">Error loading report</div>';
    }
  }

  /**
   * Load schools report
   */
  async loadSchoolsReport() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/schools', { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      const data = await res.json();
      
      if (data.success) {
        this.reportData.schools = data.data;
        document.getElementById('resultsCount').textContent = `${data.data.length} records`;
        
        if (data.data.length === 0) {
          document.getElementById('resultsContent').innerHTML = '<div class="no-data">No schools found</div>';
          return;
        }
        
        let html = '<table class="results-table"><thead><tr>';
        html += '<th>School Name</th><th>Contact Person</th><th>Phone</th><th>Location</th><th>Classes</th>';
        html += '</tr></thead><tbody>';
        
        data.data.forEach(school => {
          const contact = school.contactPerson?.name || 'N/A';
          const phone = school.contactPerson?.phone || 'N/A';
          const location = [school.address?.city, school.address?.state].filter(Boolean).join(', ') || 'N/A';
          
          html += `<tr>
            <td>${school.name}</td>
            <td>${contact}</td>
            <td>${phone}</td>
            <td>${location}</td>
            <td>${school.totalClasses || 0}</td>
          </tr>`;
        });
        
        html += '</tbody></table>';
        document.getElementById('resultsContent').innerHTML = html;
      }
    } catch (error) {
      console.error('Error loading schools report:', error);
      document.getElementById('resultsContent').innerHTML = '<div class="no-data">Error loading report</div>';
    }
  }

  /**
   * Load impact report
   */
  async loadImpactReport() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/analytics/overview', { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      const data = await res.json();
      
      if (data.success) {
        const overview = data.data.overview;
        document.getElementById('resultsCount').textContent = 'Summary';
        
        let html = '<div style="padding: 30px;">';
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px; margin-bottom: 30px;">`;
        html += `<div style="background: #e8f5e9; padding: 25px; border-radius: 12px; text-align: center;">
          <h3 style="color: #2e7d32; margin-bottom: 10px;">Total Children Reached</h3>
          <p style="font-size: 2.5rem; font-weight: 700; color: #4caf50; margin: 0;">${(overview.totalChildren || 0).toLocaleString()}</p>
        </div>`;
        html += `<div style="background: #e3f2fd; padding: 25px; border-radius: 12px; text-align: center;">
          <h3 style="color: #1565c0; margin-bottom: 10px;">Volunteer Hours</h3>
          <p style="font-size: 2.5rem; font-weight: 700; color: #2196f3; margin: 0;">${Math.round((overview.completedVisits || 0) * 2.5)}</p>
        </div>`;
        html += `<div style="background: #fff3e0; padding: 25px; border-radius: 12px; text-align: center;">
          <h3 style="color: #ef6c00; margin-bottom: 10px;">Completed Visits</h3>
          <p style="font-size: 2.5rem; font-weight: 700; color: #ff9800; margin: 0;">${overview.completedVisits || 0}</p>
        </div>`;
        html += `<div style="background: #f3e5f5; padding: 25px; border-radius: 12px; text-align: center;">
          <h3 style="color: #6a1b9a; margin-bottom: 10px;">Schools Visited</h3>
          <p style="font-size: 2.5rem; font-weight: 700; color: #9c27b0; margin: 0;">${overview.totalSchools || 0}</p>
        </div>`;
        html += `</div>`;
        
        html += '<h3 style="color: #2e7d32; margin-top: 30px; margin-bottom: 15px;">Impact Summary</h3>';
        html += '<p style="line-height: 1.8; color: #555; font-size: 1.05rem;">';
        html += `Through ${overview.completedVisits || 0} completed visits to ${overview.totalSchools || 0} schools, `;
        html += `${overview.totalVolunteers || 0} dedicated volunteers have positively impacted `;
        html += `${(overview.totalChildren || 0).toLocaleString()} children. `;
        html += `Our collective volunteer efforts have contributed approximately ${Math.round((overview.completedVisits || 0) * 2.5)} hours `;
        html += `towards spreading smiles and making a difference in the community.`;
        html += '</p></div>';
        
        document.getElementById('resultsContent').innerHTML = html;
      }
    } catch (error) {
      console.error('Error loading impact report:', error);
      document.getElementById('resultsContent').innerHTML = '<div class="no-data">Error loading report</div>';
    }
  }

  /**
   * Apply filters
   */
  applyFilters() {
    if (!this.currentReport) {
      alert('Please select a report type first');
      return;
    }
    this.showReport(this.currentReport);
  }

  /**
   * Reset filters
   */
  resetFilters() {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('statusFilter').value = '';
    const schoolFilter = document.getElementById('pdfSchoolFilter');
    if (schoolFilter && schoolFilter.tagName === 'SELECT' && !schoolFilter.multiple) {
      schoolFilter.value = '';
    }
  }

  /**
   * Export report to CSV
   */
  exportReport() {
    if (!this.currentReport || !this.reportData[this.currentReport]) {
      alert('Please generate a report first');
      return;
    }
    
    let csv = '';
    const data = this.reportData[this.currentReport];
    
    if (this.currentReport === 'visits') {
      csv = 'Date,School,Team,Children,Status\n';
      data.forEach(visit => {
        csv += `${new Date(visit.date).toLocaleDateString()},`;
        csv += `"${visit.school?.name || 'N/A'}",`;
        csv += `"${visit.team?.name || 'N/A'}",`;
        csv += `${visit.childrenCount || 0},`;
        csv += `${visit.status || 'scheduled'}\n`;
      });
    } else if (this.currentReport === 'volunteers') {
      csv = 'Name,Email,Department,Year,Role\n';
      data.forEach(vol => {
        csv += `"${vol.name || vol.username}",`;
        csv += `${vol.email || 'N/A'},`;
        csv += `${vol.department || 'N/A'},`;
        csv += `${vol.year || 'N/A'},`;
        csv += `${vol.role || 'volunteer'}\n`;
      });
    } else if (this.currentReport === 'schools') {
      csv = 'School Name,Contact Person,Phone,Location,Classes\n';
      data.forEach(school => {
        csv += `"${school.name}",`;
        csv += `"${school.contactPerson?.name || 'N/A'}",`;
        csv += `${school.contactPerson?.phone || 'N/A'},`;
        csv += `"${[school.address?.city, school.address?.state].filter(Boolean).join(', ') || 'N/A'}",`;
        csv += `${school.totalClasses || 0}\n`;
      });
    }
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentReport}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * PDF Generator Functions
   */

  /**
   * Show PDF generator modal
   */
  async showPdfGenerator() {
    // Check if user is admin
    if (!this.user || this.user.role !== 'admin') {
      alert('Only administrators can generate PDF reports');
      return;
    }

    // Show modal
    const modal = document.getElementById('pdfGeneratorModal');
    modal.style.display = 'flex';

    // Set default dates (current month)
    this.setDefaultPdfDates();

    // Load filters
    await this.loadPdfFilters();
  }

  /**
   * Close PDF generator modal
   */
  closePdfModal() {
    const modal = document.getElementById('pdfGeneratorModal');
    modal.style.display = 'none';
  }

  /**
   * Set default date range to current month
   */
  setDefaultPdfDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    document.getElementById('pdfStartDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('pdfEndDate').value = lastDay.toISOString().split('T')[0];
  }

  /**
   * Load schools and teams for filters
   */
  async loadPdfFilters() {
    try {
      const token = localStorage.getItem('token');
      
      // Load schools
      const schoolsRes = await fetch('/api/schools', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const schoolsData = await schoolsRes.json();
      
      if (schoolsData.success) {
        const select = document.getElementById('pdfSchoolFilter');
        select.innerHTML = '<option value="">All Schools</option>';
        schoolsData.data.forEach(school => {
          const option = document.createElement('option');
          option.value = school._id;
          option.textContent = school.name;
          select.appendChild(option);
        });
      }

      // Load teams
      const teamsRes = await fetch('/api/teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const teamsData = await teamsRes.json();
      
      if (teamsData.success) {
        const select = document.getElementById('pdfTeamFilter');
        select.innerHTML = '<option value="">All Teams</option>';
        teamsData.data.forEach(team => {
          const option = document.createElement('option');
          option.value = team._id;
          option.textContent = team.name;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading PDF filters:', error);
    }
  }

  /**
   * Validate and format date string to YYYY-MM-DD
   */
  formatDateForReport(dateString) {
    if (!dateString) return null;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Try to parse and format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Get PDF configuration from form
   */
  getPdfConfig() {
    const startDateRaw = document.getElementById('pdfStartDate').value;
    const endDateRaw = document.getElementById('pdfEndDate').value;
    const title = document.getElementById('pdfReportTitle').value;

    // Format dates to ensure YYYY-MM-DD format
    const startDate = this.formatDateForReport(startDateRaw);
    const endDate = this.formatDateForReport(endDateRaw);

    // Get selected schools
    const schoolSelect = document.getElementById('pdfSchoolFilter');
    const schools = Array.from(schoolSelect.selectedOptions)
      .map(opt => opt.value)
      .filter(val => val);

    // Get selected teams
    const teamSelect = document.getElementById('pdfTeamFilter');
    const teams = Array.from(teamSelect.selectedOptions)
      .map(opt => opt.value)
      .filter(val => val);

    return {
      template: 'visit-summary',
      title: title || 'Monthly Activity Report',
      dateRange: {
        start: startDate,
        end: endDate
      },
      sections: {
        summary: true,
        visitDetails: true,
        topicsCovered: true,
        schoolInfo: true,
        teamInfo: true,
        otherActivities: true
      },
      filters: {
        schools: schools.length > 0 ? schools : undefined,
        teams: teams.length > 0 ? teams : undefined
      },
      data: {}
    };
  }

  /**
   * Generate PDF report
   */
  async generatePdfReport() {
    const startDateRaw = document.getElementById('pdfStartDate').value;
    const endDateRaw = document.getElementById('pdfEndDate').value;

    // Validate dates exist
    if (!startDateRaw || !endDateRaw) {
      alert('Please select both start and end dates');
      return;
    }

    // Format and validate dates
    const startDate = this.formatDateForReport(startDateRaw);
    const endDate = this.formatDateForReport(endDateRaw);

    if (!startDate || !endDate) {
      alert('Invalid date format. Please use a valid date.');
      return;
    }

    // Validate date range
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (startDateObj > endDateObj) {
      alert('Start date must be before or equal to end date');
      return;
    }

    // Check if date range is too large (more than 1 year)
    const daysDiff = (endDateObj - startDateObj) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      const confirmLarge = confirm('You selected a date range longer than 1 year. This may take time to generate. Continue?');
      if (!confirmLarge) return;
    }

    try {
      // Show loading
      const modalLoading = document.getElementById('modalLoading');
      modalLoading.style.display = 'flex';

      const config = this.getPdfConfig();
      
      // Verify config has valid dates
      if (!config.dateRange.start || !config.dateRange.end) {
        throw new Error('Invalid date configuration');
      }

      // Issue 4: Validate template name
      const validTemplates = ['visit-summary', 'executive', 'detailed'];
      if (!config.template || !validTemplates.includes(config.template)) {
        throw new Error(`Invalid template name. Must be one of: ${validTemplates.join(', ')}`);
      }

      // Issue 3: Validate sections object
      if (!config.sections || typeof config.sections !== 'object') {
        throw new Error('Missing or invalid sections configuration');
      }

      // Check if at least one section is enabled
      const enabledSections = Object.values(config.sections).filter(val => val === true);
      if (enabledSections.length === 0) {
        throw new Error('At least one report section must be enabled. Please select sections to include in the report.');
      }

      // Validate section property names
      const validSectionNames = ['summary', 'visitDetails', 'topicsCovered', 'schoolInfo', 'teamInfo', 'otherActivities'];
      const invalidSections = Object.keys(config.sections).filter(key => !validSectionNames.includes(key));
      if (invalidSections.length > 0) {
        throw new Error(`Invalid section names found: ${invalidSections.join(', ')}. Valid sections are: ${validSectionNames.join(', ')}`);
      }

      const token = localStorage.getItem('token');

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate report');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spread-a-smile-report-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Hide loading and close modal
      modalLoading.style.display = 'none';
      this.closePdfModal();

      // Show success message
      if (window.notify) {
        notify.success('PDF report generated successfully!');
      } else {
        alert('PDF report generated successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Hide loading
      const modalLoading = document.getElementById('modalLoading');
      modalLoading.style.display = 'none';

      // Show error
      if (window.notify) {
        notify.error(error.message || 'Failed to generate PDF report');
      } else {
        alert(error.message || 'Failed to generate PDF report');
      }
    }
  }
}

// Global instance and functions for onclick handlers
let reportsManager;

function showReport(type) {
  if (reportsManager) {
    reportsManager.showReport(type);
  }
}

function applyFilters() {
  if (reportsManager) {
    reportsManager.applyFilters();
  }
}

function resetFilters() {
  if (reportsManager) {
    reportsManager.resetFilters();
  }
}

function exportReport() {
  if (reportsManager) {
    reportsManager.exportReport();
  }
}

// PDF Generator global functions
function showPdfGenerator() {
  if (reportsManager) {
    reportsManager.showPdfGenerator();
  }
}

function closePdfModal() {
  if (reportsManager) {
    reportsManager.closePdfModal();
  }
}

function generatePdfReport() {
  if (reportsManager) {
    reportsManager.generatePdfReport();
  }
}

// Initialize reports manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  reportsManager = new ReportsManager();
});
