/**
 * Visit Report Page
 * Functionality for submitting visit reports with media upload
 */

class VisitReportManager {
  constructor() {
    this.user = null;
    this.selectedTeamId = null;
    this.selectedVisitId = null;
    this.uploadedFiles = {
      photos: [],
      videos: []
    };
    this.serverOffsetMs = 0; // serverTime - clientTime
    this.countdownInterval = null;
    this.currentVisitWindow = null; // { start: Date, end: Date }
    this.photoUploader = null; // EnhancedFileUpload instance for photos
    this.videoUploader = null; // EnhancedFileUpload instance for videos
    this.init();
  }

  /**
   * Initialize visit report page
   */
  init() {
    // Check authentication
    authManager.requireAuth();
    this.user = authManager.getUser();
    
    // Setup navbar
    navbarManager.setupNavbar();
    
    // Update navbar username
    const navUser = document.getElementById('navUser');
    if (navUser) {
      navUser.innerHTML = `<i class="fas fa-user-circle"></i> Welcome, ${this.user.name || 'User'}`;
    }
    
  // Setup file upload handlers
    this.setupFileUploadHandlers();
    
    // Setup form submission
    this.setupFormSubmission();
    
    // Kick off server time sync in background
    this.syncServerTime().catch(()=>{});

    // Load teams
    this.loadTeams();
  }

  /**
   * Sync approximate server time to avoid client clock drift
   */
  async syncServerTime() {
    try {
      const before = Date.now();
      const health = await api.get('/health');
      const after = Date.now();
      // Approximate mid-point to reduce network latency skew
      const clientMid = (before + after) / 2;
      const serverTs = new Date(health.timestamp).getTime();
      this.serverOffsetMs = serverTs - clientMid;
    } catch (e) {
      console.warn('Failed to sync server time, using client clock:', e.message);
      this.serverOffsetMs = 0;
    }
  }

  /**
   * Setup file upload handlers
   */
  setupFileUploadHandlers() {
    // Initialize EnhancedFileUpload for photos
    this.photoUploader = new EnhancedFileUpload({
      containerId: 'photoUploadContainer',
      uploadType: 'photos',
      maxFiles: 8,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      enableCompression: true,
      compressionQuality: 0.85,
      enableDragDrop: true,
      enableBulkActions: true,
      onFilesSelected: (files) => {
        this.uploadedFiles.photos = files;
        console.log('Photos selected:', files.length);
      },
      onFilesRemoved: (files) => {
        this.uploadedFiles.photos = files;
        console.log('Photos updated:', files.length);
      }
    });

    // Initialize EnhancedFileUpload for videos
    this.videoUploader = new EnhancedFileUpload({
      containerId: 'videoUploadContainer',
      uploadType: 'videos',
      maxFiles: 2,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
      enableCompression: false, // Don't compress videos
      enableDragDrop: true,
      enableBulkActions: true,
      onFilesSelected: (files) => {
        this.uploadedFiles.videos = files;
        console.log('Videos selected:', files.length);
      },
      onFilesRemoved: (files) => {
        this.uploadedFiles.videos = files;
        console.log('Videos updated:', files.length);
      }
    });

    // Add containers to the DOM if they don't exist
    this.setupUploadContainers();
  }

  /**
   * Setup upload containers in the DOM
   */
  setupUploadContainers() {
    // Replace photo upload section
    const photoSection = document.querySelector('.upload-section:has(#photoUpload)');
    if (photoSection && !document.getElementById('photoUploadContainer')) {
      const container = document.createElement('div');
      container.id = 'photoUploadContainer';
      
      // Keep the heading
      const heading = photoSection.querySelector('h4');
      photoSection.innerHTML = '';
      if (heading) photoSection.appendChild(heading);
      photoSection.appendChild(container);
    }

    // Replace video upload section
    const videoSection = document.querySelector('.upload-section:has(#videoUpload)');
    if (videoSection && !document.getElementById('videoUploadContainer')) {
      const container = document.createElement('div');
      container.id = 'videoUploadContainer';
      
      // Keep the heading
      const heading = videoSection.querySelector('h4');
      videoSection.innerHTML = '';
      if (heading) videoSection.appendChild(heading);
      videoSection.appendChild(container);
    }
  }

