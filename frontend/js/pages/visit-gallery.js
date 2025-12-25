// Visit Gallery Page Logic (All-media view with optional filters)
authManager.requireAuth();
const user = authManager.getUser();

let currentMediaList = [];
let currentMediaIndex = -1;

/**
 * Convert relative media URL to absolute URL
 */
function toAbsoluteMediaUrl(url) {
  if (!url) return url;
  // If already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Get base URL from window location or config
  const base = window.location.origin || 'http://localhost:5001';
  // Ensure single leading slash
  const path = url.startsWith('/') ? url : '/' + url;
  return base + path;
}

async function loadFilters() {
  // Populate Team filter
  try {
    const teamSel = document.getElementById('filterTeam');
    const schoolSel = document.getElementById('filterSchool');
    if (teamSel) {
      const tRes = await api.getTeams();
      if (tRes?.success && Array.isArray(tRes.data)) {
        teamSel.innerHTML = '<option value="">All Teams</option>' + tRes.data.map(t => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join('');
      }
    }
    if (schoolSel) {
      const sRes = await api.getSchools();
      if (sRes?.success && Array.isArray(sRes.data)) {
        schoolSel.innerHTML = '<option value="">All Schools</option>' + sRes.data.map(s => `<option value="${s._id}">${escapeHtml(s.name)}</option>`).join('');
      }
    }
  } catch (e) {
    console.warn('Failed to load filters', e);
  }
}

function getSelectedFilters() {
  const team = document.getElementById('filterTeam')?.value || '';
  const school = document.getElementById('filterSchool')?.value || '';
  const startDate = document.getElementById('filterStartDate')?.value || '';
  const endDate = document.getElementById('filterEndDate')?.value || '';
  const params = { limit: 500 };
  if (team) params.team = team;
  if (school) params.school = school;
  if (startDate && endDate) {
    params.startDate = startDate;
    params.endDate = endDate;
  }
  return params;
}

async function loadAllMedia(params = {}) {
  const gallery = document.getElementById('galleryContent');
  try {
    loading.show('galleryContent', 'Loading gallery...');
    const res = await api.getAllGalleryMedia(params);
    loading.hide('galleryContent');
    if (res?.success) {
      renderAllMedia(res.data);
    } else {
      gallery.innerHTML = '<p>Error loading gallery</p>';
      currentMediaList = [];
      currentMediaIndex = -1;
    }
  } catch (e) {
    loading.hide('galleryContent');
    handleAPIError(e);
    const gallery = document.getElementById('galleryContent');
    if (gallery) gallery.innerHTML = '<p>Error loading gallery</p>';
  }
}

function renderAllMedia(mediaItems) {
  const gallery = document.getElementById('galleryContent');

  console.log('🎨 renderAllMedia called with:', mediaItems.length, 'items');
  console.log('📸 First photo sample:', mediaItems.find(m => m.type === 'photo'));

  if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
    gallery.innerHTML = `
      <div class="empty-gallery">
        <h3>No media available</h3>
        <p>All photos, videos, and documents will appear here when uploaded.</p>
      </div>`;
    currentMediaList = [];
    currentMediaIndex = -1;
    return;
  }

  const photos = mediaItems.filter(m => m.type === 'photo');
  const videos = mediaItems.filter(m => m.type === 'video');
  const docs = mediaItems.filter(m => m.type === 'doc');

  console.log('📊 Photos:', photos.length, 'Videos:', videos.length, 'Docs:', docs.length);
  if (photos.length > 0) {
    const firstPhoto = photos[0];
    const absoluteUrl = toAbsoluteMediaUrl(firstPhoto.url);
    console.log('🔗 First photo URL transformation:');
    console.log('  Original:', firstPhoto.url);
    console.log('  Absolute:', absoluteUrl);
  }

  const isAdmin = user && user.role === 'admin';

  currentMediaList = [];
  photos.forEach(p => currentMediaList.push({ src: toAbsoluteMediaUrl(p.url), type: 'image', url: p.url, visitId: p.visitId }));
  const videoStartIdx = currentMediaList.length;
  videos.forEach(v => currentMediaList.push({ src: toAbsoluteMediaUrl(v.url), type: 'video', url: v.url, visitId: v.visitId }));

  let html = '';

  if (photos.length) {
    html += `
    <div class="gallery-section">
      <h3>📸 Photos (${photos.length})</h3>
      <div class="photo-grid">
        ${photos.map((p, idx) => {
      const imageUrl = toAbsoluteMediaUrl(p.url);
      console.log(`🖼️ Rendering photo ${idx + 1}: ${imageUrl}`);
      return `
          <div class="gallery-item" data-index="${idx}" data-type="photo">
            <img src="${imageUrl}" alt="Photo" loading="lazy">
            ${isAdmin ? `<button class="delete-media-btn" data-url="${p.url}" data-visit-id="${p.visitId}" data-type="photos" title="Delete photo"><i class="fas fa-trash"></i></button>` : ''}
          </div>`;
    }).join('')}
      </div>
    </div>`;
  }

  if (videos.length) {
    html += `
    <div class="gallery-section">
      <h3>🎥 Videos (${videos.length})</h3>
      <div class="video-grid">
        ${videos.map((v, i) => `
          <div class="gallery-item" data-index="${videoStartIdx + i}" data-type="video">
            <div class="video-thumbnail">
              <div class="play-icon">▶</div>
              <span>Watch Video</span>
            </div>
            ${isAdmin ? `<button class="delete-media-btn" data-url="${v.url}" data-visit-id="${v.visitId}" data-type="videos" title="Delete video"><i class="fas fa-trash"></i></button>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }

  if (docs.length) {
    html += `
    <div class="gallery-section">
      <h3>📄 Documents (${docs.length})</h3>
      <div class="document-grid">
        ${docs.map(d => `
          <div class="doc-card">
            <div class="doc-icon"><i class="fa fa-file"></i></div>
            <div class="doc-info">
              <div class="doc-name" title="${escapeHtml(d.name || 'Document')}">${escapeHtml(d.name || 'Document')}</div>
              <div class="doc-meta">${d.school?.name ? escapeHtml(d.school.name) + ' • ' : ''}${d.team?.name ? escapeHtml(d.team.name) + ' • ' : ''}${new Date(d.visitDate).toLocaleDateString()}</div>
            </div>
            <div class="doc-actions">
              <a href="${toAbsoluteMediaUrl(d.url)}" target="_blank" rel="noopener">Open</a>
              ${isAdmin ? `<button class="delete-media-btn" data-url="${d.url}" data-visit-id="${d.visitId}" data-type="docs" title="Delete document"><i class="fas fa-trash"></i></button>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  gallery.innerHTML = html || '<div class="empty-gallery"><p>No media to display.</p></div>';

  // Add event listeners after rendering (fixes CSP inline onclick issue)
  gallery.querySelectorAll('.gallery-item[data-index]').forEach(item => {
    item.addEventListener('click', function (e) {
      // Don't open lightbox if clicking delete button
      if (e.target.closest('.delete-media-btn')) return;
      
      const index = parseInt(this.dataset.index);
      console.log('🖱️ Gallery item clicked, index:', index);
      openLightboxByIndex(index);
    });
  });

  // Add delete button event listeners (admin only)
  if (isAdmin) {
    gallery.querySelectorAll('.delete-media-btn').forEach(btn => {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const url = this.dataset.url;
        const visitId = this.dataset.visitId;
        const type = this.dataset.type;
        
        if (confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
          await deleteMediaFile(visitId, url, type);
        }
      });
    });
  }
}

/**
 * Open lightbox by media index (for keyboard navigation)
 */
function openLightboxByIndex(index) {
  if (index < 0 || index >= currentMediaList.length) return;

  currentMediaIndex = index;
  const media = currentMediaList[index];
  openLightbox(media.src, media.type);

  // Update navigation buttons
  updateLightboxNavButtons();
}

/**
 * Open lightbox with media
 */
function openLightbox(src, type) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-image');
  const vid = document.getElementById('lightbox-video');
  const caption = document.getElementById('lightbox-caption');

  if (type === 'image') {
    img.src = src;
    img.style.display = 'block';
    vid.style.display = 'none';
    vid.pause();
    caption.textContent = 'Photo from visit';
  } else {
    vid.src = src;
    vid.style.display = 'block';
    img.style.display = 'none';
    caption.textContent = 'Video from visit';
  }

  lightbox.style.display = 'flex';
}

/**
 * Close lightbox
 */
function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const vid = document.getElementById('lightbox-video');

  lightbox.style.display = 'none';
  vid.pause();
  vid.currentTime = 0;
  vid.src = '';
}

