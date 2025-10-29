// Enhanced Gallery Page - Simplified and Functional
authManager.requireAuth();

let currentPage = 1;
let totalPages = 1;
let currentFilter = "all";
let currentSearch = "";
let currentSchool = "";
let currentTeam = "";
let gridSize = "medium";
let allPhotos = [];

// Initialize gallery
async function initGallery() {
  console.log("Initializing gallery...");
  setupLightboxHandlers(); // Setup lightbox before loading
  await loadFilterData();
  setupEventListeners();
  await loadGalleryPhotos();
}

// Load teams and schools for dropdowns
async function loadFilterData() {
  try {
    const [teamsData, schoolsData] = await Promise.all([
      api.getTeams(),
      api.getSchools(),
    ]);

    const teamSelect = document.getElementById("teamFilter");
    const schoolSelect = document.getElementById("schoolFilter");

    if (teamsData.data && teamSelect) {
      teamSelect.innerHTML =
        '<option value="">Select a team...</option>' +
        teamsData.data
          .map((t) => `<option value="${t._id}">${escapeHtml(t.name)}</option>`)
          .join("");
    }

    if (schoolsData.data && schoolSelect) {
      schoolSelect.innerHTML =
        '<option value="">Select a school...</option>' +
        schoolsData.data
          .map((s) => `<option value="${s._id}">${escapeHtml(s.name)}</option>`)
          .join("");
    }
  } catch (error) {
    console.error("Error loading filter data:", error);
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      // Remove active from all
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      // Add active to clicked
      this.classList.add("active");

      const filter = this.getAttribute("data-filter");
      currentFilter = filter;
      currentPage = 1;

      // Show/hide dropdowns
      document.getElementById("schoolDropdown").style.display =
        filter === "school" ? "block" : "none";
      document.getElementById("teamDropdown").style.display =
        filter === "team" ? "block" : "none";

      // Load photos if not school/team (those wait for selection)
      if (filter !== "school" && filter !== "team") {
        loadGalleryPhotos();
      }
    });
  });

  // School/Team select
  const schoolSelect = document.getElementById("schoolFilter");
  const teamSelect = document.getElementById("teamFilter");

  if (schoolSelect) {
    schoolSelect.addEventListener("change", function () {
      currentSchool = this.value;
      if (currentSchool) {
        currentPage = 1;
        loadGalleryPhotos();
      }
    });
  }

  if (teamSelect) {
    teamSelect.addEventListener("change", function () {
      currentTeam = this.value;
      if (currentTeam) {
        currentPage = 1;
        loadGalleryPhotos();
      }
    });
  }

  // Search
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");

  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      currentSearch = searchInput?.value.trim() || "";
      currentPage = 1;
      loadGalleryPhotos();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        searchBtn?.click();
      }
    });
  }

  // Clear filters
  const clearBtn = document.getElementById("clearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      currentFilter = "all";
      currentSearch = "";
      currentSchool = "";
      currentTeam = "";
      currentPage = 1;
      if (searchInput) searchInput.value = "";
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      document.querySelector('[data-filter="all"]')?.classList.add("active");
      document.getElementById("schoolDropdown").style.display = "none";
      document.getElementById("teamDropdown").style.display = "none";
      loadGalleryPhotos();
    });
  }

  // Grid size toggle
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".view-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      gridSize = this.getAttribute("data-size");

      const grid = document.getElementById("galleryContent");
      grid.className = `gallery-grid ${gridSize}-grid`;
    });
  });

  // Pagination
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      if (currentPage > 1) {
        currentPage--;
        loadGalleryPhotos();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (currentPage < totalPages) {
        currentPage++;
        loadGalleryPhotos();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }
}

