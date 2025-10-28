/* Admin Users Page Logic */

class AdminUsersManager {
  constructor() {
    this.page = 1;
    this.limit = 20;
    this.total = 0;
    this.selected = new Set();
    this.currentRejectUserId = null;
  }

  init() {
    authManager.requireAdmin();
    navbarManager.setupNavbar();

    this.cacheEls();
    this.bindEvents();
    this.loadUsers();
  }

  cacheEls() {
    this.searchInput = document.getElementById('searchUsers');
    this.filterRole = document.getElementById('filterRole');
    this.filterStatus = document.getElementById('filterStatus');
    this.filterVerified = document.getElementById('filterVerified');
    this.applyFiltersBtn = document.getElementById('applyFilters');
    this.resetFiltersBtn = document.getElementById('resetFilters');

    this.bulkApproveBtn = document.getElementById('bulkApprove');
    this.bulkRejectBtn = document.getElementById('bulkReject');
    this.bulkRoleSelect = document.getElementById('bulkRoleSelect');
    this.bulkChangeRoleBtn = document.getElementById('bulkChangeRole');
    this.selectionInfo = document.getElementById('selectionInfo');

  // Bulk controls removed from UI; keep optional refs null
  this.bulkApproveBtn = document.getElementById('bulkApprove');
  this.bulkRejectBtn = document.getElementById('bulkReject');
  this.bulkRoleSelect = document.getElementById('bulkRoleSelect');
  this.bulkChangeRoleBtn = document.getElementById('bulkChangeRole');
  this.selectionInfo = document.getElementById('selectionInfo');

    this.selectAll = document.getElementById('selectAll');
    this.tbody = document.getElementById('usersTbody');
    this.pagination = document.getElementById('pagination');

    this.rejectModal = document.getElementById('rejectModal');
    this.rejectReason = document.getElementById('rejectReason');
    this.confirmReject = document.getElementById('confirmReject');
    this.cancelReject = document.getElementById('cancelReject');

    this.activityModal = document.getElementById('activityModal');
    this.activityList = document.getElementById('activityList');
    this.closeActivity = document.getElementById('closeActivity');
  }