/**
 * Navigate to previous media
 */
function showPreviousMedia() {
  if (currentMediaIndex > 0) {
    openLightboxByIndex(currentMediaIndex - 1);
  }
}

/**
 * Navigate to next media
 */
function showNextMedia() {
  if (currentMediaIndex < currentMediaList.length - 1) {
    openLightboxByIndex(currentMediaIndex + 1);
  }
}

/**
 * Update navigation button states
 */
function updateLightboxNavButtons() {
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  if (prevBtn) {
    prevBtn.disabled = currentMediaIndex <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled = currentMediaIndex >= currentMediaList.length - 1;
  }
}

/**
 * Handle keyboard events in lightbox
 */
function handleLightboxKeyboard(e) {
  const lightbox = document.getElementById('lightbox');
  if (lightbox.style.display !== 'flex') return;

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      showPreviousMedia();
      break;
    case 'ArrowRight':
      e.preventDefault();
      showNextMedia();
      break;
  }
}

/**
 * Touch Swipe Support for Lightbox
 * Enables swipe left/right to navigate photos on mobile
 */
let touchStartX = 0;
let touchEndX = 0;
const minSwipeDistance = 50; // Minimum distance for swipe gesture

function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
}

function handleTouchEnd(e) {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipeGesture();
}

function handleSwipeGesture() {
  const swipeDistance = touchEndX - touchStartX;

  // Swipe left (next)
  if (swipeDistance < -minSwipeDistance) {
    showNextMedia();
  }

  // Swipe right (previous)
  if (swipeDistance > minSwipeDistance) {
    showPreviousMedia();
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Close button
  const closeBtn = document.querySelector('.close-lightbox');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeLightbox);
  }

  // Click outside to close
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    // Add touch swipe support
    lightbox.addEventListener('touchstart', handleTouchStart, { passive: true });
    lightbox.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  // Keyboard navigation
  document.addEventListener('keydown', handleLightboxKeyboard);

  // Initialize filters and load all media by default
  loadFilters().then(() => loadAllMedia());

  // Hook up filter actions
  const applyBtn = document.getElementById('applyFiltersBtn');
  const clearBtn = document.getElementById('clearFiltersBtn');
  if (applyBtn) applyBtn.addEventListener('click', () => {
    const sd = document.getElementById('filterStartDate')?.value || '';
    const ed = document.getElementById('filterEndDate')?.value || '';
    if (sd && ed && new Date(sd) > new Date(ed)) {
      if (typeof notify !== 'undefined') notify.warning('Start date should be before End date');
      return;
    }
    loadAllMedia(getSelectedFilters());
  });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    const teamSel = document.getElementById('filterTeam');
    const schoolSel = document.getElementById('filterSchool');
    const sd = document.getElementById('filterStartDate');
    const ed = document.getElementById('filterEndDate');
    if (teamSel) teamSel.value = '';
    if (schoolSel) schoolSel.value = '';
    if (sd) sd.value = '';
    if (ed) ed.value = '';
    loadAllMedia();
  });
});