// Load gallery photos with current filters
async function loadGalleryPhotos() {
  const galleryContent = document.getElementById("galleryContent");
  const resultsBar = document.getElementById("resultsBar");
  const pagination = document.getElementById("pagination");

  try {
    // Show loading
    galleryContent.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading photos...</p>
      </div>`;

    // Build query params
    const params = {
      page: currentPage,
      limit: 50,
      sortBy: "recent",
    };

    if (currentFilter === "recent") {
      params.recent = 30;
    } else if (currentFilter === "school" && currentSchool) {
      params.school = currentSchool;
    } else if (currentFilter === "team" && currentTeam) {
      params.team = currentTeam;
    }

    console.log("Loading gallery with params:", params);

    // Call API
    const data = await api.getAllGalleryMedia(params);

    console.log("Gallery API response:", data);

    if (data && data.success) {
      allPhotos = data.data || [];

      // Apply search filter if any
      let filteredPhotos = allPhotos;
      if (currentSearch) {
        filteredPhotos = allPhotos.filter((photo) => {
          const searchLower = currentSearch.toLowerCase();
          const schoolName = photo.school?.name?.toLowerCase() || "";
          const teamName = photo.team?.name?.toLowerCase() || "";
          return (
            schoolName.includes(searchLower) || teamName.includes(searchLower)
          );
        });
      }

      // Update stats
      updateStats(data.count, filteredPhotos.length);

      if (filteredPhotos.length === 0) {
        galleryContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <h3>No photos found</h3>
            <p>Try adjusting your filters or upload some photos from visits!</p>
          </div>`;
        resultsBar.style.display = "none";
        pagination.style.display = "none";
        return;
      }

      // Display photos
      displayPhotos(filteredPhotos);

      // Show results bar
      resultsBar.style.display = "flex";
      document.getElementById("resultsCount").textContent = `${
        filteredPhotos.length
      } ${filteredPhotos.length === 1 ? "photo" : "photos"}`;

      let filterText = "";
      if (currentFilter === "recent") filterText = "from last 30 days";
      else if (currentFilter === "school" && currentSchool) {
        const schoolSelect = document.getElementById("schoolFilter");
        const schoolName =
          schoolSelect &&
          schoolSelect.selectedOptions &&
          schoolSelect.selectedOptions[0]
            ? schoolSelect.selectedOptions[0].text
            : "Selected School";
        filterText = `from ${schoolName}`;
      } else if (currentFilter === "team" && currentTeam) {
        const teamSelect = document.getElementById("teamFilter");
        const teamName =
          teamSelect &&
          teamSelect.selectedOptions &&
          teamSelect.selectedOptions[0]
            ? teamSelect.selectedOptions[0].text
            : "Selected Team";
        filterText = `from ${teamName}`;
      } else filterText = "all time";

      if (currentSearch) filterText += ` matching "${currentSearch}"`;
      document.getElementById("resultsFilter").textContent = filterText;

      // Handle pagination
      totalPages = data.totalPages || 1;
      if (totalPages > 1) {
        pagination.style.display = "flex";
        document.getElementById(
          "pageInfo"
        ).textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById("prevPage").disabled = currentPage <= 1;
        document.getElementById("nextPage").disabled =
          currentPage >= totalPages;
      } else {
        pagination.style.display = "none";
      }
    } else {
      throw new Error("Failed to load gallery");
    }
  } catch (error) {
    console.error("Error loading gallery:", error);
    galleryContent.innerHTML = `
      <div class="empty-state error">
        <div class="empty-icon">⚠️</div>
        <h3>Error loading gallery</h3>
        <p>${error.message || "Please try again later"}</p>
      </div>`;
    resultsBar.style.display = "none";
    pagination.style.display = "none";
  }
}

