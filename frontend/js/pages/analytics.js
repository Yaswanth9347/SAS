/**
 * Analytics Dashboard Page
 * Handles charts, statistics, and performance metrics visualization
 */

class AnalyticsDashboard {
  constructor() {
    this.charts = {};
    this.init();
  }

  async init() {
    // Authentication
    authManager.requireAuth();
    const user = authManager.getUser();
    
    // Load all analytics data
    await this.loadAnalytics();
  }

  /**
   * Load all analytics data
   */
  async loadAnalytics() {
    try {
      await this.loadOverview();
      await this.loadCharts();
      await this.loadPerformance();
      await this.loadVolunteerAnalytics();
    } catch (error) {
      console.error('Error loading analytics:', error);
      showNotification('Failed to load analytics data', 'error');
    }
  }

  /**
   * Load overview statistics
   */
  async loadOverview() {
    try {
      const data = await api.getAnalyticsOverview();
      
      if (data.success) {
        const overview = data.data.overview;
        document.getElementById('totalChildren').textContent = overview.totalChildren.toLocaleString();
        document.getElementById('totalVolunteers').textContent = overview.totalVolunteers;
        document.getElementById('totalSchools').textContent = overview.totalSchools;
        document.getElementById('totalVisits').textContent = overview.completedVisits;
      }
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  }

  /**
   * Load and render all charts
   */
  async loadCharts() {
    try {
      const [overviewData, volunteerData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getVolunteersAnalytics()
      ]);

      if (overviewData.success) {
        this.renderVisitsTrendChart(overviewData.data.monthlyTrends);
        this.renderResponseChart(overviewData.data.responseDistribution);
      }

      if (volunteerData.success) {
        this.renderDepartmentChart(volunteerData.data.departmentStats);
        this.renderYearChart(volunteerData.data.yearStats);
      }

      // Load feedback chart
      await this.renderFeedbackChart();
    } catch (error) {
      console.error('Error loading charts:', error);
    }
  }

  /**
   * Render visits trend chart
   */
  renderVisitsTrendChart(monthlyTrends) {
    const ctx = document.getElementById('visitsTrendChart').getContext('2d');
    const labels = monthlyTrends.map(item => `${item._id.month}/${item._id.year}`);
    const visits = monthlyTrends.map(item => item.visits);
    const children = monthlyTrends.map(item => item.children);

    if (this.charts.visitsTrend) this.charts.visitsTrend.destroy();

    this.charts.visitsTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Visits',
            data: visits,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.4
          },
          {
            label: 'Children',
            data: children,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          }
        }
      }
    });
  }

  /**
   * Render response distribution chart
   */
  renderResponseChart(responseDistribution) {
    const ctx = document.getElementById('responseChart').getContext('2d');
    const labels = responseDistribution.map(item => item._id);
    const data = responseDistribution.map(item => item.count);

    const backgroundColors = {
      'excellent': '#4CAF50',
      'good': '#8BC34A',
      'average': '#FFC107',
      'poor': '#F44336'
    };

    if (this.charts.response) this.charts.response.destroy();

    this.charts.response = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
        datasets: [{
          data: data,
          backgroundColor: labels.map(label => backgroundColors[label] || '#999')
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          }
        }
      }
    });
  }

  /**
   * Render department distribution chart
   */
  renderDepartmentChart(departmentStats) {
    const ctx = document.getElementById('departmentChart').getContext('2d');
    const labels = departmentStats.map(item => item._id);
    const data = departmentStats.map(item => item.count);

    if (this.charts.department) this.charts.department.destroy();

    this.charts.department = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Volunteers',
          data: data,
          backgroundColor: '#2196F3'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  /**
   * Render year-wise distribution chart
   */
  renderYearChart(yearStats) {
    const ctx = document.getElementById('volunteerYearChart').getContext('2d');
    const labels = yearStats.map(item => `Year ${item._id}`);
    const data = yearStats.map(item => item.count);

    if (this.charts.year) this.charts.year.destroy();

    this.charts.year = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          }
        }
      }
    });
  }

  /**
   * Render feedback ratings chart
   */
  async renderFeedbackChart() {
    try {
      const data = await api.getFeedbackStats();
      
      if (data.success) {
        const ctx = document.getElementById('feedbackChart').getContext('2d');
        const ratingDist = data.data.ratingDistribution;
        
        const labels = ratingDist.map(item => `${item._id} Stars`);
        const feedbackData = ratingDist.map(item => item.count);

        if (this.charts.feedback) this.charts.feedback.destroy();

        this.charts.feedback = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Number of Ratings',
              data: feedbackData,
              backgroundColor: '#FF9800'
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error loading feedback chart:', error);
    }
  }

  /**
   * Load performance data
   */
  async loadPerformance() {
    try {
      const data = await api.getAnalyticsOverview();
      
      if (data.success) {
        // Top schools
        const topSchoolsList = document.getElementById('topSchoolsList');
        topSchoolsList.innerHTML = data.data.schoolPerformance.map((school, index) => `
          <div class="performance-item">
            <div class="rank">${index + 1}</div>
            <div class="details">
              <strong>${school.school.name}</strong>
              <div class="metrics">
                <span>${school.visitCount} visits</span>
                <span>${school.totalChildren} children</span>
                ${school.averageRating ? `<span>⭐ ${school.averageRating.toFixed(1)}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('');

        // Top teams
        const topTeamsList = document.getElementById('topTeamsList');
        topTeamsList.innerHTML = data.data.teamPerformance.map((team, index) => `
          <div class="performance-item">
            <div class="rank">${index + 1}</div>
            <div class="details">
              <strong>${team.team.name}</strong>
              <div class="metrics">
                <span>${team.visitCount} visits</span>
                <span>${team.totalChildren} children</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading performance data:', error);
    }
  }

  /**
   * Load volunteer analytics
   */
  async loadVolunteerAnalytics() {
    try {
      const data = await api.getVolunteersAnalytics();
      
      if (data.success) {
        const topVolunteersList = document.getElementById('topVolunteersList');
        topVolunteersList.innerHTML = data.data.topVolunteers.map((volunteer, index) => `
          <div class="volunteer-item">
            <div class="volunteer-rank">${index + 1}</div>
            <div class="volunteer-info">
              <strong>${volunteer.volunteer.name}</strong>
              <div>${volunteer.volunteer.department} - Year ${volunteer.volunteer.year}</div>
            </div>
            <div class="volunteer-stats">
              <span>${volunteer.visitCount} visits</span>
              <span>${volunteer.totalChildren} children</span>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading volunteer analytics:', error);
    }
  }
}

// Initialize analytics dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const analyticsDashboard = new AnalyticsDashboard();
});
