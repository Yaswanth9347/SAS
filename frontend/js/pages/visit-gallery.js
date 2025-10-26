// Visit Gallery Page Logic
// Require authentication
authManager.requireAuth();
const user = authManager.getUser();

// Media tracking for keyboard navigation
let currentMediaList = [];
let currentMediaIndex = -1;

/**
 * Load all completed visits into the select dropdown
 */
async function loadCompletedVisits() {
  const select = document.getElementById('visitSelect');
  if (!select) return;

  // Show loading state
  select.innerHTML = '<option>Loading visits...</option>';
  select.disabled = true;

  try {
    const data = await api.getVisits({ status: 'completed' });

    if (data && data.success) {
      if (!data.data || data.data.length === 0) {
        select.innerHTML = '<option>No completed visits yet</option>';
        select.disabled = true;
        return;
      }

      // Populate dropdown with completed visits
      select.innerHTML = '<option value="">Select a visit</option>' +
        data.data.map((v) => 
          `<option value="${v._id}">${escapeHtml(v.school?.name || 'School')} - ${formatDate(v.date)}</option>`
        ).join('');
      
      select.disabled = false;
      select.addEventListener('change', loadVisitGallery);
    } else {
      select.innerHTML = '<option>Error loading visits</option>';
      select.disabled = true;
    }
  } catch (err) {
    select.innerHTML = '<option>Error loading visits</option>';
    select.disabled = true;
    handleAPIError(err);
  }
}

/**
 * Load gallery for selected visit
 */
async function loadVisitGallery(e) {
  const id = e.target.value;
  const gallery = document.getElementById('galleryContent');
  
  if (!id) {
    gallery.innerHTML = `
      <div class="empty-gallery">
        <h3>Select a visit to view photos and videos</h3>
        <p>Choose from your completed visits to see the gallery.</p>
      </div>`;
    currentMediaList = [];
    currentMediaIndex = -1;
    return;
  }

  try {
    loading.show('galleryContent', 'Loading gallery...');
    const data = await api.getVisitGallery(id);
    loading.hide('galleryContent');

    if (data && data.success) {
      displayGallery(data.data);
    } else {
      gallery.innerHTML = '<p>Error loading gallery</p>';
      currentMediaList = [];
      currentMediaIndex = -1;
    }
  } catch (err) {
    loading.hide('galleryContent');
    gallery.innerHTML = '<p>Error loading gallery</p>';
    handleAPIError(err);
    currentMediaList = [];
    currentMediaIndex = -1;
  }
}

/**
 * Display gallery content
 */
function displayGallery(data) {
  const gallery = document.getElementById('galleryContent');
  
  // Check if there's any media
  const hasPhotos = data.photos && data.photos.length > 0;
  const hasVideos = data.videos && data.videos.length > 0;
  
  if (!hasPhotos && !hasVideos) {
    gallery.innerHTML = `
      <div class="empty-gallery">
        <h3>No media available</h3>
        <p>No photos or videos were uploaded for this visit.</p>
      </div>`;
    currentMediaList = [];
    currentMediaIndex = -1;
    return;
  }

  // Build media list for keyboard navigation
  currentMediaList = [];
  
  if (hasPhotos) {
    data.photos.forEach(photo => {
      currentMediaList.push({ src: photo, type: 'image' });
    });
  }
  
  if (hasVideos) {
    data.videos.forEach(video => {
      currentMediaList.push({ src: video, type: 'video' });
    });
  }

  // Build HTML
  let html = `
    <div class="gallery-header">
      <h2>${escapeHtml(data.school?.name || 'School')}</h2>
      <p>Visit Date: ${new Date(data.date).toLocaleDateString()}</p>
    </div>`;

  if (hasPhotos) {
    html += `
    <div class="gallery-section">
      <h3>📸 Photos (${data.photos.length})</h3>
      <div class="photo-grid">
        ${data.photos.map((photo, index) => `
          <div class="gallery-item" onclick="openLightboxByIndex(${index})">
            <img src="${photo}" alt="Visit photo" loading="lazy">
          </div>`).join('')}
      </div>
    </div>`;
  }

  if (hasVideos) {
    const videoStartIndex = hasPhotos ? data.photos.length : 0;
    html += `
    <div class="gallery-section">
      <h3>🎥 Videos (${data.videos.length})</h3>
      <div class="video-grid">
        ${data.videos.map((video, index) => `
          <div class="gallery-item" onclick="openLightboxByIndex(${videoStartIndex + index})">
            <div class="video-thumbnail">
              <div class="play-icon">▶</div>
              <span>Watch Video</span>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  gallery.innerHTML = html;
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
  
  // Initialize page
  loadCompletedVisits();
});