// Display photos in grid
function displayPhotos(photos) {
  const galleryContent = document.getElementById("galleryContent");

  // Get base URL for images (remove /api from API_BASE_URL)
  const baseURL = CONFIG.API_BASE_URL.replace("/api", "");

  const html = photos
    .map((photo) => {
      const isNew = isWithinDays(photo.visitDate, 7);
      const schoolName = photo.school?.name || "Unknown School";
      const teamName = photo.team?.name || "Unknown Team";
      const date = formatDate(photo.visitDate);

      // Ensure photo URL is valid and absolute
      let photoUrl = photo.url || "";
      if (typeof photoUrl === "object") {
        // Handle if url is still an object (shouldn't happen, but safety check)
        photoUrl = photoUrl.path || photoUrl.cloudUrl || "";
      }

      // Convert to string and make absolute URL
      photoUrl = String(photoUrl);

      // Make sure path has leading slash
      if (
        photoUrl &&
        !photoUrl.startsWith("http") &&
        !photoUrl.startsWith("/")
      ) {
        photoUrl = "/" + photoUrl;
      }

      // Prepend base URL if not already absolute
      if (photoUrl && !photoUrl.startsWith("http")) {
        photoUrl = `${baseURL}${photoUrl}`;
      }

      // Skip if no valid URL
      if (!photoUrl) {
        console.warn("Photo has no valid URL:", photo);
        return "";
      }

      // Debug log to see the actual URL
      console.log("Photo URL:", photoUrl);

      if (photo.type === "photo") {
        // Escape quotes in URLs for onclick handlers
        const escapedUrl = photoUrl.replace(/'/g, "\\'");

        return `
        <div class="photo-card" onclick="openLightbox('${escapedUrl}', 'image', '${escapeHtml(
          schoolName
        )} - ${escapeHtml(date)}')">
          ${isNew ? '<span class="new-badge">NEW</span>' : ""}
          <div class="photo-img">
            <img src="${photoUrl}" alt="Visit photo" loading="lazy" onerror="handleImageError(this)" />
          </div>
          <div class="photo-info">
            <div class="photo-meta">
              <span class="meta-school" title="${escapeHtml(
                schoolName
              )}">🏫 ${escapeHtml(schoolName)}</span>
              <span class="meta-team" title="${escapeHtml(
                teamName
              )}">👥 ${escapeHtml(teamName)}</span>
              <span class="meta-date">📅 ${escapeHtml(date)}</span>
            </div>
            <div class="photo-actions">
              <button class="download-btn" onclick="event.stopPropagation(); downloadPhoto('${escapedUrl}', 'photo')" title="Download">
                ↓
              </button>
            </div>
          </div>
        </div>`;
      }
      return "";
    })
    .join("");

  galleryContent.innerHTML =
    html || '<div class="empty-state"><p>No photos to display</p></div>';
}

// Update statistics
function updateStats(total, filtered) {
  document.getElementById("totalPhotos").textContent = total || 0;

  // Count photos from last 7 days
  const recent = allPhotos.filter((p) => isWithinDays(p.visitDate, 7)).length;
  document.getElementById("recentPhotos").textContent = recent;
}

// Helper: Check if date is within N days
function isWithinDays(date, days) {
  if (!date) return false;
  const photoDate = new Date(date);
  const now = new Date();
  const diffTime = now - photoDate;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

// Helper: Format date
function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Download photo or video with proper extension
function downloadPhoto(url, type = "photo") {
  // Extract filename from URL
  const urlParts = url.split("/");
  const filename = urlParts[urlParts.length - 1];

  // Determine file extension
  let finalFilename = filename;
  if (type === "photo") {
    // Ensure it has .jpg extension
    if (!filename.match(/\.(jpg|jpeg|png|gif)$/i)) {
      finalFilename = filename.replace(/\.[^.]+$/, ".jpg");
    }
  } else if (type === "video") {
    // Ensure it has .mp4 extension (not mpg, as modern browsers use mp4)
    if (!filename.match(/\.(mp4|webm|mov)$/i)) {
      finalFilename = filename.replace(/\.[^.]+$/, ".mp4");
    }
  }

  // Download using fetch to avoid CORS issues
  fetch(url)
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      notify.success("Download started!");
    })
    .catch((error) => {
      console.error("Download error:", error);
      // Fallback to direct download
      const link = document.createElement("a");
      link.href = url;
      link.download = finalFilename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify.success("Download started!");
    });
}

// Lightbox functions (enhanced with keyboard navigation)
function openLightbox(src, type, caption = "") {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-image");
  const video = document.getElementById("lightbox-video");
  const captionEl = document.getElementById("lightbox-caption");

  if (type === "image") {
    img.src = src;
    img.style.display = "block";
    video.style.display = "none";
  } else {
    video.src = src;
    video.style.display = "block";
    img.style.display = "none";
  }

  captionEl.textContent = caption;
  lightbox.style.display = "flex";

  // Enable keyboard navigation
  document.addEventListener("keydown", handleLightboxKeypress);

  // Prevent body scroll
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  const video = document.getElementById("lightbox-video");

  lightbox.style.display = "none";

  // Pause video if playing
  if (video) {
    video.pause();
    video.src = "";
  }

  // Clear image
  const img = document.getElementById("lightbox-image");
  if (img) {
    img.src = "";
  }

  // Re-enable body scroll
  document.body.style.overflow = "";

  // Remove keyboard listener
  document.removeEventListener("keydown", handleLightboxKeypress);
}

function handleLightboxKeypress(e) {
  if (e.key === "Escape") {
    closeLightbox();
  }
  // TODO: Add arrow key navigation between photos
}

// Setup lightbox close button
function setupLightboxHandlers() {
  const closeBtn = document.querySelector(".close-lightbox");
  const lightbox = document.getElementById("lightbox");

  if (closeBtn) {
    closeBtn.onclick = function (e) {
      e.stopPropagation();
      closeLightbox();
    };
  }

  // Close when clicking outside the image
  if (lightbox) {
    lightbox.onclick = function (e) {
      if (e.target === lightbox) {
        closeLightbox();
      }
    };
  }
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Handle image loading error
function handleImageError(img) {
  console.error("Failed to load image:", img.src);
  img.style.backgroundColor = "#f0f0f0";
  img.style.padding = "20px";
  img.alt = "Image not found";
  // Set a simple placeholder
  img.src =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
        '<rect fill="#ddd" width="200" height="200"/>' +
        '<text fill="#999" x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial">Image not found</text>' +
        "</svg>"
    );
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}
