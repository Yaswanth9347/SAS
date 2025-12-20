// Visits page script - modern card UI with compact icons

// Authentication
authManager.requireAuth();
const user = authManager.getUser();

// Inline icons
const iconEdit = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
const iconDelete = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1z"/></svg>';
const iconCancel = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12Z"/></svg>';
const iconCalendar = '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10h5v5H7z" fill="none"/><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.89 2 1.99 2H19c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg></span>';
const iconTeam = '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h10v-2.5C11 14.17 6.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></span>';
const iconSchool = '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13L3 12.09V17l9 5 9-5v-4.91L12 16z"/></svg></span>';

// Helper to ensure absolute media URLs
function toAbsoluteMediaUrl(url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = window.location.origin || 'http://localhost:5001';
  const path = url.startsWith('/') ? url : '/' + url;
  return base + path;
}

function statusClassName(status) {
  const s = (status || 'scheduled').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'visited') return 'visited';
  if (s === 'cancelled') return 'cancelled';
  return 'scheduled';
}

// Load all visits and render as cards
aSYNC_loadVisits();
async function aSYNC_loadVisits() {
  try {
    loading.show('visitsList', 'Loading visits...');
    const data = await api.getVisits();
    loading.hide('visitsList');

    const list = document.getElementById('visitsList');
    if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
      renderNoData('visitsList', 'No visits found yet. Schedule your first visit!');
      return;
    }

    list.innerHTML = '';
    data.data.forEach(visit => {
      const card = document.createElement('div');
      card.className = 'visit-card';

      const sClass = statusClassName(visit.status);

      // main content
      const main = document.createElement('div');
      main.className = 'visit-main';
      main.innerHTML = `
        <div class="visit-header">
          <div class="visit-title">${escapeHtml(visit.name || visit.school?.name || 'Visit')}</div>
          <span class="status-badge ${sClass}">${escapeHtml(visit.status || 'scheduled')}</span>
        </div>
        <div class="visit-meta">
          <div class="meta-item">${iconCalendar}<span>${formatDate(visit.date)}</span></div>
          <div class="meta-item">${iconTeam}<span>${escapeHtml(visit.team?.name || 'Team')}</span></div>
          ${visit.submittedBy ? `<div class=\"meta-item meta-right\">By ${escapeHtml(visit.submittedBy.name || 'Unknown')}</div>` : ''}
        </div>
        <div class="visit-meta">
          <div class="meta-item">${iconSchool}<span>${escapeHtml(visit.school?.name || '-')}</span></div>
        </div>
      `;

      // actions
      const actions = document.createElement('div');
      actions.className = 'visit-actions';

      if (sClass === 'cancelled') {
        actions.innerHTML = `
          <button class="icon-btn btn-edit" title="View Details" aria-label="View Details">${iconEdit}</button>
          <button class="icon-btn btn-delete" title="Delete" aria-label="Delete">${iconDelete}</button>
        `;
      } else if (sClass === 'scheduled') {
        actions.innerHTML = `
          <button class="icon-btn btn-edit" title="Edit Visit" aria-label="Edit">${iconEdit}</button>
          <button class="icon-btn btn-cancel-visit" data-action="cancel" title="Cancel Visit" aria-label="Cancel">${iconCancel}</button>
          <button class="icon-btn btn-delete" title="Delete" aria-label="Delete">${iconDelete}</button>
        `;
      } else if (sClass === 'visited') {
        // Visited status: can view details and upload media, but can't edit or cancel
        actions.innerHTML = `
          <button class="icon-btn btn-edit" title="View & Upload" aria-label="View & Upload">${iconEdit}</button>
          <button class="icon-btn btn-delete" title="Delete" aria-label="Delete">${iconDelete}</button>
        `;
      } else {
        // Completed: view only
        actions.innerHTML = `
          <button class="icon-btn btn-edit" title="View Details" aria-label="View Details">${iconEdit}</button>
          <button class="icon-btn btn-delete" title="Delete" aria-label="Delete">${iconDelete}</button>
        `;
      }

      card.appendChild(main);
      card.appendChild(actions);

      // Wire actions
      actions.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openVisitModal(visit);
      });

      const cancelBtn = actions.querySelector('[data-action="cancel"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          notify.confirm('Are you sure you want to cancel this visit?', async () => {
            try {
              loading.showFullPage('Cancelling visit...');
              const result = await api.cancelVisit(visit._id);
              loading.hideFullPage();
              if (result.success) { notify.success('Visit cancelled successfully!'); aSYNC_loadVisits(); }
              else { notify.error(result.message || 'Failed to cancel visit'); }
            } catch (err) { loading.hideFullPage(); handleAPIError(err); }
          });
        });
      }

      const deleteBtn = actions.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          notify.confirm('Delete this visit? This action cannot be undone.', async () => {
            try {
              loading.showFullPage('Deleting visit...');
              const result = await api.deleteVisit(visit._id);
              loading.hideFullPage();
              if (result.success) { notify.success('Visit successfully deleted!'); aSYNC_loadVisits(); }
              else { notify.error(result.message || 'Failed to delete visit'); }
            } catch (err) { loading.hideFullPage(); handleAPIError(err); }
          });
        });
      }

      // All visit cards open centered modal on click
      card.addEventListener('click', () => {
        openVisitInfoModal(visit);
      });

      list.appendChild(card);
    });

    attachDetailsHandlers();
  } catch (err) {
    loading.hide('visitsList');
    renderError('visitsList', 'Failed to load visits');
  }
}

function renderVisitDetailsHtml(visit) {
  const membersHtml = (visit.members && visit.members.length) ? `<p><strong>Team Members:</strong> ${escapeHtml(visit.members.join(', '))}</p>` : '';
  const assignedClass = visit.assignedClass ? `<p><strong>Assigned Class:</strong> ${escapeHtml(visit.assignedClass)}</p>` : '';
  const children = visit.childrenCount ? `<p><strong>Expected Children:</strong> <span class="highlight-count">${visit.childrenCount}</span></p>` : '';

  let mediaHtml = '';
  if ((visit.photos && visit.photos.length) || (visit.videos && visit.videos.length) || (visit.docs && visit.docs.length)) {
    mediaHtml += '<div class="visit-details-section">';
    mediaHtml += '<h3>Visit Media</h3>';

    if (visit.photos && visit.photos.length) {
      mediaHtml += `<div class="media-section">
        <h4>Photos (${visit.photos.length})</h4>
        <div class="media-gallery photos-gallery">
          ${visit.photos.map(p => {
        const photoUrl = typeof p === 'string' ? p : (p.path || p.url || p);
        return `
            <div class="media-item photo-item">
              <img src="${toAbsoluteMediaUrl(photoUrl)}" data-media-src="${toAbsoluteMediaUrl(photoUrl)}" data-media-type="image" alt="Visit photo" loading="lazy" />
            </div>
          `;
      }).join('')}
        </div>
      </div>`;
    }

    if (visit.videos && visit.videos.length) {
      mediaHtml += `<div class="media-section">
        <h4>Videos (${visit.videos.length})</h4>
        <div class="media-gallery videos-gallery">
          ${visit.videos.map(v => {
        const videoUrl = typeof v === 'string' ? v : (v.path || v.url || v);
        return `
            <div class="media-item video-item" data-media-src="${toAbsoluteMediaUrl(videoUrl)}" data-media-type="video">
              <div class="video-play-button">▶</div>
              <span>Play Video</span>
            </div>
          `;
      }).join('')}
        </div>
      </div>`;
    }

    if (visit.docs && visit.docs.length) {
      mediaHtml += `<div class="media-section">
        <h4>Documents (${visit.docs.length})</h4>
        <div class="docs-list">
          ${visit.docs.map(d => {
        const docUrl = typeof d === 'string' ? d : (d.path || d.url || d);
        const docName = typeof d === 'string' ? d.split('/').pop() : (d.originalName || d.filename || docUrl.split('/').pop());
        return `
            <div class="doc-item">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" fill="#3f51b5"/></svg>
              <a href="${docUrl}" target="_blank">${escapeHtml(docName)}</a>
            </div>
          `;
      }).join('')}
        </div>
      </div>`;
    }

    mediaHtml += '</div>';
  } else {
    mediaHtml = '<div class="visit-details-section"><h3>Visit Media</h3><p class="no-media">No media uploaded for this visit.</p></div>';
  }

  const uploadControls = `
    <div class="visit-details-section">
      <h3>Upload Media</h3>
      <div class="upload-controls">
        <input type="file" data-visit-id="${visit._id}" class="media-input" multiple />
        <button class="btn btn-save upload-btn" data-visit-id="${visit._id}">Upload Files</button>
      </div>
      <div class="upload-alert is-warning" data-visit-id="${visit._id}" role="alert" aria-live="polite" tabindex="-1" style="display:none"></div>
      <p class="upload-hint">Upload photos, videos, or documents related to this visit.</p>
    </div>
  `;

  return `
    <div class="visit-details-content">
      <div class="visit-info-section">
        <h3>Visit Information</h3>
        <div class="info-grid">
          <div class="info-column">
            <div class="detail-row"><div class="detail-label">School</div><div class="detail-value">${escapeHtml(visit.school && visit.school.name || '-')}</div></div>
            <div class="detail-row"><div class="detail-label">Team</div><div class="detail-value">${escapeHtml(visit.team && visit.team.name || '-')}</div></div>
            ${assignedClass ? `<div class="detail-row"><div class="detail-label">Assigned Class</div><div class="detail-value">${escapeHtml(visit.assignedClass)}</div></div>` : ''}
            <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value">${escapeHtml(visit.status || 'Scheduled')}</div></div>
          </div>
          <div class="info-column">
            ${membersHtml ? `<div class="detail-row"><div class="detail-label">Members</div><div class="detail-value">${escapeHtml(visit.members.join(', '))}</div></div>` : ''}
            ${children ? `<div class="detail-row"><div class="detail-label">Expected Children</div><div class="detail-value"><span class="highlight-count">${visit.childrenCount}</span></div></div>` : ''}
            <div class="detail-row"><div class="detail-label">Classes</div><div class="detail-value">${visit.classesVisited || 0} visited of ${visit.totalClasses || 0}</div></div>
            <div class="detail-row"><div class="detail-label">Visit Date</div><div class="detail-value">${new Date(visit.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
          </div>
        </div>
      </div>
      ${mediaHtml}
      ${uploadControls}
    </div>
  `;
}

function attachDetailsHandlers() {
  document.querySelectorAll('.upload-btn').forEach(btn => {
    btn.removeEventListener('click', onUploadClick);
    btn.addEventListener('click', onUploadClick);
  });

  // Media click handlers (photos and videos) - use data attributes to avoid inline handlers
  document.querySelectorAll('.media-item.photo-item img').forEach(img => {
    // remove any previously attached listener by cloning
    const newImg = img.cloneNode(true);
    img.parentNode.replaceChild(newImg, img);
    newImg.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = newImg.getAttribute('data-media-src') || newImg.src;
      if (typeof window.openLightbox === 'function') window.openLightbox(src, 'image');
    });
  });

  document.querySelectorAll('.media-item.video-item').forEach(div => {
    const newDiv = div.cloneNode(true);
    div.parentNode.replaceChild(newDiv, div);
    newDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = newDiv.getAttribute('data-media-src');
      if (typeof window.openLightbox === 'function') window.openLightbox(src, 'video');
    });
  });
}

async function onUploadClick(e) {
  const visitId = e.currentTarget.dataset.visitId;
  const input = document.querySelector(`input.media-input[data-visit-id="${visitId}"]`);
  const alertEl = document.querySelector(`.upload-alert[data-visit-id="${visitId}"]`);
  const showInline = (msg, level = 'warning') => {
    if (!alertEl) return;
    alertEl.classList.remove('is-error', 'is-success', 'is-info', 'is-warning');
    alertEl.classList.add(`is-${level}`);
    alertEl.innerHTML = escapeHtml(msg);
    alertEl.style.display = 'block';
    // Ensure user sees it
    alertEl.focus({ preventScroll: true });
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const clearInline = () => { if (alertEl) { alertEl.style.display = 'none'; alertEl.textContent = ''; } };
  if (!input || !input.files || !input.files.length) {
    showInline('Please select files to upload', 'warning');
    return;
  }

  const form = new FormData();
  let fileCount = 0;
  for (const file of input.files) {
    fileCount++;
    if (file.type.startsWith('image/')) form.append('photos', file);
    else if (file.type.startsWith('video/')) form.append('videos', file);
    else form.append('docs', file);
  }

  try {
    loading.showFullPage(`Uploading ${fileCount} file${fileCount !== 1 ? 's' : ''}...`);
    const result = await api.uploadVisitMedia(visitId, form);
    loading.hideFullPage();
    if (result.success) {
      clearInline();
      notify.success(`Successfully uploaded ${fileCount} file${fileCount !== 1 ? 's' : ''}!`);

      // Refresh the modal content with updated visit data
      try {
        const visitResponse = await api.getVisit(visitId);
        if (visitResponse.success && visitResponse.data) {
          const modalBody = document.getElementById('visit_info_body');
          if (modalBody) {
            // Re-render the modal content with updated data
            modalBody.innerHTML = renderVisitDetailsHtml(visitResponse.data);
            // Re-attach event handlers for the new content
            attachDetailsHandlers();
            // Clear the file input
            input.value = '';
          }
        }
      } catch (refreshError) {
        console.error('Failed to refresh modal:', refreshError);
        // Still reload visits list as fallback
        aSYNC_loadVisits();
      }
    }
    else {
      // Prefer inline error near upload area
      const msg = result.message || 'Upload failed';
      const isWindowMsg = /Uploads (open|closed)/i.test(msg) || /12:00\s*PM/i.test(msg);
      showInline(msg, isWindowMsg ? 'warning' : 'error');
    }
  } catch (err) {
    loading.hideFullPage();
    const msg = err?.message || 'Upload failed';
    showInline(escapeHtml(msg), 'error');
  }
}

// Drawer creation and handlers
(function createDrawer() {
  if (document.getElementById('visits_drawer')) return;
  const backdrop = document.createElement('div'); backdrop.className = 'drawer-backdrop'; backdrop.id = 'drawer_backdrop';
  const drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.id = 'visits_drawer';

  drawer.innerHTML = `
    <div class="drawer-header">
      <div style="display:flex;flex-direction:column">
        <div class="drawer-title">Visit Details</div>
        <div class="drawer-subtitle" id="drawer_subtitle"></div>
      </div>
    </div>
    <div class="drawer-body">
      <div class="drawer-form-grid">
        <div class="form-group"><label for="v_name">Visit Name</label><input id="v_name" type="text" placeholder="Enter visit name"></div>
        <div class="form-group"><label for="v_date">Visit Date</label><input id="v_date" type="date"></div>

        <div class="form-group"><label for="v_team">Team</label><select id="v_team"><option value="">Loading teams...</option></select></div>
        <div class="form-group"><label for="v_school">School</label><select id="v_school"><option value="">Loading schools...</option></select></div>

        <div class="form-group"><label for="v_assigned">Assigned Class</label><input id="v_assigned" type="text" placeholder="e.g., 6th Standard, Section A"></div>
        <div class="form-group"><label for="v_members">Team Members</label><input id="v_members" type="text" placeholder="Comma separated names"></div>

        <div class="form-group"><label for="v_total">Total Classes</label><input id="v_total" type="number" min="0" value="0"></div>
        <div class="form-group"><label for="v_visited">Classes Visited</label><input id="v_visited" type="number" min="0" value="0"></div>

        <div class="form-group"><label for="v_children">Expected Children</label><input id="v_children" type="number" min="0" value="30"></div>
        <div></div>
      </div>
    </div>
    <div class="drawer-footer">
      <button class="btn-cancel">Cancel</button>
      <button class="btn-save">Save Visit</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  backdrop.addEventListener('click', closeDrawer);
  drawer.querySelectorAll('.btn-cancel').forEach(b => b.addEventListener('click', closeDrawer));
})();

async function openVisitModal(visit = null) {
  const drawer = document.getElementById('visits_drawer');
  const backdrop = document.getElementById('drawer_backdrop');
  const title = drawer.querySelector('.drawer-title');
  title.textContent = visit ? 'Edit Visit' : 'Add Visit';

  drawer.querySelector('#v_name').value = visit ? (visit.name || '') : '';
  drawer.querySelector('#v_date').value = visit ? (new Date(visit.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
  drawer.querySelector('#v_assigned').value = visit ? (visit.assignedClass || '') : '';
  drawer.querySelector('#v_members').value = visit && visit.members ? visit.members.join(', ') : '';
  drawer.querySelector('#v_total').value = visit ? (visit.totalClasses || 0) : 0;
  drawer.querySelector('#v_visited').value = visit ? (visit.classesVisited || 0) : 0;
  drawer.querySelector('#v_children').value = visit ? (visit.childrenCount || 30) : 30;

  try {
    const [teamsData, schoolsData] = await Promise.all([
      api.getTeams().catch(() => ({ success: false })),
      api.getSchools()
    ]);

    const teamSelect = drawer.querySelector('#v_team');
    if (teamsData && teamsData.success) {
      teamSelect.innerHTML = '<option value="">Select team</option>' +
        teamsData.data.map(t => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join('');
    }

    const schoolSelect = drawer.querySelector('#v_school');
    if (schoolsData.success) {
      schoolSelect.innerHTML = '<option value="">Select school</option>' +
        schoolsData.data.map(s => `<option value="${s._id}">${escapeHtml(s.name)}</option>`).join('');
    }

    if (visit) {
      if (visit.team) teamSelect.value = visit.team._id || visit.team;
      if (visit.school) schoolSelect.value = visit.school._id || visit.school;
    }
  } catch (err) {
    console.warn('Failed to load teams/schools', err);
    notify.warning('Could not load teams or schools');
  }

  backdrop.classList.add('open');
  drawer.classList.add('open');
  document.body.classList.add('page-raised');

  // Save button: only enable for edit/update flows. Creation (Add) is disabled on this page.
  const saveBtn = drawer.querySelector('.btn-save');
  if (!visit) {
    // If no visit passed, this is a details-only view — hide save to prevent creation.
    saveBtn.style.display = 'none';
    // Ensure title reflects view-only
    const titleEl = drawer.querySelector('.drawer-title');
    if (titleEl) titleEl.textContent = 'Visit Details';
  } else {
    saveBtn.style.display = '';
    saveBtn.onclick = async () => {
      const payload = {
        name: drawer.querySelector('#v_name').value.trim(),
        date: drawer.querySelector('#v_date').value,
        team: drawer.querySelector('#v_team').value,
        school: drawer.querySelector('#v_school').value,
        assignedClass: drawer.querySelector('#v_assigned').value.trim(),
        members: (drawer.querySelector('#v_members').value || '').split(',').map(s => s.trim()).filter(Boolean),
        totalClasses: parseInt(drawer.querySelector('#v_total').value, 10) || 0,
        classesVisited: parseInt(drawer.querySelector('#v_visited').value, 10) || 0,
        childrenCount: parseInt(drawer.querySelector('#v_children').value, 10) || 0,
        status: 'scheduled'
      };

      const validationErrors = [];
      if (!payload.date) validationErrors.push('Please select a date');
      if (!payload.team) validationErrors.push('Please select a team');
      if (!payload.school) validationErrors.push('Please select a school');
      if (!payload.assignedClass) validationErrors.push('Please enter assigned class');
      if (!payload.childrenCount) validationErrors.push('Please enter expected children count');

      if (validationErrors.length > 0) {
        notify.error(validationErrors.join('<br>'));
        return;
      }

      try {
        loading.showFullPage('Updating visit...');
        let result;
        if (visit && visit._id) result = await api.updateVisit(visit._id, payload);
        loading.hideFullPage();
        if (result.success) {
          closeDrawer();
          notify.success('Visit updated successfully!');
          aSYNC_loadVisits();
        } else {
          notify.error(result.message || 'Operation failed');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    };
  }
}

function closeDrawer() {
  const drawer = document.getElementById('visits_drawer');
  const backdrop = document.getElementById('drawer_backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  document.body.classList.remove('page-raised');
}

// Add Visit flow removed from this page: creation must be done via admin tools or scheduling workflow.

// Media deletion helper (global)
async function deleteMedia(visitId, url) {
  notify.confirm('Delete this media? This action cannot be undone.', async () => {
    try {
      loading.showFullPage('Deleting media...');
      const result = await api.deleteVisitMedia(visitId, url);
      loading.hideFullPage();
      if (result.success) { notify.success('Media successfully removed!'); aSYNC_loadVisits(); }
      else { notify.error(result.message || 'Failed to delete media'); }
    } catch (err) { loading.hideFullPage(); handleAPIError(err); }
  });
}
window.deleteMedia = deleteMedia;

// =============== Centered Visit Info Modal (for scheduled visits) ===============
(function ensureVisitInfoModal() {
  if (document.getElementById('visit_info_overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'visit_info_overlay';
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'visit_info_modal';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <h2 style="margin:0;">Visit Information</h2>
      <button class="close-btn" id="visit_info_close" aria-label="Close">×</button>
    </div>
    <div id="visit_info_body" style="margin-top:12px;max-height:70vh;overflow:auto;"></div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove('open');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modal.querySelector('#visit_info_close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (overlay.classList.contains('open') && e.key === 'Escape') close(); });
})();

function openVisitInfoModal(visit) {
  const overlay = document.getElementById('visit_info_overlay');
  const body = document.getElementById('visit_info_body');
  if (!overlay || !body) return;

  // Inject visit details + upload controls
  body.innerHTML = renderVisitDetailsHtml(visit);
  // Wire upload handlers in the injected content
  attachDetailsHandlers();

  overlay.classList.add('open');
}
