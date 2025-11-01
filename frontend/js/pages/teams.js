// Page-specific JavaScript for Teams page (extracted from inline)

// Require authentication
authManager.requireAuth();

// Role info
const isAdmin = authManager.isAdmin();
const currentUser = authManager.getUser();

let teams = [];
let currentTeamId = null;
let allUsers = [];
let _trapCleanupMembers = null;
let _trapCleanupSchedule = null;

function announce(msg) { try { if (window.announce) window.announce(msg); } catch(_) {} }

function trapFocus(container) {
  const focusable = container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return () => {};
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  container.addEventListener('keydown', handler);
  try { first.focus(); } catch(_) {}
  return () => container.removeEventListener('keydown', handler);
}

function getUserFilters() {
  const dept = document.getElementById('filterDepartment')?.value || '';
  const year = document.getElementById('filterYear')?.value || '';
  const availableOnly = document.getElementById('filterAvailableOnly')?.checked || false;
  const searchTerm = document.getElementById('userSearchInput')?.value?.trim() || '';
  const params = { role: 'volunteer', verified: 'true', page: '1', limit: '1000' };
  if (dept) params.department = dept;
  if (year) params.year = year;
  if (availableOnly) params.availableOnly = 'true';
  if (searchTerm) params.search = searchTerm;
  return params;
}

async function loadUsers() {
  if (!isAdmin) return;
  try {
    loading.show('usersList', 'Loading users...');
    const filters = getUserFilters();
    const data = await api.getAdminUsers(filters);
    loading.hide('usersList');

    const usersDiv = document.getElementById('usersList');
    if (!data.success || !data.data.length) {
      usersDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No users available</p>';
      return;
    }

    allUsers = data.data;
    maybePopulateDepartmentOptions(allUsers);
    renderUsers(allUsers);
  } catch (err) {
    loading.hide('usersList');
    renderError('usersList', 'Failed to load users');
  }
}

// URL state persistence for filters
function updateUrlParams() {
  try {
    const params = new URLSearchParams();
    const dept = document.getElementById('filterDepartment')?.value || '';
    const year = document.getElementById('filterYear')?.value || '';
    const availableOnly = document.getElementById('filterAvailableOnly')?.checked ? 'true' : '';
    const searchTerm = document.getElementById('userSearchInput')?.value?.trim() || '';
    if (dept) params.set('department', dept);
    if (year) params.set('year', year);
    if (availableOnly) params.set('availableOnly', 'true');
    if (searchTerm) params.set('search', searchTerm);
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    history.replaceState({}, '', url);
  } catch(_) {}
}

function restoreFromUrl() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const dept = sp.get('department') || '';
    const year = sp.get('year') || '';
    const available = sp.get('availableOnly') === 'true';
    const search = sp.get('search') || '';
    const deptSelect = document.getElementById('filterDepartment'); if (deptSelect) deptSelect.value = dept;
    const yearSelect = document.getElementById('filterYear'); if (yearSelect) yearSelect.value = year;
    const chk = document.getElementById('filterAvailableOnly'); if (chk) chk.checked = available;
    const si = document.getElementById('userSearchInput'); if (si) si.value = search;
  } catch(_) {}
}

function maybePopulateDepartmentOptions(users) {
  const deptSelect = document.getElementById('filterDepartment');
  if (!deptSelect) return;
  // If only the default option exists, populate dynamically from users
  const hasOnlyDefault = deptSelect.options.length <= 1;
  if (!hasOnlyDefault) return;

  const depts = Array.from(new Set(users.map(u => (u.department || '').trim()).filter(Boolean))).sort();
  const frag = document.createDocumentFragment();
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    frag.appendChild(opt);
  });
  deptSelect.appendChild(frag);
}

function renderUsers(users) {
  const usersDiv = document.getElementById('usersList');
  if (users.length === 0) {
    usersDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No users found matching your search</p>';
    return;
  }

  usersDiv.innerHTML = users.map(u => {
    const assignedTeam = u.team && (u.team.name || u.team);
    const disabled = !!assignedTeam;
    const labelClasses = ['user-item'];
    if (disabled) labelClasses.push('disabled');
    const badge = disabled ? `<span class="assignment-badge" title="Already in ${escapeHtml(assignedTeam.name || assignedTeam)}">In team${assignedTeam && assignedTeam.name ? `: ${escapeHtml(assignedTeam.name)}` : ''}</span>` : '';
    return `
    <label class="${labelClasses.join(' ')}" data-username="${escapeHtml(u.username || u.name).toLowerCase()}">
      <input type="checkbox" name="members" value="${u._id}" ${disabled ? 'disabled' : ''} />
      <span class="username">${escapeHtml(u.username || u.name)} ${badge}</span>
      <div class="leader-selector">
        <input type="radio" name="leader" value="${u._id}" title="Set as leader" ${disabled ? 'disabled' : ''} />
      </div>
    </label>`;
  }).join('');
}