  /**
   * Load available teams
   */
  async loadTeams() {
    try {
      loading.show('teamSelect', 'Loading teams...');
      const data = await api.getTeams();
      loading.hide('teamSelect');
      
      const teamSelect = document.getElementById('teamSelect');
      
      // Check if we have teams data
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        teamSelect.innerHTML = '<option value="">No teams available</option>';
        
        // Display message for no teams
        const noTeamsMessage = document.createElement('div');
        noTeamsMessage.id = 'noTeamsMessage';
        noTeamsMessage.className = 'no-visits-message';
        noTeamsMessage.innerHTML = `
          <i class="fas fa-exclamation-circle"></i>
          <h4>No Teams Available</h4>
          <p>No teams are updated yet. Please wait for the admin team updates.</p>
        `;
        
        const formGroup = document.querySelector('#teamSelect').closest('.form-group');
        formGroup.parentNode.insertBefore(noTeamsMessage, formGroup.nextSibling);
        this.updateLoadingStatus('No teams available. Please contact admin.', true, 'teamLoadingStatus');
        return;
      }
      
      // We have teams, populate the dropdown
      teamSelect.innerHTML = '<option value="">Select a team</option>' +
        data.data.map(team => 
          `<option value="${team._id}">
            ${escapeHtml(team.name || 'Unnamed Team')}
          </option>`
        ).join('');
      
      // Add change event
      teamSelect.addEventListener('change', (e) => this.handleTeamSelection(e));
      
      // Hide loading status
      this.updateLoadingStatus('Teams loaded successfully. Please select a team.', false, 'teamLoadingStatus');
      document.getElementById('teamLoadingStatus').style.display = 'none';
    } catch (error) {
      loading.hide('teamSelect');
      const teamSelect = document.getElementById('teamSelect');
      teamSelect.innerHTML = '<option value="">Error loading teams</option>';
      this.updateLoadingStatus('Failed to load teams: ' + error.message, true, 'teamLoadingStatus');
      handleAPIError(error);
    }
  }

  /**
   * Load visits for reporting for selected team
   */
  async loadVisitsForReporting(teamId) {
    try {
      loading.show('visitSelect', 'Loading visits...');
      const data = await api.getVisits(`?status=scheduled&team=${teamId}`);
      loading.hide('visitSelect');
      
      // Check if we have visits data
      if (!data.data || !Array.isArray(data.data)) {
        console.error('Invalid visits data structure:', data);
        this.updateLoadingStatus('Invalid response format from server', true, 'visitLoadingStatus');
        notify.error('Failed to load visits: Invalid response format');
        return;
      }
      
      const visitSelect = document.getElementById('visitSelect');
      
      if (data.success) {
        console.log('Filtering visits with status: scheduled');
        const reportableVisits = data.data.filter(visit => {
          console.log('Visit ID:', visit._id, 'Status:', visit.status);
          return visit.status === 'scheduled';
        });
        
        console.log('Found reportable visits:', reportableVisits.length);
        
        // Check each visit has required properties
        reportableVisits.forEach(visit => {
          console.log('Visit details:', {
            id: visit._id,
            school: visit.school ? `${visit.school.name} (ID: ${visit.school._id})` : 'No school data',
            team: visit.team ? `${visit.team.name} (ID: ${visit.team._id})` : 'No team data',
            date: visit.date,
            assignedClass: visit.assignedClass
          });
        });

        if (reportableVisits.length === 0) {
          console.log('No reportable visits found for this team');
          visitSelect.innerHTML = '<option value="">No visits pending report</option>';
          this.updateLoadingStatus('No visits available for reporting. Please schedule a visit first.', false, 'visitLoadingStatus');
          
          // Display a more descriptive message
          const noVisitsMessage = document.createElement('div');
          noVisitsMessage.id = 'noVisitsMessage';
          noVisitsMessage.className = 'no-visits-message';
          noVisitsMessage.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <h4>No Reportable Visits Found</h4>
            <p>This team doesn't have any scheduled visits that need a report submission.</p>
            <p>To submit a report, you first need to:</p>
            <ol style="text-align: left; padding-left: 40px;">
              <li>Schedule a visit from the <a href="teams.html">Teams</a> page or <a href="visits.html">Visits</a> page</li>
              <li>Complete the actual visit to the school</li>
              <li>Then come back here to submit your report</li>
            </ol>
          `;
          
          const formGroup = document.querySelector('#visitSelect').closest('.form-group');
          formGroup.parentNode.insertBefore(noVisitsMessage, formGroup.nextSibling);
          return;
        }

        console.log('Creating visit options in dropdown');
        visitSelect.innerHTML = '<option value="">Select a visit to report</option>' +
          reportableVisits.map(visit => {
            console.log('Processing visit:', visit);
            
            const schoolName = visit.school?.name || 'Unknown School';
            let visitDate = 'Unknown Date';
            
            try {
              visitDate = new Date(visit.date).toLocaleDateString();
            } catch (e) {
              console.error('Error formatting date for visit:', visit._id, e);
            }
            
            return `<option value="${visit._id}">
              ${schoolName} - ${visitDate} (${visit.assignedClass || 'Unknown Class'})
            </option>`;
          }).join('');

        // Add change event
        visitSelect.addEventListener('change', (e) => this.handleVisitSelection(e));
        
        // Hide loading status
        this.updateLoadingStatus('Visits loaded successfully. Please select a visit.', false, 'visitLoadingStatus');
        document.getElementById('visitLoadingStatus').style.display = 'none';
      } else {
        console.error('API returned unsuccessful response:', data);
        visitSelect.innerHTML = '<option value="">Error loading visits</option>';
        this.updateLoadingStatus('Failed to load visits: ' + (data.message || 'Unknown error'), true, 'visitLoadingStatus');
        notify.error('Failed to load visits: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error loading visits:', error);
      const visitSelect = document.getElementById('visitSelect');
      visitSelect.innerHTML = '<option value="">Error loading visits</option>';
      this.updateLoadingStatus('Failed to load visits: ' + error.message, true, 'visitLoadingStatus');
      notify.error('Failed to load visits: ' + error.message);
    }
  }

  /**
   * Handle team selection
   */
  handleTeamSelection(event) {
    const teamId = event.target.value;
    console.log('Team selected:', teamId);
    this.selectedTeamId = teamId;
    const teamDetails = document.getElementById('teamDetails');
    const visitSelectionSection = document.getElementById('visitSelectionSection');
    
    // Hide no teams message if it exists
    const noTeamsMessage = document.getElementById('noTeamsMessage');
    if (noTeamsMessage) {
      noTeamsMessage.style.display = 'none';
    }

    if (teamId) {
      try {
        const selectedOption = event.target.options[event.target.selectedIndex];
        console.log('Selected team option text:', selectedOption.text);
        
        teamDetails.innerHTML = `
          <div class="team-info-card">
            <h4>Selected Team</h4>
            <p><strong>Team Name:</strong> ${selectedOption.text}</p>
          </div>
        `;
        teamDetails.style.display = 'block';
        
        visitSelectionSection.style.display = 'block';
        this.loadVisitsForReporting(teamId);
        
        console.log('Team details displayed successfully');
      } catch (error) {
        console.error('Error displaying team details:', error);
        teamDetails.innerHTML = `
          <div class="team-info-card" style="border-left-color: #f44336">
            <h4>Team Details</h4>
            <p>Error displaying team details. Please try selecting again or contact support.</p>
            <p class="error-details">${error.message}</p>
          </div>
        `;
        teamDetails.style.display = 'block';
        visitSelectionSection.style.display = 'none';
      }
    } else {
      teamDetails.style.display = 'none';
      visitSelectionSection.style.display = 'none';
      console.log('No team selected, hiding details');
    }
  }

  /**
   * Handle visit selection
   */
  handleVisitSelection(event) {
    const visitId = event.target.value;
    console.log('Visit selected:', visitId);
    this.selectedVisitId = visitId;
    const visitDetails = document.getElementById('visitDetails');
    const reportForm = document.getElementById('visitReportForm');
    
    // Hide no visits message if it exists
    const noVisitsMessage = document.getElementById('noVisitsMessage');
    if (noVisitsMessage) {
      noVisitsMessage.style.display = 'none';
    }

    if (visitId) {
      try {
        const selectedOption = event.target.options[event.target.selectedIndex];
        console.log('Selected visit option text:', selectedOption.text);
        
        // Parse the option text
        let schoolName, visitDate, assignedClass;
        
        try {
          const parts = selectedOption.text.split(' - ');
          schoolName = parts[0].trim();
          
          if (parts.length > 1) {
            const secondPart = parts[1];
            const dateClassParts = secondPart.split('(');
            visitDate = dateClassParts[0].trim();
            
            if (dateClassParts.length > 1) {
              assignedClass = dateClassParts[1].replace(')', '').trim();
            } else {
              assignedClass = 'Not specified';
            }
          } else {
            visitDate = 'Not specified';
            assignedClass = 'Not specified';
          }
        } catch (parseError) {
          console.error('Error parsing visit details:', parseError);
          schoolName = selectedOption.text;
          visitDate = 'Format error';
          assignedClass = 'Format error';
        }
        
        visitDetails.innerHTML = `
          <div class="visit-info-card">
            <h4>Visit Details</h4>
            <p><strong>School:</strong> ${schoolName}</p>
            <p><strong>Date:</strong> ${visitDate}</p>
            <p><strong>Class:</strong> ${assignedClass}</p>
            <p><strong>Team:</strong> ${document.getElementById('teamSelect').options[document.getElementById('teamSelect').selectedIndex].text}</p>
          </div>
        `;
        visitDetails.style.display = 'block';
        reportForm.style.display = 'block';
        
        console.log('Visit details displayed successfully');

        // Load visit to determine upload window and update UI state
        this.loadVisitWindow(visitId);
      } catch (error) {
        console.error('Error displaying visit details:', error);
        visitDetails.innerHTML = `
          <div class="visit-info-card" style="border-left-color: #f44336">
            <h4>Visit Details</h4>
            <p>Error displaying visit details. Please try selecting again or contact support.</p>
            <p class="error-details">${error.message}</p>
          </div>
        `;
        visitDetails.style.display = 'block';
        reportForm.style.display = 'none';
      }
    } else {
      visitDetails.style.display = 'none';
      reportForm.style.display = 'none';
      console.log('No visit selected, hiding details');
    }
  }

  /**
   * Load visit details and set upload window UI state
   */
  async loadVisitWindow(visitId) {
    try {
      // Ensure we have server time offset at least once
      if (this.serverOffsetMs === 0) {
        await this.syncServerTime().catch(()=>{});
      }
      const { data } = await api.getVisit(visitId);
      const start = data.uploadWindowStartUtc ? new Date(data.uploadWindowStartUtc) : null;
      const end = data.uploadWindowEndUtc ? new Date(data.uploadWindowEndUtc) : null;
      this.currentVisitWindow = start && end ? { start, end } : null;
      this.applyWindowState();
      this.startCountdown();
    } catch (e) {
      console.error('Failed to load visit window:', e);
      // Fallback: enable uploads (server will still enforce)
      this.setUploadControlsDisabled(false);
      this.renderWindowBanner(null, 'Unable to determine upload window. You may attempt to upload; the server will enforce policy.', 'info');
      this.showInlineAlert('Unable to determine upload window. You may attempt to upload; the server will enforce policy.', 'info');
    }
  }

  /**
   * Compute state and update UI controls
   */
  applyWindowState() {
    const bannerEl = document.getElementById('uploadWindowStatus');
    if (!this.currentVisitWindow) {
      if (bannerEl) bannerEl.style.display = 'none';
      this.setUploadControlsDisabled(false);
      return;
    }
    const now = new Date(Date.now() + this.serverOffsetMs);
    const { start, end } = this.currentVisitWindow;
    if (now < start) {
      this.setUploadControlsDisabled(true);
      this.renderWindowBanner({ state: 'before', start, end });
    } else if (now > end) {
      this.setUploadControlsDisabled(true);
      this.renderWindowBanner({ state: 'after', start, end });
    } else {
      this.setUploadControlsDisabled(false);
      this.renderWindowBanner({ state: 'open', start, end });
    }
  }

  /**
   * Start or restart live countdown
   */
  startCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    const countdownEl = document.getElementById('uploadWindowCountdown');
    if (!this.currentVisitWindow || !countdownEl) return;
    const tick = () => {
      const now = new Date(Date.now() + this.serverOffsetMs);
      const { start, end } = this.currentVisitWindow;
      let target, prefix;
      if (now < start) { target = start; prefix = 'Opens in'; }
      else if (now <= end) { target = end; prefix = 'Closes in'; }
      else { countdownEl.textContent = ''; return; }
      const diffMs = Math.max(0, target.getTime() - now.getTime());
      const hh = Math.floor(diffMs / 3600000);
      const mm = Math.floor((diffMs % 3600000) / 60000);
      const ss = Math.floor((diffMs % 60000) / 1000);
      countdownEl.textContent = `${prefix} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    };
    tick();
    this.countdownInterval = setInterval(() => {
      this.applyWindowState();
      tick();
    }, 1000);
  }

  /**
   * Enable/disable upload controls and submit button
   */
  setUploadControlsDisabled(disabled) {
    const photoInput = document.getElementById('photoUpload');
    const videoInput = document.getElementById('videoUpload');
    const submitBtn = document.getElementById('submitBtn');
    const uploadSections = document.querySelectorAll('.upload-section');
    if (photoInput) photoInput.disabled = disabled;
    if (videoInput) videoInput.disabled = disabled;
    if (submitBtn) submitBtn.disabled = disabled;
    uploadSections.forEach(sec => {
      if (disabled) sec.classList.add('upload-disabled');
      else sec.classList.remove('upload-disabled');
    });
  }

  /**
   * Render window banner with state and message
   */
  renderWindowBanner(info, fallbackMsg = null, level = 'info') {
    const statusEl = document.getElementById('uploadWindowStatus');
    if (!statusEl) return;
    const badgeEl = document.getElementById('uploadWindowBadge');
    const msgEl = document.getElementById('uploadWindowMessage');
    const countdownEl = document.getElementById('uploadWindowCountdown');
    statusEl.style.display = 'flex';
    // Reset classes
    badgeEl.className = 'badge';
    countdownEl.textContent = '';
    if (!info) {
      badgeEl.textContent = 'Info';
      msgEl.textContent = fallbackMsg || 'Upload window information unavailable.';
      this.showInlineAlert(msgEl.textContent, level || 'info');
      return;
    }
    const { state, start, end } = info;
    if (state === 'before') {
      badgeEl.textContent = 'Not open yet';
      badgeEl.classList.add('badge-soon');
      msgEl.textContent = `Uploads open at 12:00 PM IST on ${start.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
      this.showInlineAlert(msgEl.textContent, 'warning');
    } else if (state === 'after') {
      badgeEl.textContent = 'Closed';
      badgeEl.classList.add('badge-closed');
      msgEl.textContent = `Uploads closed at ${end.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
      this.showInlineAlert(msgEl.textContent, 'error');
    } else {
      badgeEl.textContent = 'Open';
      badgeEl.classList.add('badge-open');
      msgEl.textContent = 'You can upload photos and videos now.';
      this.clearInlineAlert();
    }
  }

  /**
   * Inline alert helpers (near upload area)
   */
  showInlineAlert(message, level = 'warning') {
    const el = document.getElementById('uploadInlineAlert');
    if (!el) return;
    el.classList.remove('is-warning','is-error','is-success','is-info');
    el.classList.add(`is-${level}`);
    el.innerHTML = escapeHtml(message);
    el.style.display = 'block';
    try { el.focus({ preventScroll: true }); } catch(e){}
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
  }
  clearInlineAlert() {
    const el = document.getElementById('uploadInlineAlert');
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
  }

  /**
   * Handle photo upload
   */
  handlePhotoUpload(event) {
    const files = Array.from(event.target.files);
    const preview = document.getElementById('photoPreview');
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_PHOTOS = 8;
    
    if (this.uploadedFiles.photos.length + files.length > MAX_PHOTOS) {
      notify.error(`You can only upload a maximum of ${MAX_PHOTOS} photos. Please remove some photos first.`);
      event.target.value = '';
      return;
    }
    
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      notify.error(`Some files exceed the maximum size of 10MB: ${oversizedFiles.map(f => f.name).join(', ')}`);
      event.target.value = '';
      return;
    }
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const previewItem = document.createElement('div');
          previewItem.className = 'preview-item';
          previewItem.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <button type="button" class="remove-btn" onclick="visitReportManager.removePhoto('${file.name}')"><i class="fas fa-times"></i></button>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
          `;
          preview.appendChild(previewItem);
          
          this.uploadedFiles.photos.push(file);
        };
        reader.readAsDataURL(file);
      }
    });
    
    event.target.value = '';
  }

  /**
   * Handle video upload
   */
  handleVideoUpload(event) {
    const files = Array.from(event.target.files);
    const preview = document.getElementById('videoPreview');
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEOS = 2;
    
    if (this.uploadedFiles.videos.length + files.length > MAX_VIDEOS) {
      notify.error(`You can only upload a maximum of ${MAX_VIDEOS} videos. Please remove some videos first.`);
      event.target.value = '';
      return;
    }
    
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      notify.error(`Some files exceed the maximum size of 10MB: ${oversizedFiles.map(f => f.name).join(', ')}`);
      event.target.value = '';
      return;
    }
    
    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
          <div class="video-icon"><i class="fas fa-film"></i></div>
          <button type="button" class="remove-btn" onclick="visitReportManager.removeVideo('${file.name}')"><i class="fas fa-times"></i></button>
          <span class="file-name">${file.name}</span>
          <span class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        `;
        preview.appendChild(previewItem);
        
        this.uploadedFiles.videos.push(file);
      }
    });
    
    event.target.value = '';
  }

  /**
   * Remove photo from upload list
   */
  removePhoto(fileName) {
    this.uploadedFiles.photos = this.uploadedFiles.photos.filter(file => file.name !== fileName);
    this.updatePhotoPreview();
  }

  /**
   * Remove video from upload list
   */
  removeVideo(fileName) {
    this.uploadedFiles.videos = this.uploadedFiles.videos.filter(file => file.name !== fileName);
    this.updateVideoPreview();
  }

  /**
   * Update photo preview
   */
  updatePhotoPreview() {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = '';
    
    this.uploadedFiles.photos.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
          <img src="${e.target.result}" alt="Preview">
          <button type="button" class="remove-btn" onclick="visitReportManager.removePhoto('${file.name}')"><i class="fas fa-times"></i></button>
          <span class="file-name">${file.name}</span>
          <span class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        `;
        preview.appendChild(previewItem);
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Update video preview
   */
  updateVideoPreview() {
    const preview = document.getElementById('videoPreview');
    preview.innerHTML = '';
    
    this.uploadedFiles.videos.forEach(file => {
      const previewItem = document.createElement('div');
      previewItem.className = 'preview-item';
      previewItem.innerHTML = `
        <div class="video-icon"><i class="fas fa-film"></i></div>
        <button type="button" class="remove-btn" onclick="visitReportManager.removeVideo('${file.name}')"><i class="fas fa-times"></i></button>
        <span class="file-name">${file.name}</span>
        <span class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
      `;
      preview.appendChild(previewItem);
    });
  }

  /**
   * Setup form submission
   */
  setupFormSubmission() {
    document.getElementById('visitReportForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!this.selectedTeamId) {
        notify.error('Please select a team first');
        return;
      }
      
      if (!this.selectedVisitId) {
        notify.error('Please select a visit first');
        return;
      }
      
      // Get form values
      const childrenCount = parseInt(document.getElementById('childrenCount').value);
      const childrenResponse = document.getElementById('childrenResponse').value;
      const topicsCovered = document.getElementById('topicsCovered').value.trim();
      const teachingMethods = document.getElementById('teachingMethods').value.trim();
      const challengesFaced = document.getElementById('challengesFaced').value.trim();
      const suggestions = document.getElementById('suggestions').value.trim();
      
      // Validation
      const validationErrors = [];
      
      if (!childrenCount || isNaN(childrenCount)) {
        validationErrors.push('Please enter the number of children');
      } else if (childrenCount < 1) {
        validationErrors.push('Number of children must be at least 1');
      } else if (childrenCount > 500) {
        validationErrors.push('Number of children seems too high (max 500)');
      }
      
      if (!childrenResponse) {
        validationErrors.push('Please select the children\'s response');
      }
      
      if (!topicsCovered) {
        validationErrors.push('Please enter the topics covered');
      } else if (topicsCovered.length < 20) {
        validationErrors.push('Topics covered must be at least 20 characters (currently ' + topicsCovered.length + ')');
      }
      
      if (!teachingMethods) {
        validationErrors.push('Please enter the teaching methods used');
      } else if (teachingMethods.length < 20) {
        validationErrors.push('Teaching methods must be at least 20 characters (currently ' + teachingMethods.length + ')');
      }
      
      if (challengesFaced && challengesFaced.length < 15) {
        validationErrors.push('Challenges faced should be at least 15 characters or leave it empty');
      }
      
      if (this.uploadedFiles.photos.length === 0 && this.uploadedFiles.videos.length === 0) {
        validationErrors.push('Please upload at least one photo or video from the visit');
      }
      
      if (this.uploadedFiles.photos.length > 10) {
        validationErrors.push('Maximum 10 photos allowed (currently ' + this.uploadedFiles.photos.length + ')');
      }
      
      if (this.uploadedFiles.videos.length > 3) {
        validationErrors.push('Maximum 3 videos allowed (currently ' + this.uploadedFiles.videos.length + ')');
      }
      
      if (validationErrors.length > 0) {
        notify.error('<strong>Please fix the following:</strong><br>' + validationErrors.join('<br>'));
        return;
      }

      const loadingModal = document.getElementById('loadingModal');
      const uploadProgress = document.getElementById('uploadProgress');
      loadingModal.style.display = 'block';

      try {
        // Get compressed photos from uploader if compression is enabled
        let photosToUpload = this.uploadedFiles.photos;
        let videosToUpload = this.uploadedFiles.videos;

        // Compress photos if needed
        if (photosToUpload.length > 0 && this.photoUploader) {
          uploadProgress.textContent = 'Compressing photos...';
          try {
            const compressed = await this.photoUploader.compressFiles(photosToUpload, (progress) => {
              uploadProgress.textContent = `Compressing photos... ${progress}%`;
            });
            photosToUpload = compressed;
            console.log('Photos compressed:', compressed.length);
          } catch (compressError) {
            console.warn('Photo compression failed, using originals:', compressError);
            // Continue with original files if compression fails
          }
        }
        
        // Upload files with progress tracking
        uploadProgress.textContent = 'Uploading files...';
        const formData = new FormData();
        
        console.log('Photos to upload:', photosToUpload.length);
        console.log('Videos to upload:', videosToUpload.length);
        
        photosToUpload.forEach(photo => {
          formData.append('photos', photo);
        });
        
        videosToUpload.forEach(video => {
          formData.append('videos', video);
        });
        
        formData.append('visitId', this.selectedVisitId);
        formData.append('teamId', this.selectedTeamId);

        let fileUrls = { photos: [], videos: [] };
        
        if (photosToUpload.length > 0 || videosToUpload.length > 0) {
          try {
            // Use FileManager for upload with progress
            const fileManager = new FileManager();
            const uploadData = await fileManager.uploadWithProgress(
              `/api/visits/${this.selectedVisitId}/upload`,
              formData,
              (progress) => {
                uploadProgress.textContent = `Uploading files... ${progress}%`;
              }
            );
            
            if (uploadData && uploadData.success) {
              fileUrls = uploadData.data;
              uploadProgress.textContent = 'Files uploaded successfully!';
            } else {
              // Surface inline near upload area
              this.showInlineAlert(uploadData.message || 'File upload failed', /Uploads (open|closed)/i.test(uploadData?.message) ? 'warning' : 'error');
              throw new Error(uploadData.message || 'File upload failed');
            }
          } catch (uploadError) {
            console.error('File upload error:', uploadError);
            // If server enforced window, show inline
            const msg = uploadError?.message || 'File upload failed';
            if (/Uploads (open|closed)/i.test(msg) || /12:00\s*PM/i.test(msg)) {
              this.showInlineAlert(msg, 'warning');
            }
            throw uploadError;
          }
        }

        // Submit report
        uploadProgress.textContent = 'Submitting report...';
        const reportData = {
          team: this.selectedTeamId,
          childrenCount: childrenCount,
          childrenResponse: childrenResponse,
          topicsCovered: topicsCovered,
          teachingMethods: teachingMethods,
          challengesFaced: challengesFaced,
          suggestions: suggestions,
          photos: fileUrls.photos,
          videos: fileUrls.videos
        };

        try {
          uploadProgress.textContent = 'Submitting report data...';
          const reportResult = await api.completeVisitReport(this.selectedVisitId, reportData);
          if (reportResult && reportResult.success) {
            loadingModal.style.display = 'none';
            notify.success('Visit report submitted successfully!');
            this.clearForm();
            setTimeout(() => {
              window.location.href = 'dashboard.html';
            }, 2000);
          } else {
            const msg = reportResult?.message || 'Report submission failed';
            if (/Uploads (open|closed)/i.test(msg)) this.showInlineAlert(msg, 'error');
            throw new Error(msg);
          }
        } catch (reportError) {
          console.error('Report submission error:', reportError);
          throw reportError;
        }

      } catch (error) {
        loadingModal.style.display = 'none';
        console.error('Error submitting report:', error);
        
        let errorMessage = error.message || 'An unknown error occurred';
        
        if (errorMessage === 'Something went wrong!') {
          errorMessage = 'Server error: Unable to process your report. Please try again later or contact support.';
        }
        
        // Prefer inline for time-window errors, toast otherwise
        if (/Uploads (open|closed)/i.test(errorMessage) || /12:00\s*PM/i.test(errorMessage)) {
          this.showInlineAlert(errorMessage, 'error');
        } else {
          notify.error('Failed to submit report: ' + errorMessage);
        }
      }
    });
  }

  /**
   * Clear form
   */
  clearForm() {
    document.getElementById('visitReportForm').reset();
    document.getElementById('visitSelect').value = '';
    document.getElementById('visitDetails').style.display = 'none';
    document.getElementById('visitReportForm').style.display = 'none';
    
    // Reset uploaders
    if (this.photoUploader) {
      this.photoUploader.clear();
    }
    if (this.videoUploader) {
      this.videoUploader.clear();
    }
    
    this.uploadedFiles.photos = [];
    this.uploadedFiles.videos = [];
    this.selectedVisitId = null;
    
    document.getElementById('visitSelectionSection').style.display = 'block';
    this.updateLoadingStatus('Please select a visit for the chosen team', false, 'visitLoadingStatus');
  }

  /**
   * Update loading status
   */
  updateLoadingStatus(message, isError = false, elementId = 'visitLoadingStatus') {
    const statusElement = document.getElementById(elementId);
    if (!statusElement) {
      console.error(`Status element with id ${elementId} not found`);
      return;
    }
    
    if (isError) {
      statusElement.innerHTML = `<i class="fas fa-exclamation-circle" style="color: #f44336;"></i> ${message}`;
      statusElement.classList.add('error-status');
    } else {
      statusElement.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
      statusElement.classList.remove('error-status');
    }
  }
}

// Global instance and functions for onclick handlers
let visitReportManager;

function clearForm() {
  if (visitReportManager) {
    visitReportManager.clearForm();
  }
}

// Initialize visit report manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  visitReportManager = new VisitReportManager();
});
