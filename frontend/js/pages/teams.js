// Page-specific JavaScript for Teams page (extracted from inline)

// Require authentication
authManager.requireAuth();

// Role info
const isAdmin = authManager.isAdmin();
const currentUser = authManager.getUser();

let teams = [];
let currentTeamId = null;
let allUsers = [];

async function loadUsers() {
  if (!isAdmin) return;
  try {
    loading.show('usersList', 'Loading users...');
    const data = await api.getUsers();
    loading.hide('usersList');

    const usersDiv = document.getElementById('usersList');
    if (!data.success || !data.data.length) {
      usersDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No users available</p>';
      return;
    }

    allUsers = data.data;
    renderUsers(allUsers);
  } catch (err) {
    loading.hide('usersList');
    renderError('usersList', 'Failed to load users');
  }
}

function renderUsers(users) {
  const usersDiv = document.getElementById('usersList');
  if (users.length === 0) {
    usersDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No users found matching your search</p>';
    return;
  }

  usersDiv.innerHTML = users.map(u => `
    <label class="user-item" data-username="${escapeHtml(u.username || u.name).toLowerCase()}">
      <input type="checkbox" name="members" value="${u._id}" />
      <span class="username">${escapeHtml(u.username || u.name)}</span>
      <div class="leader-selector">
        <input type="radio" name="leader" value="${u._id}" title="Set as leader" />
      </div>
    </label>
  `).join('');
}

// Search functionality
(function attachSearchHandler() {
  const searchInput = document.getElementById('userSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      if (searchTerm === '') {
        renderUsers(allUsers);
      } else {
        const filtered = allUsers.filter(u => (u.username || u.name || '').toLowerCase().includes(searchTerm));
        renderUsers(filtered);
      }
    });
  }
})();

async function loadTeams() {
  try {
    loading.show('teamsList', 'Loading teams...');
    const data = await api.getTeams();
    loading.hide('teamsList');

    const teamsDiv = document.getElementById('teamsList');
    if (!data.success) {
      renderError('teamsList', 'Failed to load teams');
      return;
    }

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
          <button class="btn-schedule" onclick="scheduleVisit('${t._id}')" title="Schedule Visit"><i class="fa fa-calendar-plus"></i></button>
          ${isAdmin ? `<button class=\"btn-delete\" onclick=\"deleteTeam('${t._id}')\" title=\"Delete Team\"><i class=\"fa fa-trash-alt\"></i></button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    loading.hide('teamsList');
    renderError('teamsList', 'Failed to load teams');
  }
}

function deleteTeam(teamId) {
  if (!isAdmin) { notify.error('Only admins can delete teams'); return; }
  const team = teams.find(t => t._id === teamId);
  if (!team) return;
  currentTeamId = teamId;
  notify.confirm(`Are you sure you want to delete team "${team.name}"? This action cannot be undone.`, async () => {
    try {
      loading.showFullPage('Deleting team...');
      const data = await api.deleteTeam(teamId);
      loading.hideFullPage();
      if (data.success) { notify.success('Team deleted successfully!'); loadTeams(); }
      else { notify.error(data.message || 'Failed to delete team'); }
    } catch (err) { loading.hideFullPage(); handleAPIError(err); }
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
}

function closeScheduleModal() {
  document.getElementById('scheduleVisitModal').classList.remove('show');
  document.getElementById('scheduleVisitForm').reset();
}

function showAllMembers(teamId) {
  const team = teams.find(t => t._id === teamId);
  if (!team) return;
  document.getElementById('teamMembersTitle').textContent = `${team.name} - All Members`;
  const leaderId = team.teamLeader?._id || team.teamLeader;
  const membersBody = document.getElementById('teamMembersBody');
  membersBody.innerHTML = team.members.map(member => {
    const isLeader = member._id === leaderId;
    return `
      <div class="member-list-item ${isLeader ? 'leader' : ''}">
        <i class="fa fa-user"></i>
        <span style="flex: 1; font-weight: ${isLeader ? '600' : '500'};">${escapeHtml(member.username || member.name || 'Member')}</span>
        ${isLeader ? '<span class="leader-badge">Team Leader</span>' : ''}
      </div>
    `;
  }).join('');
  document.getElementById('teamMembersModal').classList.add('show');
}

function closeMembersModal() { document.getElementById('teamMembersModal').classList.remove('show'); }

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
loadUsers();
loadTeams();
