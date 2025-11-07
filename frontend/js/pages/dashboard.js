/**
 * Dashboard Page
 * Main dashboard with admin stats, upcoming visits, and gallery
 */

class DashboardManager {
  constructor() {
    this.user = null;
    this.galleryInterval = null;
    this.currentSlide = 0;
    this.galleryMedia = [];
    this.init();
  }

  /**
   * Initialize dashboard
   */
  init() {
    // Check authentication
    authManager.requireAuth();
    this.user = authManager.getUser();
    
    // Setup user interface
    this.setupUserInterface();
    
    // Load dashboard data
    this.loadDashboardData();
    
    // Setup cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.stopAutoScroll();
    });
  }

  /**
   * Setup user interface
   */
  setupUserInterface() {
    // Update the username display
    document.getElementById('userName').textContent = this.user.name || 'User';
    document.getElementById('userInfo').textContent = `Welcome back! Manage volunteers, teams, and school visits`;
    
    // Setup navbar with admin menu items
    navbarManager.setupNavbar();
  }

  /**
   * Load all dashboard data
   */
  async loadDashboardData() {
    try {
      // Show loading state
      loading.showSkeleton('upcomingVisits', 3, 'card');
      
      // Load all stats for all users
      await this.loadAdminStats();

      // Load upcoming visits
      await this.loadUpcomingVisits();
      
      // Load latest visit gallery
      await this.loadLatestVisitGallery();
    } catch (error) {
      handleAPIError(error);
    }
  }

  /**
   * Load admin-specific stats
   */
  async loadAdminStats() {
    try {
      const data = await api.get('/admin/stats');
      
      if (data.success) {
        document.getElementById('totalVolunteers').textContent = data.data.totalVolunteers;
        document.getElementById('activeVolunteers').textContent = data.data.activeVolunteers;
        document.getElementById('totalTeams').textContent = data.data.totalTeams;
        document.getElementById('unassignedVolunteers').textContent = data.data.volunteersWithoutTeam;
        
        // Show admin stats section
        const adminStatsEl = document.getElementById('adminStats');
        if (adminStatsEl) adminStatsEl.style.display = 'grid';
      }
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  }

  /**
   * Load upcoming visits
   */
  async loadUpcomingVisits() {
    try {
      console.log('📊 [Dashboard] Loading visits...');
      const data = await api.getVisits();
      
      console.log('📊 [Dashboard] Visits response:', data);
      
      if (data.success) {
        const allVisits = data.data || [];
        console.log('📊 [Dashboard] Total visits:', allVisits.length);
        
        const upcoming = allVisits.filter(visit => visit.status === 'scheduled');
        const visited = allVisits.filter(visit => visit.status === 'visited');
        const completed = allVisits.filter(visit => visit.status === 'completed');
        
        console.log('📊 [Dashboard] Upcoming:', upcoming.length, 'Visited:', visited.length, 'Completed:', completed.length);
        
        // Update activity summary stats
        const statsElements = document.querySelectorAll('#quickStats .stat-item');
        console.log('📊 [Dashboard] Found stat elements:', statsElements.length);
        
        if (statsElements.length >= 3) {
          statsElements[0].querySelector('.stat-number').textContent = allVisits.length;
          statsElements[1].querySelector('.stat-number').textContent = upcoming.length;
          statsElements[2].querySelector('.stat-number').textContent = completed.length;
          console.log('📊 [Dashboard] Updated stats display');
        }
        
        // Update upcoming visits list
        const visitsContainer = document.getElementById('upcomingVisits');
        
        // Show both scheduled and visited visits as "upcoming activities"
        const upcomingActivities = [...upcoming, ...visited].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (upcomingActivities.length > 0) {
          console.log('📊 [Dashboard] Displaying', upcomingActivities.length, 'upcoming activities');
          visitsContainer.innerHTML = upcomingActivities.map(visit => `
            <div class="visit-item">
              <h4>📅 ${utils.formatDate(visit.date)}</h4>
              <p>🏫 ${visit.school?.name || 'School'}</p>
              <p>👥 Class: ${visit.assignedClass || 'Not assigned'}</p>
              <span class="status-badge ${visit.status}">${visit.status === 'scheduled' ? 'Scheduled' : 'Visited - Upload Media'}</span>
            </div>
          `).join('');
        } else {
          console.log('📊 [Dashboard] No upcoming activities found');
          visitsContainer.innerHTML = '<p>No upcoming visits or activities.</p>';
        }
      } else {
        console.warn('📊 [Dashboard] API returned success=false:', data);
        const visitsContainer = document.getElementById('upcomingVisits');
        visitsContainer.innerHTML = '<p>Unable to load visits.</p>';
      }
    } catch (error) {
      console.error('📊 [Dashboard] Error loading visits:', error);
      renderError('upcomingVisits', 'Failed to load upcoming visits');
    }
  }

  /**
   * Load latest completed visit with gallery
   */
  async loadLatestVisitGallery() {
    try {
      console.log('🖼️ [Dashboard] Loading latest visit gallery...');
      
      // Get all visits (not just completed ones with filter, to avoid backend filtering issues)
      const data = await api.getVisits();
      
      console.log('🖼️ [Dashboard] Gallery API response:', data);
      
      if (data.success && data.data && data.data.length > 0) {
        // Filter and sort by date descending to get the most recent completed visit
        const completedVisits = data.data
          .filter(visit => visit.status === 'completed')
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log('🖼️ [Dashboard] Found', completedVisits.length, 'completed visits');

        if (completedVisits.length === 0) {
          console.log('🖼️ [Dashboard] No completed visits found');
          this.showNoGallery();
          return;
        }

        // Get the latest completed visit
        const latestVisit = completedVisits[0];
        console.log('🖼️ [Dashboard] Latest visit:', latestVisit.school?.name, 'on', latestVisit.date);
        
        // Fetch gallery for this visit
        const galleryData = await api.getVisitGallery(latestVisit._id);
        console.log('🖼️ [Dashboard] Gallery data response:', galleryData);
        
        if (galleryData.success && galleryData.data) {
          const { photos = [], videos = [] } = galleryData.data;
          console.log('🖼️ [Dashboard] Photos:', photos.length, 'Videos:', videos.length);
          
          // Helper to ensure absolute URLs
          const toAbsoluteUrl = (url) => {
            if (!url) return url;
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            const base = window.location.origin || 'http://localhost:5001';
            const path = url.startsWith('/') ? url : '/' + url;
            return base + path;
          };

          // Combine photos and videos
          this.galleryMedia = [
            ...photos.map(photo => ({ 
              type: 'photo', 
              url: toAbsoluteUrl(typeof photo === 'string' ? photo : photo.path),
              metadata: typeof photo === 'object' ? photo : null
            })),
            ...videos.map(video => ({ 
              type: 'video', 
              url: toAbsoluteUrl(typeof video === 'string' ? video : video.path),
              metadata: typeof video === 'object' ? video : null
            }))
          ];

          if (this.galleryMedia.length > 0) {
            console.log('🖼️ [Dashboard] Displaying gallery with', this.galleryMedia.length, 'items');
            this.displayGallery(latestVisit);
            this.startAutoScroll();
          } else {
            console.log('🖼️ [Dashboard] No media in gallery');
            this.showNoGallery();
          }
        } else {
          console.warn('🖼️ [Dashboard] Gallery API returned no data or failed');
          this.showNoGallery();
        }
      } else {
        console.log('🖼️ [Dashboard] No visits data or empty array');
        this.showNoGallery();
      }
    } catch (error) {
      console.error('🖼️ [Dashboard] Error loading latest visit gallery:', error);
      this.showNoGallery();
    }
  }

  /**
   * Display gallery
   */
  displayGallery(visit) {
    const galleryInfo = document.getElementById('galleryInfo');
    const galleryContainer = document.getElementById('galleryContainer');
    
    // Update header
    galleryInfo.innerHTML = `
      <strong>${visit.school?.name || 'School Visit'}</strong> - 
      ${utils.formatDate(visit.date)} - 
      ${this.galleryMedia.length} ${this.galleryMedia.length === 1 ? 'item' : 'items'}
    `;

    // Create gallery HTML
    const slidesHTML = this.galleryMedia.map((media, index) => {
      if (media.type === 'photo') {
        return `
          <div class="gallery-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
            <img src="${media.url}" alt="Visit photo ${index + 1}" loading="lazy">
          </div>
        `;
      } else {
        return `
          <div class="gallery-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
            <video src="${media.url}" controls autoplay muted loop></video>
          </div>
        `;
      }
    }).join('');

    const indicatorsHTML = this.galleryMedia.map((_, index) => 
      `<span class="indicator ${index === 0 ? 'active' : ''}" onclick="dashboardManager.goToSlide(${index})"></span>`
    ).join('');

    galleryContainer.innerHTML = `
      <div class="gallery-slider">
        ${slidesHTML}
      </div>
      <div class="gallery-indicators">
        ${indicatorsHTML}
      </div>
    `;

    this.currentSlide = 0;
  }

  /**
   * Show no gallery state
   */
  showNoGallery() {
    const galleryInfo = document.getElementById('galleryInfo');
    const galleryContainer = document.getElementById('galleryContainer');
    
    galleryInfo.textContent = 'No recent visits with media';
    galleryContainer.innerHTML = `
      <div class="no-gallery">
        <div class="no-gallery-icon">🖼️</div>
        <p>No completed visits with photos or videos yet.</p>
        <p style="margin-top: 10px; font-size: 0.9rem;">Submit a visit report with media to see it here!</p>
      </div>
    `;
  }

  /**
   * Start auto-scroll
   */
  startAutoScroll() {
    if (this.galleryInterval) clearInterval(this.galleryInterval);
    this.galleryInterval = setInterval(() => {
      this.nextSlide();
    }, 5000); // Change slide every 5 seconds
  }

  /**
   * Stop auto-scroll
   */
  stopAutoScroll() {
    if (this.galleryInterval) {
      clearInterval(this.galleryInterval);
      this.galleryInterval = null;
    }
  }

  /**
   * Toggle auto-scroll
   */
  toggleAutoScroll() {
    const btn = document.getElementById('autoScrollBtn');
    if (this.galleryInterval) {
      this.stopAutoScroll();
      btn.textContent = '▶️ Play';
    } else {
      this.startAutoScroll();
      btn.textContent = '⏸️ Pause';
    }
  }

  /**
   * Next slide
   */
  nextSlide() {
    if (this.galleryMedia.length === 0) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    slides[this.currentSlide].classList.remove('active');
    indicators[this.currentSlide].classList.remove('active');
    
    this.currentSlide = (this.currentSlide + 1) % this.galleryMedia.length;
    
    slides[this.currentSlide].classList.add('active');
    indicators[this.currentSlide].classList.add('active');

    // Auto-pause video when leaving, auto-play when entering
    this.updateVideoPlayback();
  }

  /**
   * Previous slide
   */
  prevSlide() {
    if (this.galleryMedia.length === 0) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    slides[this.currentSlide].classList.remove('active');
    indicators[this.currentSlide].classList.remove('active');
    
    this.currentSlide = (this.currentSlide - 1 + this.galleryMedia.length) % this.galleryMedia.length;
    
    slides[this.currentSlide].classList.add('active');
    indicators[this.currentSlide].classList.add('active');

    this.updateVideoPlayback();
  }

  /**
   * Go to specific slide
   */
  goToSlide(index) {
    if (this.galleryMedia.length === 0) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    slides[this.currentSlide].classList.remove('active');
    indicators[this.currentSlide].classList.remove('active');
    
    this.currentSlide = index;
    
    slides[this.currentSlide].classList.add('active');
    indicators[this.currentSlide].classList.add('active');

    this.updateVideoPlayback();
  }

  /**
   * Update video playback
   */
  updateVideoPlayback() {
    const slides = document.querySelectorAll('.gallery-slide');
    slides.forEach((slide, index) => {
      const video = slide.querySelector('video');
      if (video) {
        if (index === this.currentSlide) {
          video.play().catch(err => console.log('Video play error:', err));
        } else {
          video.pause();
        }
      }
    });
  }

  /**
   * Open report modal
   */
  openReportModal(visitId) {
    window.location.href = `visit-report.html?visitId=${visitId}`;
  }

  /**
   * Create teams (admin function)
   */
  async createTeams() {
    notify.confirm(
      'Create teams automatically? This will assign all unassigned volunteers to teams.',
      async () => {
        try {
          loading.showFullPage('Creating teams...');
          
          const data = await api.createBulkTeams({ teamSize: 4 });
          
          loading.hideFullPage();
          
          if (data.success) {
            notify.success(data.message);
            this.loadAdminStats();
          }
        } catch (error) {
          loading.hideFullPage();
          handleAPIError(error);
        }
      }
    );
  }

  /**
   * View teams (admin function)
   */
  async viewTeams() {
    try {
      loading.show('teamsList', 'Loading teams...');
      
      const data = await api.getTeams();
      
      loading.hide('teamsList');
      
      if (data.success) {
        this.displayTeams(data.data);
      }
    } catch (error) {
      loading.hide('teamsList');
      handleAPIError(error);
    }
  }

  /**
   * Display teams
   */
  displayTeams(teams) {
    const teamsList = document.getElementById('teamsList');
    const teamsSection = document.getElementById('teamsSection');
    
    teamsSection.style.display = 'block';
    
    if (teams.length === 0) {
      teamsList.innerHTML = '<p>No teams created yet.</p>';
      return;
    }

    teamsList.innerHTML = teams.map(team => `
      <div class="team-card">
        <h3>${team.name}</h3>
        <p><strong>Team Leader:</strong> ${team.teamLeader?.name || 'Not assigned'}</p>
        <p><strong>Members:</strong> ${team.members.length}</p>
        <p><strong>Assigned School:</strong> ${team.assignedSchool?.name || 'Not assigned'}</p>
        <div class="team-members">
          ${team.members.map(member => 
              `<span class="member-tag">${member.name} (${member.department} Y${member.year})</span>`
          ).join('')}
        </div>
      </div>
    `).join('');
    
    // Scroll to teams section
    teamsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Global functions for onclick handlers
let dashboardManager;

function openReportModal(visitId) {
  if (dashboardManager) {
    dashboardManager.openReportModal(visitId);
  }
}

function createTeams() {
  if (dashboardManager) {
    dashboardManager.createTeams();
  }
}

function viewTeams() {
  if (dashboardManager) {
    dashboardManager.viewTeams();
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  dashboardManager = new DashboardManager();
});
