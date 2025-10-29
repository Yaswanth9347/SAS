// Visit Gallery Page Logic (All-media view with optional filters)
authManager.requireAuth();
const user = authManager.getUser();

let currentMediaList = [];
let currentMediaIndex = -1;

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

  currentMediaList = [];
  photos.forEach(p => currentMediaList.push({ src: p.url, type: 'image' }));
  const videoStartIdx = currentMediaList.length;
  videos.forEach(v => currentMediaList.push({ src: v.url, type: 'video' }));

  let html = '';

  if (photos.length) {
    html += `
    <div class="gallery-section">
      <h3>📸 Photos (${photos.length})</h3>
      <div class="photo-grid">
        ${photos.map((p, idx) => `
          <div class="gallery-item" onclick="openLightboxByIndex(${idx})">
            <img src="${p.url}" alt="Photo" loading="lazy">
          </div>`).join('')}
      </div>
    </div>`;
  }

  if (videos.length) {
    html += `
    <div class="gallery-section">
      <h3>🎥 Videos (${videos.length})</h3>
      <div class="video-grid">
        ${videos.map((v, i) => `
          <div class="gallery-item" onclick="openLightboxByIndex(${videoStartIdx + i})">
            <div class="video-thumbnail">
              <div class="play-icon">▶</div>
              <span>Watch Video</span>
            </div>
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
            <div class="doc-actions"><a href="${d.url}" target="_blank" rel="noopener">Open</a></div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  gallery.innerHTML = html || '<div class="empty-gallery"><p>No media to display.</p></div>';
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
  
  switch(e.key) {
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