// Search functionality
// Attach filter handlers (search, department, year, availableOnly)
(function attachFilterHandlers() {
  const searchInput = document.getElementById('userSearchInput');
  const deptSelect = document.getElementById('filterDepartment');
  const yearSelect = document.getElementById('filterYear');
  const availableOnly = document.getElementById('filterAvailableOnly');

  let debounceTimer;
  function triggerLoadWithDebounce() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { loadUsers(); }, 250);
  }

  if (searchInput) searchInput.addEventListener('input', triggerLoadWithDebounce);
  if (deptSelect) deptSelect.addEventListener('change', loadUsers);
  if (yearSelect) yearSelect.addEventListener('change', loadUsers);
  if (availableOnly) availableOnly.addEventListener('change', loadUsers);
})();

async function loadTeams() {
  try {
    loading.show('teamsList', 'Loading teams...');
    const data = await api.getTeams();
    loading.hide('teamsList');

    const teamsDiv = document.getElementById('teamsList');
    if (!data.success || !data.data) {
      renderError('teamsList', 'Failed to load teams');
      return;
    }

    // Store teams in the global variable
    teams = data.data;

    if (data.data.length === 0) {
      renderNoData('teamsList', 'No teams created yet. Create your first team!');
      return;
    }

    teamsDiv.innerHTML = data.data.map((t, index) => `
      <div class="team-card" style="animation-delay: ${index * 0.1}s;">
        <h3>${escapeHtml(t.name)}</h3>
        <p><i class="fa fa-user-tie"></i><strong>Leader:</strong> ${escapeHtml(t.teamLeader?.username || t.teamLeader?.name || 'N/A')}</p>
        <p><i class="fa fa-users"></i><strong>Team Size:</strong> ${t.members.length} ${t.members.length === 1 ? 'member' : 'members'}</p>
        ${t.createdAt ? `<p><i class=\"fa fa-calendar\"></i><strong>Created:</strong> ${new Date(t.createdAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>` : ''}
        <div class="team-members">
          ${t.members.slice(0, 4).map(m => `<span class=\"member-tag\">${escapeHtml(m.username || m.name || 'Member')}</span>`).join('')}
          ${t.members.length > 4 ? `<span class=\"member-tag more\" onclick=\"showAllMembers('${t._id}')\">+${t.members.length - 4} more</span>` : ''}
        </div>
        <div class="team-actions">
          <button class="btn-view" data-team-id="${t._id}" title="View All Members" aria-label="View All Members"><i class="fa-solid fa-users"></i></button>
          ${isAdmin ? `
            <button class="btn-schedule" data-team-id="${t._id}" title="Schedule Visit" aria-label="Schedule Visit"><i class="fa-solid fa-calendar-plus"></i></button>
            <button class=\"btn-delete\" data-team-id=\"${t._id}\" title=\"Delete Team\" aria-label=\"Delete Team\"><i class=\"fa-solid fa-trash\"></i></button>
            <button class=\"btn-manage\" data-team-id=\"${t._id}\" title=\"Manage Members\" aria-label=\"Manage Members\"><i class=\"fa-solid fa-user-gear\"></i></button>
          ` : ''}
        </div>
      </div>
    `).join('');
    // Attach handlers for buttons to comply with CSP (no inline event handlers)
    attachTeamActionHandlers();
  } catch (err) {
    loading.hide('teamsList');
    renderError('teamsList', 'Failed to load teams');
  }
}

function attachTeamActionHandlers() {
  // View members
  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.removeEventListener('click', onViewMembersClick);
    btn.addEventListener('click', onViewMembersClick);
  });

  // Schedule (admin only)
  document.querySelectorAll('.btn-schedule').forEach(btn => {
    btn.removeEventListener('click', onScheduleClick);
    btn.addEventListener('click', onScheduleClick);
  });

  // Delete (admin only)
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.removeEventListener('click', onDeleteTeamClick);
    btn.addEventListener('click', onDeleteTeamClick);
  });

  // Manage members (admin only)
  document.querySelectorAll('.btn-manage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const teamId = e.currentTarget.getAttribute('data-team-id');
      showAllMembers(teamId);
    });
  });
}

function onViewMembersClick(e) {
  const teamId = e.currentTarget.getAttribute('data-team-id');
  showAllMembers(teamId);
}

function onScheduleClick(e) {
  const teamId = e.currentTarget.getAttribute('data-team-id');
  scheduleVisit(teamId);
}

function onDeleteTeamClick(e) {
  const teamId = e.currentTarget.getAttribute('data-team-id');
  // call the deleteTeam flow which includes admin check
  deleteTeam(teamId);
}

function deleteTeam(teamId) {
  if (!isAdmin) { notify.error('Only admins can delete teams'); return; }
  const team = teams.find(t => t._id === teamId);
  if (!team) return;
  currentTeamId = teamId;
  notify.confirm(`Are you sure you want to delete team "${team.name}"? This action cannot be undone.`, async () => {
    try {
      // disable delete button while processing
      try { const btn = document.querySelector(`.btn-delete[data-team-id="${teamId}"]`); if (btn) btn.disabled = true; } catch(_) {}
      loading.showFullPage('Deleting team...');
      const data = await api.deleteTeam(teamId);
      loading.hideFullPage();
      if (data.success) { notify.success('Team deleted successfully!'); loadTeams(); }
      else { notify.error(data.message || 'Failed to delete team'); }
    } catch (err) { loading.hideFullPage(); handleAPIError(err); }
    finally { try { const btn = document.querySelector(`.btn-delete[data-team-id="${teamId}"]`); if (btn) btn.disabled = false; } catch(_) {} }
  });
}

// Team form submission (Admin only)
document.getElementById('teamForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!isAdmin) { notify.error('Only admins can create teams'); return; }

  const teamName = document.getElementById('teamName').value.trim();
  const checked = Array.from(document.querySelectorAll('input[name="members"]:checked'));
  const leaderRadio = document.querySelector('input[name="leader"]:checked');

  if (!teamName) { notify.warning('Please enter a team name'); return; }
  if (checked.length === 0) { notify.warning('Please select at least one member'); return; }
  if (!leaderRadio) { notify.warning('Please select a team leader'); return; }

  const memberIds = checked.map(cb => cb.value);
  const leaderId = leaderRadio.value;
  if (!memberIds.includes(leaderId)) { notify.warning('Team leader must be one of the selected members'); return; }

  const payload = { name: teamName, teamLeader: leaderId, members: memberIds };
  try {
    loading.showFullPage('Creating team...');
    const data = await api.createTeam(payload);
    loading.hideFullPage();
    if (data.success) { notify.success('Team created successfully!'); this.reset(); loadUsers(); loadTeams(); }
    else { notify.error(data.message || 'Failed to create team'); }
  } catch (err) { loading.hideFullPage(); handleAPIError(err); }
});

function scheduleVisit(teamId) {
  if (!isAdmin) { notify.error('Only admins can schedule team visits'); return; }
  const team = teams.find(t => t._id === teamId);
  if (!team) return;
  document.getElementById('selectedTeamId').value = teamId;
  document.getElementById('modalTeamName').value = team.name;
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('visitDate').min = today;
  document.getElementById('visitDate').value = today;
  loadSchoolsForModal();
  document.getElementById('scheduleVisitModal').classList.add('show');
  document.getElementById('scheduleSuccessMessage').classList.remove('show');
  try { _trapCleanupSchedule && _trapCleanupSchedule(); } catch(_) {}
  _trapCleanupSchedule = trapFocus(document.getElementById('scheduleVisitModal'));
}

function closeScheduleModal() {
  document.getElementById('scheduleVisitModal').classList.remove('show');
  document.getElementById('scheduleVisitForm').reset();
  try { _trapCleanupSchedule && _trapCleanupSchedule(); } catch(_) {}
}

function showAllMembers(teamId) {
  const team = teams.find(t => t._id === teamId);
  if (!team) return;
  document.getElementById('teamMembersTitle').textContent = `${team.name} - All Members`;
  const leaderId = team.teamLeader?._id || team.teamLeader;
  const membersBody = document.getElementById('teamMembersBody');
  membersBody.innerHTML = team.members.map(member => {
    const isLeader = String(member._id) === String(leaderId);
    const actions = (isAdmin && !isLeader) ? `
      <div class="member-actions">
        <button class="btn btn-small" data-action="make-leader" data-team="${team._id}" data-member="${member._id}">Make Leader</button>
        <button class="btn btn-small btn-danger" data-action="remove-member" data-team="${team._id}" data-member="${member._id}">Remove</button>
      </div>` : (isLeader ? '<span class="leader-badge">Team Leader</span>' : '');
    return `
      <div class="member-list-item ${isLeader ? 'leader' : ''}">
        <i class="fa fa-user"></i>
        <span style="flex: 1; font-weight: ${isLeader ? '600' : '500'};">${escapeHtml(member.username || member.name || 'Member')}</span>
        ${actions}
      </div>
    `;
  }).join('');

  // Admin: add quick add-members UI inline
  if (isAdmin) {
    const available = allUsers.filter(u => !u.team && !team.members.find(m => String(m._id) === String(u._id)));
    const addSection = document.createElement('div');
    addSection.className = 'add-members-section';
    addSection.innerHTML = `
      <div class="add-members-header"><strong>Add Members</strong></div>
      <div class="add-members-list">
        ${available.length ? available.slice(0, 50).map(u => `
          <label class="user-item">
            <input type="checkbox" name="addMembers" value="${u._id}" />
            <span class="username">${escapeHtml(u.username || u.name)}</span>
          </label>
        `).join('') : '<div class="empty">No available users to add</div>'}
      </div>
      <div class="add-members-actions">
        <button class="btn" id="addSelectedMembersBtn">Add Selected</button>
      </div>
    `;
    membersBody.appendChild(addSection);

    const addBtn = addSection.querySelector('#addSelectedMembersBtn');
    if (addBtn) addBtn.addEventListener('click', async () => {
      const ids = Array.from(addSection.querySelectorAll('input[name="addMembers"]:checked')).map(cb => cb.value);
      if (!ids.length) { notify.info('Select at least one user to add'); return; }
      try {
        loading.showFullPage('Adding members...');
        const res = await api.addTeamMembers(team._id, ids);
        loading.hideFullPage();
        if (res.success) { notify.success('Members added'); await reloadTeamInPlace(team._id); showAllMembers(team._id); loadTeams(); }
        else { notify.error(res.message || 'Failed to add members'); }
      } catch (err) { loading.hideFullPage(); handleAPIError(err); }
    });
  }

  // Wire member actions
  membersBody.querySelectorAll('[data-action="make-leader"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tId = e.currentTarget.getAttribute('data-team');
      const mId = e.currentTarget.getAttribute('data-member');
      notify.confirm('Make this member the team leader?', async () => {
        try {
          loading.showFullPage('Changing leader...');
          const res = await api.changeTeamLeader(tId, mId);
          loading.hideFullPage();
          if (res.success) { notify.success('Leader changed'); await reloadTeamInPlace(tId); showAllMembers(tId); loadTeams(); }
          else { notify.error(res.message || 'Failed to change leader'); }
        } catch (err) { loading.hideFullPage(); handleAPIError(err); }
      });
    });
  });
  membersBody.querySelectorAll('[data-action="remove-member"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tId = e.currentTarget.getAttribute('data-team');
      const mId = e.currentTarget.getAttribute('data-member');
      notify.confirm('Remove this member from the team?', async () => {
        try {
          loading.showFullPage('Removing member...');
          const res = await api.removeTeamMember(tId, mId);
          loading.hideFullPage();
          if (res.success) { notify.success('Member removed'); await reloadTeamInPlace(tId); showAllMembers(tId); loadTeams(); }
          else { notify.error(res.message || 'Failed to remove member'); }
        } catch (err) { loading.hideFullPage(); handleAPIError(err); }
      });
    });
  });
  document.getElementById('teamMembersModal').classList.add('show');
  try { _trapCleanupMembers && _trapCleanupMembers(); } catch(_) {}
  _trapCleanupMembers = trapFocus(document.getElementById('teamMembersModal'));
}

function closeMembersModal() { document.getElementById('teamMembersModal').classList.remove('show'); try { _trapCleanupMembers && _trapCleanupMembers(); } catch(_) {} }

// Reload a single team object in-place to keep references fresh
async function reloadTeamInPlace(teamId) {
  try {
    const data = await api.getTeam(teamId);
    if (data && data.success && data.data) {
      const idx = teams.findIndex(t => t._id === teamId);
      if (idx !== -1) teams[idx] = data.data;
    }
  } catch (e) {
    console.warn('Failed to reload team', e);
  }
}

async function loadSchoolsForModal() {
  try {
    const schoolSelect = document.getElementById('visitSchool');
    const currentOptions = schoolSelect.innerHTML;
    if (currentOptions.includes('<option value="">Select School</option>') && !currentOptions.includes('Loading')) return;
    schoolSelect.innerHTML = '<option value="">Loading schools...</option>';
    const data = await api.getSchools();
    if (data.success && data.data.length > 0) {
      schoolSelect.innerHTML = '<option value="">Select School</option>' + data.data.map(school => `<option value="${school._id}">${escapeHtml(school.name)}</option>`).join('');
    } else {
      schoolSelect.innerHTML = '<option value="">No schools available</option>';
    }
  } catch (err) {
    console.error('Failed to load schools:', err);
    document.getElementById('visitSchool').innerHTML = '<option value="">Failed to load schools</option>';
  }
}

// Handle schedule visit form submission
document.getElementById('scheduleVisitForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const teamId = document.getElementById('selectedTeamId').value;
  const schoolId = document.getElementById('visitSchool').value;
  const visitDate = document.getElementById('visitDate').value;
  const visitTime = document.getElementById('visitTime').value;
  const assignedClass = document.getElementById('assignedClass').value.trim();
  const childrenCount = parseInt(document.getElementById('childrenCount').value) || 30;

  if (!schoolId) { notify.warning('Please select a school'); return; }
  if (!visitDate) { notify.warning('Please select a visit date'); return; }
  if (!assignedClass) { notify.warning('Please enter the assigned class'); return; }
  const selectedDate = new Date(visitDate);
  const today = new Date(); today.setHours(0,0,0,0);
  if (selectedDate < today) { notify.error('Visit date cannot be in the past'); return; }

  const payload = { team: teamId, school: schoolId, date: visitDate, visitTime, assignedClass, childrenCount, status: 'scheduled' };
  try {
    loading.showFullPage('Scheduling visit...');
    const data = await api.createVisit(payload);
    loading.hideFullPage();
    if (data.success) {
      document.getElementById('scheduleSuccessMessage').classList.add('show');
      this.reset();
      setTimeout(() => { closeScheduleModal(); loadTeams(); notify.success('Visit scheduled successfully!'); }, 2000);
    } else {
      notify.error(data.message || 'Failed to schedule visit');
    }
  } catch (err) {
    loading.hideFullPage();
    handleAPIError(err);
  }
});

function initializePageAccess() {
  const teamCreatorSection = document.querySelector('.team-creator');
  if (!isAdmin) {
    if (teamCreatorSection) teamCreatorSection.style.display = 'none';
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (dashboardHeader) {
      const subtitle = dashboardHeader.querySelector('p');
      if (subtitle) { subtitle.textContent = 'View volunteer teams and their details'; subtitle.style.color = '#666'; }
    }
    const existingTeamsSection = document.querySelector('.existing-teams');
    if (existingTeamsSection) {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'background: linear-gradient(135deg, #e8f5e9, #c8e6c9); padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; border: 2px solid #4caf50; box-shadow: 0 4px 6px rgba(76, 175, 80, 0.1);';
      infoDiv.innerHTML = '<i class="fa fa-info-circle" style="color: #2e7d32; font-size: 1.5rem;"></i><span style="color: #1b5e20; font-size: 1rem; font-weight: 500;"> 👀 You are viewing teams in <strong>read-only mode</strong>. Contact an admin to create or modify teams.</span>';
      existingTeamsSection.insertBefore(infoDiv, existingTeamsSection.firstChild);
    }
  }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const scheduleModal = document.getElementById('scheduleVisitModal');
  const membersModal = document.getElementById('teamMembersModal');
  if (event.target === scheduleModal) { closeScheduleModal(); }
  if (event.target === membersModal) { closeMembersModal(); }
};

// Make functions globally available for onclick handlers
window.deleteTeam = deleteTeam;
window.scheduleVisit = scheduleVisit;
window.closeScheduleModal = closeScheduleModal;
window.showAllMembers = showAllMembers;
window.closeMembersModal = closeMembersModal;

// Initialize page
initializePageAccess();
restoreFromUrl();
loadUsers();
loadTeams();

// Keep URL in sync when filters change
document.getElementById('userSearchInput')?.addEventListener('input', () => { updateUrlParams(); });
document.getElementById('filterDepartment')?.addEventListener('change', updateUrlParams);
document.getElementById('filterYear')?.addEventListener('change', updateUrlParams);
document.getElementById('filterAvailableOnly')?.addEventListener('change', updateUrlParams);

// Handle back/forward nav
window.addEventListener('popstate', () => { restoreFromUrl(); loadUsers(); });