/**
 * Delete a media file (admin only)
 */
async function deleteMediaFile(visitId, url, type) {
  console.log('🗑️  Delete initiated:', { visitId, url, type });
  
  try {
    loading.show('galleryContent', 'Deleting file...');
    
    console.log('📤 Calling API deleteMedia...');
    const response = await api.deleteMedia(visitId, { url, type });
    console.log('📥 API response:', response);
    
    loading.hide('galleryContent');
    
    if (response && response.success) {
      console.log('✅ Delete successful');
      if (typeof notify !== 'undefined') {
        notify.success('File deleted successfully');
      } else {
        alert('File deleted successfully');
      }
      // Reload the gallery
      console.log('🔄 Reloading gallery...');
      const filters = getSelectedFilters();
      await loadAllMedia(filters);
    } else {
      const errorMsg = response?.message || 'Failed to delete file';
      console.error('❌ Delete failed:', errorMsg);
      if (typeof notify !== 'undefined') {
        notify.error(errorMsg);
      } else {
        alert(errorMsg);
      }
    }
  } catch (error) {
    loading.hide('galleryContent');
    console.error('❌ Delete error:', error);
    const errorMsg = error.message || 'An error occurred while deleting the file';
    if (typeof notify !== 'undefined') {
      notify.error(errorMsg);
    } else {
      alert(errorMsg);
    }
  }
}