  bindEvents() {
    this.applyFiltersBtn && this.applyFiltersBtn.addEventListener('click', () => { this.page = 1; this.loadUsers(); });
    this.resetFiltersBtn && this.resetFiltersBtn.addEventListener('click', () => this.resetFilters());

    this.selectAll.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));

    // Bulk actions removed; guard event handlers
    this.bulkApproveBtn && this.bulkApproveBtn.addEventListener('click', () => this.bulkApprove());
    this.bulkRejectBtn && this.bulkRejectBtn.addEventListener('click', () => this.bulkReject());
    this.bulkRoleSelect && this.bulkRoleSelect.addEventListener('change', () => this.updateSelectionUI());
    this.bulkChangeRoleBtn && this.bulkChangeRoleBtn.addEventListener('click', () => this.bulkChangeRole());

    // Inject bulk delete button into bulk-controls if present
    try {
      const bulkControls = document.querySelector('.bulk-controls');
      if (bulkControls && !document.getElementById('bulkDelete')) {
        const btn = document.createElement('button');
        btn.id = 'bulkDelete';
        btn.className = 'btn btn-danger icon-btn';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-trash"></i>';
        btn.setAttribute('aria-label', 'Delete selected users');
        btn.setAttribute('title', 'Delete selected users');
        btn.addEventListener('click', () => this.bulkDelete());
        bulkControls.appendChild(btn);
        this.bulkDeleteBtn = btn;
      }
    } catch(_){}

    this.confirmReject.addEventListener('click', () => this.confirmRejectAction());
    // Bulk delete button removed with the bulk section; no injection
    this.cancelReject.addEventListener('click', () => this.hideRejectModal());

    this.closeActivity.addEventListener('click', () => this.hideActivityModal());
  }
  
  buildParams() {
    const params = { page: this.page, limit: this.limit };
    const s = this.searchInput?.value?.trim();
    if (s) params.search = s;
    const r = this.filterRole?.value;
    if (r) params.role = r;
    const st = this.filterStatus?.value;
    if (st) params.status = st;
    const v = this.filterVerified?.value;
    if (v !== '' && v !== undefined && v !== null) params.verified = v;
    return params;
  }

  async loadUsers() {
    try {
      this.tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading users…</td></tr>';
      const params = this.buildParams();
      const res = await api.getAdminUsers(params);
      this.total = res.total || 0;
      this.renderUsers(res.data || []);
      this.renderPagination(res.page || 1, res.pages || 1);
    } catch (err) {
      console.error('Load users failed', err);
      this.tbody.innerHTML = `<tr><td colspan="8" class="empty">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  renderUsers(users) {
    this.selected.clear();
    this.updateSelectionUI();
    if (!users.length) {
      this.tbody.innerHTML = '<tr><td colspan="8" class="empty">No users found</td></tr>';
      return;
    }

    this.tbody.innerHTML = users.map(u => this.userRowHTML(u)).join('');

    // Bind row events
    this.tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) this.selected.add(id); else this.selected.delete(id);
        this.updateSelectionUI();
      });
    });

    this.tbody.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', (e) => this.approveUser(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', (e) => this.showRejectModal(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.role-select').forEach(sel => sel.addEventListener('change', (e) => this.changeRole(e.target.dataset.id, e.target.value)));
    this.tbody.querySelectorAll('.logs-btn').forEach(btn => btn.addEventListener('click', (e) => this.openLogs(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.confirmDelete(e.target.closest('button').dataset.id)));
  }

  userRowHTML(u) {
    const initials = (u.name || u.username || '?').split(/\s+/).map(p => p[0]).slice(0,2).join('').toUpperCase();
    const statusClass = (u.verificationStatus || 'pending');
    const verifiedIcon = u.isVerified 
      ? '<span class="badge verified">Yes</span>' 
      : '<span class="badge pending">No</span>';
    const created = new Date(u.createdAt).toLocaleDateString();

    const isSelf = (authManager.getUser()?.id || authManager.getUser()?._id) === u._id;

    // Avatar: show profile photo if available, else initials; cache-bust local uploads
    const rawAvatar = u.profileImage;
    const cacheBusted = (url) => {
      if (!url) return url;
      const hasQuery = url.includes('?');
      const ts = (u.updatedAt ? new Date(u.updatedAt).getTime() : Date.now());
      return url.includes('/uploads/') ? `${url}${hasQuery ? '&' : '?'}t=${ts}` : url;
    };
    const avatarHtml = rawAvatar
      ? `<div class="user-avatar"><img src="${cacheBusted(rawAvatar)}" alt="${escapeHtml(u.name || u.username || 'User')}" /></div>`
      : `<div class="user-avatar">${initials}</div>`;
    return `
      <tr>
        <td><input type="checkbox" data-id="${u._id}"></td>
        <td>
          <div class="user-cell">
            ${avatarHtml}
            <div>
              <div class="user-name">${escapeHtml(u.name || '-')}</div>
              <div class="user-username">@${escapeHtml(u.username || '')}</div>
            </div>
          </div>
        </td>
        <td>
          <div>${escapeHtml(u.email || '-')}</div>
          <div class="user-username">${escapeHtml(u.department || '-')}, Year ${u.year || '-'}</div>
        </td>
        <td>
          <select class="role-select" data-id="${u._id}">
            <option value="volunteer" ${u.role === 'volunteer' ? 'selected' : ''}>Volunteer</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td><span class="badge ${statusClass}">${(u.verificationStatus || 'pending').toUpperCase()}</span></td>
        <td>${verifiedIcon}</td>
        <td>${created}</td>
        <td class="actions">
          <button class="btn btn-primary icon-btn approve-btn" aria-label="Approve user" title="Approve user" data-id="${u._id}" ${u.verificationStatus === 'approved' ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M20 6L9 17l-5-5 1.5-1.5L9 14l9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-danger icon-btn reject-btn" aria-label="Reject user" title="Reject user" data-id="${u._id}" ${u.verificationStatus === 'rejected' ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <button class="btn btn-secondary icon-btn logs-btn" aria-label="View logs" title="View logs" data-id="${u._id}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 6h2v2H4V6zm4 0h12v2H8V6zm-4 5h2v2H4v-2zm4 0h12v2H8v-2zm-4 5h2v2H4v-2zm4 0h12v2H8v-2z"/></svg>
          </button>
          <button class="btn btn-danger icon-btn delete-btn" aria-label="Delete user" title="Delete user" data-id="${u._id}" ${isSelf ? 'disabled title=\"Cannot delete yourself\"' : ''}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9z"/></svg>
          </button>
        </td>
      </tr>
    `;
  }

  renderPagination(page, pages) {
    this.pagination.innerHTML = '';
    if (pages <= 1) return;

    for (let p = 1; p <= pages; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === page ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => { this.page = p; this.loadUsers(); });
      this.pagination.appendChild(btn);
    }
  }

  toggleSelectAll(checked) {
    this.tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
      cb.checked = checked;
      const id = cb.dataset.id;
      if (checked) this.selected.add(id); else this.selected.delete(id);
    });
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    const count = this.selected.size;
    if (this.selectionInfo) this.selectionInfo.textContent = `${count} selected`;
    const disabled = count === 0;
    if (this.bulkApproveBtn) this.bulkApproveBtn.disabled = disabled;
    if (this.bulkRejectBtn) this.bulkRejectBtn.disabled = disabled;
    if (this.bulkRoleSelect) this.bulkRoleSelect.disabled = disabled;
    if (this.bulkChangeRoleBtn) this.bulkChangeRoleBtn.disabled = disabled || !(this.bulkRoleSelect && this.bulkRoleSelect.value);
    if (this.bulkDeleteBtn) this.bulkDeleteBtn.disabled = disabled;
  }

  resetFilters() {
    this.searchInput.value = '';
    this.filterRole.value = '';
    this.filterStatus.value = '';
    this.filterVerified.value = '';
    this.page = 1;
    this.loadUsers();
  }

  async approveUser(id) {
    try {
      await api.approveUser(id, null);
      notify.success('User approved');
      this.loadUsers();
    } catch (err) {
      notify.error('Approve failed: ' + escapeHtml(err.message));
    }
  }

  showRejectModal(id) {
    this.currentRejectUserId = id;
    this.rejectReason.value = '';
    this.rejectModal.style.display = 'flex';
  }

  hideRejectModal() { this.rejectModal.style.display = 'none'; this.currentRejectUserId = null; }

  async confirmRejectAction() {
    if (!this.currentRejectUserId) return;
    try {
      await api.rejectUser(this.currentRejectUserId, this.rejectReason.value.trim());
      notify.success('User rejected');
      this.hideRejectModal();
      this.loadUsers();
    } catch (err) {
      notify.error('Reject failed: ' + escapeHtml(err.message));
    }
  }

  async changeRole(id, role) {
    try {
      await api.updateUserRole(id, role);
      notify.success('Role updated');
      // No full reload needed, but refresh to reflect logs/status
      this.loadUsers();
    } catch (err) {
      notify.error('Role update failed: ' + escapeHtml(err.message));
      this.loadUsers();
    }
  }

  async bulkApprove() {
    await this.runBulk({ action: 'approve', userIds: Array.from(this.selected) });
  }

  async bulkReject() {
    const reason = prompt('Enter a reason for rejection (optional):') || '';
    await this.runBulk({ action: 'reject', userIds: Array.from(this.selected), reason });
  }

  async bulkChangeRole() {
    const role = this.bulkRoleSelect.value;
    if (!role) return;
    await this.runBulk({ action: 'role', userIds: Array.from(this.selected), role });
  }

  async confirmDelete(userId) {
    if (!userId) return;
    notify.confirm('Delete this user permanently? This action cannot be undone.', async () => {
      try {
        await api.deleteUser(userId);
        notify.success('User deleted');
        this.loadUsers();
      } catch (err) {
        handleAPIError(err);
      }
    });
  }

  async bulkDelete() {
    const ids = Array.from(this.selected);
    if (!ids.length) return;
    notify.confirm(`Delete ${ids.length} selected user(s)? This action cannot be undone.`, async () => {
      try {
        const res = await api.bulkDeleteUsers(ids);
        const deleted = res?.data?.deleted ?? 0;
        notify.success(`Deleted ${deleted} user(s)`);
        this.selected.clear();
        this.selectAll.checked = false;
        this.updateSelectionUI();
        this.loadUsers();
      } catch (err) {
        handleAPIError(err);
      }
    });
  }

  async runBulk(payload) {
    try {
      await api.bulkUpdateUsers(payload);
      notify.success('Bulk operation completed');
      this.selected.clear();
      this.selectAll.checked = false;
      this.updateSelectionUI();
      this.loadUsers();
    } catch (err) {
      notify.error('Bulk operation failed: ' + escapeHtml(err.message));
    }
  }

  async openLogs(userId) {
    try {
      const res = await api.getActivityLogs({ userId, limit: 20 });
      const logs = res.data || [];
      this.activityList.innerHTML = logs.length ? logs.map(l => this.logItemHTML(l)).join('') : '<div class="activity-item">No activities found</div>';
      this.activityModal.style.display = 'flex';
    } catch (err) {
      notify.error('Failed to load activity logs: ' + escapeHtml(err.message));
    }
  }

  hideActivityModal() { this.activityModal.style.display = 'none'; }

  logItemHTML(l) {
    const when = new Date(l.createdAt).toLocaleString();
    const actor = l.actor?.name || l.actor?.username || 'Unknown';
    return `<div class="activity-item">
      <div><strong>${escapeHtml(l.action)}</strong> — ${escapeHtml(JSON.stringify(l.metadata || {}))}</div>
      <div class="meta">by ${escapeHtml(actor)} on ${when}</div>
    </div>`;
  }
}

let adminUsersManager;

document.addEventListener('DOMContentLoaded', () => {
  adminUsersManager = new AdminUsersManager();
  adminUsersManager.init();
});
