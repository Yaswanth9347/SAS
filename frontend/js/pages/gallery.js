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
        const schoolName =
          document.getElementById("schoolSelect").selectedOptions[0].text;
        filterText = `from ${schoolName}`;
      } else if (currentFilter === "team" && currentTeam) {
        const teamName =
          document.getElementById("teamSelect").selectedOptions[0].text;
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

  const html = photos
    .map((photo) => {
      const isNew = isWithinDays(photo.visitDate, 7);
      const schoolName = photo.school?.name || "Unknown School";
      const teamName = photo.team?.name || "Unknown Team";
      const date = formatDate(photo.visitDate);

      if (photo.type === "photo") {
        return `
        <div class="photo-card" onclick="openLightbox('${
          photo.url
        }', 'image', '${escapeHtml(schoolName)} - ${escapeHtml(date)}')">
          ${isNew ? '<span class="new-badge">NEW</span>' : ""}
          <div class="photo-img">
            <img src="${photo.url}" alt="Visit photo" loading="lazy" />
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
              <button class="icon-btn" onclick="event.stopPropagation(); downloadPhoto('${
                photo.url
              }')" title="Download">
                📥
              </button>
              <button class="icon-btn" onclick="event.stopPropagation(); toggleFavorite('${
                photo.url
              }')" title="Favorite">
                ⭐
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

// Download photo
function downloadPhoto(url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = url.split("/").pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  notify.success("Download started!");
}

// Toggle favorite (placeholder - needs backend implementation)
function toggleFavorite(url) {
  notify.info("Favorite feature coming soon!");
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
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  lightbox.style.display = "none";
  document.getElementById("lightbox-video").pause();
  document.removeEventListener("keydown", handleLightboxKeypress);
}

function handleLightboxKeypress(e) {
  if (e.key === "Escape") {
    closeLightbox();
  }
  // TODO: Add arrow key navigation between photos
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGallery);
} else {
  initGallery();
}
