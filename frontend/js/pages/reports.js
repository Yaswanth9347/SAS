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
        api.getAnalyticsVolunteers(),
        api.getAnalyticsSchools()
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
      
      if (data.success) {
        const select = document.getElementById('schoolFilter');
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
        if (authManager.isAdmin && authManager.isAdmin()) {
          html += '<th>Report</th>';
        }
        html += '</tr></thead><tbody>';
        
        data.data.forEach(visit => {
          const date = new Date(visit.date).toLocaleDateString();
          const school = visit.school?.name || 'N/A';
          const team = visit.team?.name || 'N/A';
          const children = visit.childrenCount || 0;
          const status = visit.status || 'scheduled';
          const reportCell = (() => {
            if (!(authManager.isAdmin && authManager.isAdmin())) return '';
            // Admin actions: if finalized, show download; if completed but not final, allow finalize; otherwise disabled
            if (visit.reportStatus === 'final' && visit.reportPdfPath) {
              const url = api.getReportDownloadUrl(visit._id);
              return `<a class="btn btn-secondary btn-sm" href="${url}"><i class="fas fa-file-pdf"></i> Download PDF</a>`;
            }
            if (status === 'completed') {
              return `<button class="btn btn-primary btn-sm" data-action="finalize" data-id="${visit._id}"><i class="fas fa-check"></i> Finalize</button>`;
            }
            return `<span class="muted">—</span>`;
          })();

          html += `<tr>
            <td>${date}</td>
            <td>${school}</td>
            <td>${team}</td>
            <td>${children}</td>
            <td><span class="status-badge status-${status}">${status}</span></td>
            ${authManager.isAdmin && authManager.isAdmin() ? `<td>${reportCell}</td>` : ''}
          </tr>`;
        });
        
        html += '</tbody></table>';
        document.getElementById('resultsContent').innerHTML = html;

        // Wire finalize buttons
        if (authManager.isAdmin && authManager.isAdmin()) {
          document.querySelectorAll('button[data-action="finalize"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const id = e.currentTarget.getAttribute('data-id');
              e.currentTarget.disabled = true;
              e.currentTarget.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing...';
              try {
                const res = await api.finalizeReportPdf(id);
                if (res.success) {
                  notify.success('Report finalized. Download will be available in a moment.');
                  // Reload current view
                  this.loadVisitsReport();
                } else {
                  notify.error(res.message || 'Failed to finalize report');
                }
              } catch (err) {
                notify.error(err.message || 'Failed to finalize report');
              }
            });
          });
        }
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
    document.getElementById('schoolFilter').value = '';
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

// Initialize reports manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  reportsManager = new ReportsManager();
});
