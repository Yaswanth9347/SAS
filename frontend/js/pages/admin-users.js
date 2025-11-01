/* Admin Users Page Logic
 * Manages the Admin Users UI: list, filters, pagination, individual actions,
 * bulk operations (approve/reject/role/delete), and accessibility/UX polish.
 *
 * Key patterns:
 * - Request-id gating to ignore stale responses
 * - Chunked bulk operations with progress and summary
 * - AbortController to cancel in-flight bulk requests immediately
 * - URL state persistence for filters and pagination
 */

class AdminUsersManager {
  constructor() {
    this.page = 1;
    this.limit = (typeof CONFIG !== 'undefined' && CONFIG.PAGINATION && CONFIG.PAGINATION.DEFAULT_PAGE_SIZE) ? CONFIG.PAGINATION.DEFAULT_PAGE_SIZE : 20;
    this.total = 0;
  this.users = [];
    this.selected = new Set();
    this.currentRejectUserId = null;
    this.isLoading = false;
    this._latestRequestId = 0;
    // Setup aria-live region for screen reader announcements
    try {
      let live = document.getElementById('ariaLive');
      if (!live) {
        live = document.createElement('div');
        live.id = 'ariaLive';
        live.setAttribute('role', 'status');
        live.setAttribute('aria-live', 'polite');
        live.style.position = 'absolute';
        live.style.left = '-9999px';
        document.body.appendChild(live);
      }
      this._ariaLive = live;
    } catch (_) {}
  }

  init() {
    // Guard auth/navbar calls in case helpers are not yet initialized in some test harnesses
    try {
      authManager && authManager.requireAdmin && authManager.requireAdmin();
    } catch (e) {
      console.warn('authManager.requireAdmin failed or not present', e && e.message);
    }
    try {
      navbarManager && navbarManager.setupNavbar && navbarManager.setupNavbar();
    } catch (e) {
      console.warn('navbarManager.setupNavbar failed or not present', e && e.message);
    }

    this.cacheEls();
    // Restore filters from URL if present
    try { this.restoreFiltersFromUrl(); } catch (e) { /* ignore */ }
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
  this.bulkControls = document.querySelector('.bulk-controls');
  this.bulkClear = document.getElementById('bulkClear');
  this.bulkSummaryModal = document.getElementById('bulkSummaryModal');
  this.bulkSummaryContent = document.getElementById('bulkSummaryContent');
  this.closeBulkSummary = document.getElementById('closeBulkSummary');
  this.selectAllMatchingBtn = document.getElementById('selectAllMatching');
  this.retryBulkBtn = document.getElementById('retryBulk');
  this.abortBulkBtn = document.getElementById('abortBulk');

    this.selectAll = document.getElementById('selectAll');
    this.tbody = document.getElementById('usersTbody');
    this.pagination = document.getElementById('pagination');
  this.pageSizeSelect = document.getElementById('pageSize');
  this.totalCount = document.getElementById('totalCount');

    this.rejectModal = document.getElementById('rejectModal');
    this.rejectReason = document.getElementById('rejectReason');
    this.confirmReject = document.getElementById('confirmReject');
    this.cancelReject = document.getElementById('cancelReject');

    this.activityModal = document.getElementById('activityModal');
    this.activityList = document.getElementById('activityList');
    this.closeActivity = document.getElementById('closeActivity');
    this.userDetailsModal = document.getElementById('userDetailsModal');
    this.userDetailsContent = document.getElementById('userDetailsContent');
    this.closeUserDetails = document.getElementById('closeUserDetails');
  }

  bindEvents() {
    this.applyFiltersBtn && this.applyFiltersBtn.addEventListener('click', () => { this.page = 1; this.loadUsers(); });
    this.resetFiltersBtn && this.resetFiltersBtn.addEventListener('click', () => this.resetFilters());

    // Debounced search input (300ms)
    if (this.searchInput) {
      this.searchInput.addEventListener('input', this.debounce((e) => {
        this.page = 1;
        this.loadUsers();
      }, 300));
    }

  if (this.selectAll) this.selectAll.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));

    // Page size selector
    if (this.pageSizeSelect) {
      // prefill select if present
      this.pageSizeSelect.value = String(this.limit);
      this.pageSizeSelect.addEventListener('change', (e) => {
        const v = parseInt(e.target.value, 10) || this.limit;
        this.limit = v;
        this.page = 1;
        this.loadUsers();
      });
    }

    // Bulk actions removed; guard event handlers
  this.bulkApproveBtn && this.bulkApproveBtn.addEventListener('click', () => this.bulkApprove());
    this.bulkRejectBtn && this.bulkRejectBtn.addEventListener('click', () => this.bulkReject());
    this.bulkRoleSelect && this.bulkRoleSelect.addEventListener('change', () => this.updateSelectionUI());
    this.bulkChangeRoleBtn && this.bulkChangeRoleBtn.addEventListener('click', () => this.bulkChangeRole());
  if (this.bulkClear) this.bulkClear.addEventListener('click', () => { this.selected.clear(); this.updateSelectionUI(); this.tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => cb.checked = false); });
  if (this.closeBulkSummary) this.closeBulkSummary.addEventListener('click', () => this.hideBulkSummary());
    if (this.selectAllMatchingBtn) this.selectAllMatchingBtn.addEventListener('click', () => this.selectAllMatching());
    if (this.retryBulkBtn) this.retryBulkBtn.addEventListener('click', () => this.retryLastBulk());
    if (this.abortBulkBtn) this.abortBulkBtn.addEventListener('click', () => {
      // request cancellation and abort any in-flight fetch
      this._bulkCancelRequested = true;
      try { if (this._bulkAbortController) this._bulkAbortController.abort(); } catch (_) {}
      notify.info('Bulk operation abort requested — cancelling in-flight request');
    });

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

  if (this.confirmReject) this.confirmReject.addEventListener('click', () => this.confirmRejectAction());
    // Bulk delete button removed with the bulk section; no injection
  if (this.cancelReject) this.cancelReject.addEventListener('click', () => this.hideRejectModal());

  if (this.closeActivity) this.closeActivity.addEventListener('click', () => this.hideActivityModal());
    if (this.closeUserDetails) this.closeUserDetails.addEventListener('click', () => this.hideUserDetails());

    // Handle back/forward navigation for filters
    window.addEventListener('popstate', () => {
      try {
        this.restoreFiltersFromUrl();
        this.loadUsers();
      } catch (e) { /* ignore */ }
    });
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

  // Update the browser URL with current filters/page without reloading
  updateUrlParams() {
    try {
      const params = new URLSearchParams();
      const s = this.searchInput?.value?.trim();
      if (s) params.set('search', s);
      if (this.filterRole?.value) params.set('role', this.filterRole.value);
      if (this.filterStatus?.value) params.set('status', this.filterStatus.value);
      if (this.filterVerified?.value !== undefined && this.filterVerified?.value !== '') params.set('verified', this.filterVerified.value);
      if (this.page) params.set('page', String(this.page));
      if (this.limit) params.set('limit', String(this.limit));
      const qs = params.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      history.replaceState({}, '', newUrl);
    } catch (e) {
      // ignore
    }
  }

  // Restore filters and pagination from URL query params
  restoreFiltersFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page');
      const limit = params.get('limit');
      const search = params.get('search');
      const role = params.get('role');
      const status = params.get('status');
      const verified = params.get('verified');

      if (page) this.page = parseInt(page, 10) || this.page;
      if (limit) this.limit = parseInt(limit, 10) || this.limit;
      if (this.pageSizeSelect) this.pageSizeSelect.value = String(this.limit);
      if (this.searchInput && search !== null) this.searchInput.value = search;
      if (this.filterRole && role !== null) this.filterRole.value = role;
      if (this.filterStatus && status !== null) this.filterStatus.value = status;
      if (this.filterVerified && verified !== null) this.filterVerified.value = verified;
    } catch (e) {
      // ignore
    }
  }

  async loadUsers() {
    // Prevent overlapping loads; use a request id to ignore stale responses
    const requestId = ++this._latestRequestId;
    try {
      this.isLoading = true;
      this.tbody.innerHTML = '<tr><td colspan="8" class="empty">Loading users…</td></tr>';
      const params = this.buildParams();
    const res = await api.getAdminUsers(params);
      // Ignore if a newer request started
      if (requestId !== this._latestRequestId) return;
    this.total = res.total || 0;
    this.users = res.data || [];
    this.renderUsers(this.users);
    this.renderPagination(res.page || 1, res.pages || 1);
    if (this.totalCount) this.totalCount.textContent = `Total: ${this.total}`;
    // Update URL to reflect current filters/page
    try { this.updateUrlParams(); } catch (e) {}
    // Render active filter chips
    try { this.renderActiveFilters(); } catch (e) {}
    } catch (err) {
      console.error('Load users failed', err);
      this.tbody.innerHTML = `<tr><td colspan="8" class="empty">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
    } finally {
      this.isLoading = false;
    }
  }

  // Simple debounce helper
  debounce(fn, wait) {
    let timeout = null;
    return (...args) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  renderUsers(users) {
    // Do not clear selection here - keep selections across pages.
    // Synchronize visible checkboxes with the persisted selection set.
    if (!users.length) {
      this.tbody.innerHTML = '<tr><td colspan="8" class="empty">No users found</td></tr>';
      return;
    }

  this.tbody.innerHTML = users.map(u => this.userRowHTML(u)).join('');

    // Bind row events
    this.tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
      const id = cb.dataset.id;
      // reflect persisted selection
      try { cb.checked = this.selected.has(String(id)); } catch (_) { cb.checked = false; }
      cb.addEventListener('change', (e) => {
        const id = String(e.target.dataset.id);
        if (e.target.checked) this.selected.add(id); else this.selected.delete(id);
        this.updateSelectionUI();
      });
    });

    this.tbody.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', (e) => this.approveUser(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', (e) => this.showRejectModal(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.role-select').forEach(sel => sel.addEventListener('change', (e) => this.changeRole(e.target.dataset.id, e.target.value)));
    this.tbody.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', (e) => this.showUserDetails(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.logs-btn').forEach(btn => btn.addEventListener('click', (e) => this.openLogs(e.target.closest('button').dataset.id)));
    this.tbody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.confirmDelete(e.target.closest('button').dataset.id)));

    // Update selectAll checkbox state (checked if all visible rows are selected)
    try {
      const visible = Array.from(this.tbody.querySelectorAll('input[type="checkbox"][data-id]'));
      if (visible.length === 0) {
        if (this.selectAll) this.selectAll.checked = false;
      } else {
        const allChecked = visible.every(cb => cb.checked);
        if (this.selectAll) this.selectAll.checked = allChecked;
      }
    } catch (e) {}

    // Ensure bulk controls visibility reflects current selection
    this.updateSelectionUI();
  }

  // Render active filter chips below the filters
  renderActiveFilters() {
    try {
      const container = document.getElementById('activeFilters');
      if (!container) return;
      container.innerHTML = '';
      const chips = [];
      const s = this.searchInput?.value?.trim();
      if (s) chips.push({ key: 'search', label: `Search: "${s}"` });
      if (this.filterRole?.value) chips.push({ key: 'role', label: `Role: ${this.filterRole.value}` });
      if (this.filterStatus?.value) chips.push({ key: 'status', label: `Status: ${this.filterStatus.value}` });
      if (this.filterVerified?.value !== undefined && this.filterVerified?.value !== '') chips.push({ key: 'verified', label: `Verified: ${this.filterVerified.value}` });

      chips.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'filter-chip';
        btn.type = 'button';
        btn.setAttribute('data-key', ch.key);
        btn.setAttribute('aria-label', `Remove filter ${ch.label}`);
        btn.innerHTML = `${escapeHtml(ch.label)} <span aria-hidden="true">✕</span>`;
        btn.onclick = () => {
          this.removeFilter(ch.key);
        };
        container.appendChild(btn);
      });
    } catch (e) {
      // ignore
    }
  }

  removeFilter(key) {
    if (!key) return;
    if (key === 'search' && this.searchInput) this.searchInput.value = '';
    if (key === 'role' && this.filterRole) this.filterRole.value = '';
    if (key === 'status' && this.filterStatus) this.filterStatus.value = '';
    if (key === 'verified' && this.filterVerified) this.filterVerified.value = '';
    this.page = 1;
    this.loadUsers();
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
          <button class="btn btn-info icon-btn view-btn" aria-label="View details" title="View details" data-id="${u._id}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5a7 7 0 017 7 7 7 0 11-14 0 7 7 0 017-7zm0 2a5 5 0 100 10 5 5 0 000-10z"/></svg>
          </button>
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

    const createBtn = (label, disabled, onClick, extraClass) => {
      const b = document.createElement('button');
      b.className = 'page-btn' + (extraClass ? ' ' + extraClass : '');
      if (disabled) b.disabled = true;
      b.textContent = label;
      if (onClick) b.addEventListener('click', onClick);
      return b;
    };

    // Prev
    this.pagination.appendChild(createBtn('Prev', page <= 1, () => { this.page = Math.max(1, page - 1); this.loadUsers(); }));

    // Show windowed page numbers
    const maxButtons = 7;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(pages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);

    if (start > 1) {
      this.pagination.appendChild(createBtn('1', false, () => { this.page = 1; this.loadUsers(); }));
      if (start > 2) {
        const ell = document.createElement('span'); ell.className = 'ellipsis'; ell.textContent = '…'; this.pagination.appendChild(ell);
      }
    }

    for (let p = start; p <= end; p++) {
      const btn = createBtn(String(p), false, () => { this.page = p; this.loadUsers(); }, p === page ? 'active' : '');
      this.pagination.appendChild(btn);
    }

    if (end < pages) {
      if (end < pages - 1) {
        const ell = document.createElement('span'); ell.className = 'ellipsis'; ell.textContent = '…'; this.pagination.appendChild(ell);
      }
      this.pagination.appendChild(createBtn(String(pages), false, () => { this.page = pages; this.loadUsers(); }));
    }

    // Next
    this.pagination.appendChild(createBtn('Next', page >= pages, () => { this.page = Math.min(pages, page + 1); this.loadUsers(); }));
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
    // Show or hide the bulk controls toolbar
    try {
      if (this.bulkControls) {
        if (count > 0) {
          this.bulkControls.style.display = 'flex';
          this.bulkControls.setAttribute('aria-hidden', 'false');
          this._announce(`${count} users selected`);
        } else {
          this.bulkControls.style.display = 'none';
          this.bulkControls.setAttribute('aria-hidden', 'true');
          this._announce('Selection cleared');
        }
      }
    } catch (e) {}
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
    if (!id) return;
    notify.confirm('Approve this user?', async () => {
      const loader = notify.loading('Approving user...');
      try {
        // disable row button while in-flight
        try {
          const btn = this.tbody.querySelector(`button.approve-btn[data-id="${id}"]`);
          if (btn) btn.disabled = true;
        } catch(_) {}
        await api.approveUser(id, null);
        notify.success('User approved');
        // refresh list and stats
        try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
        this.loadUsers();
      } catch (err) {
        notify.error('Approve failed: ' + escapeHtml(err.message));
      } finally {
        try { loader && loader.remove && loader.remove(); } catch (_) {}
        try {
          const btn = this.tbody.querySelector(`button.approve-btn[data-id="${id}"]`);
          if (btn) btn.disabled = false;
        } catch(_) {}
      }
    });
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
      // disable confirm button to prevent duplicate submissions
      try { if (this.confirmReject) this.confirmReject.disabled = true; } catch(_) {}
      await api.rejectUser(this.currentRejectUserId, this.rejectReason.value.trim());
      notify.success('User rejected');
      this.hideRejectModal();
      try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
      this.loadUsers();
    } catch (err) {
      notify.error('Reject failed: ' + escapeHtml(err.message));
    }
    finally { try { if (this.confirmReject) this.confirmReject.disabled = false; } catch(_) {} }
  }

  async changeRole(id, role) {
    try {
      // disable role select while updating
      let sel;
      try { sel = this.tbody.querySelector(`select.role-select[data-id="${id}"]`); if (sel) sel.disabled = true; } catch(_) {}
      await api.updateUserRole(id, role);
      notify.success('Role updated');
      // No full reload needed, but refresh to reflect logs/status
      try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
      this.loadUsers();
    } catch (err) {
      notify.error('Role update failed: ' + escapeHtml(err.message));
      this.loadUsers();
    }
    finally { try { if (sel) sel.disabled = false; } catch(_) {} }
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
      // Second confirmation: require typing DELETE to avoid accidental deletes
      const token = prompt('Type DELETE to confirm permanent deletion of this user');
      if (!token || token.trim().toUpperCase() !== 'DELETE') {
        notify.error('Deletion aborted: confirmation text mismatch');
        return;
      }
      const loader = notify.loading('Deleting user...');
      try {
        await api.deleteUser(userId);
        notify.success('User deleted');
        try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
        this.loadUsers();
      } catch (err) {
        handleAPIError(err);
      } finally {
        try { loader && loader.remove && loader.remove(); } catch (_) {}
      }
    });
  }

  async bulkDelete() {
    const ids = Array.from(this.selected);
    if (!ids.length) return;
    // Confirm destructive bulk delete
    notify.confirm(`Delete ${ids.length} selected user(s)? This action cannot be undone.`, async () => {
      const chunkSize = 200;
      const total = ids.length;
      const resultsAgg = [];
      let deletedCount = 0;
      try {
    // Disable bulk controls while running
        this._bulkRunning = true;
        this._bulkCancelRequested = false;
    // create an AbortController to allow immediate cancellation of the in-flight fetch
    try { this._bulkAbortController = new AbortController(); } catch (_) { this._bulkAbortController = null; }
        if (this.bulkApproveBtn) this.bulkApproveBtn.disabled = true;
        if (this.bulkRejectBtn) this.bulkRejectBtn.disabled = true;
        if (this.bulkChangeRoleBtn) this.bulkChangeRoleBtn.disabled = true;
        if (this.bulkDeleteBtn) this.bulkDeleteBtn.disabled = true;

        // Open summary modal and show progress
        if (this.bulkSummaryModal && this.bulkSummaryContent) {
          this.bulkSummaryContent.innerHTML = `<div>Deleting ${escapeHtml(String(total))} user(s)...</div><div id="bulkProgress">0 / ${escapeHtml(String(total))}</div>`;
          // show abort button while running
          try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'inline-block'; } catch(_) {}
          try { if (this.retryBulkBtn) this.retryBulkBtn.style.display = 'none'; } catch(_) {}
          this.bulkSummaryModal.style.display = 'flex';
        }

        for (let i = 0; i < ids.length; i += chunkSize) {
          // allow cancellation
          if (this._bulkCancelRequested) {
            resultsAgg.push({ _aborted: true });
            break;
          }
          const chunk = ids.slice(i, i + chunkSize);
          // call server for this chunk, pass abort signal so we can cancel in-flight requests
          try {
            const res = await api.bulkDeleteUsers(chunk, { signal: this._bulkAbortController ? this._bulkAbortController.signal : undefined });
            const data = res?.data || {};
            const chunkResults = Array.isArray(data.results) ? data.results : (chunk.map(id => ({ id, ok: true })));
            resultsAgg.push(...chunkResults);
            deletedCount += (data.deleted || 0);
          } catch (err) {
            // detect abort
            if (err && err.name === 'AbortError') {
              resultsAgg.push({ _aborted: true });
              notify.info('Bulk delete aborted');
              break;
            }
            // push chunk-level failure and continue (or respect cancel)
            resultsAgg.push({ chunk: Math.floor(i / chunkSize) + 1, error: err && err.message ? String(err.message) : String(err) });
          }
          // update progress
          try {
            const prog = document.getElementById('bulkProgress');
            if (prog) prog.innerHTML = `${escapeHtml(String(Math.min(i + chunk.length, total)))} / ${escapeHtml(String(total))}`;
          } catch (_) {}
        }

        // Aggregated summary
        this.showBulkSummary({ action: 'delete', requested: total, deleted: deletedCount, results: resultsAgg });

        // Remove successfully deleted ids from selection
        resultsAgg.filter(r => r.ok).forEach(r => this.selected.delete(String(r.id)));
        if (this.selectAll) this.selectAll.checked = false;
        this.updateSelectionUI();
        try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
        this.loadUsers();
      } catch (err) {
        handleAPIError(err);
      } finally {
        this._bulkRunning = false;
        // clear abort controller
        try { this._bulkAbortController = null; } catch(_) {}
        // re-enable controls (updateSelectionUI will re-disable if no selection)
        this.updateSelectionUI();
        try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'none'; } catch(_) {}
      }
    });
  }

  async runBulk(payload) {
    const ids = Array.isArray(payload.userIds) ? payload.userIds.map(String) : [];
    if (!ids.length) return notify.error('No users selected for bulk operation');
    const chunkSize = 200; // safe chunk size for large operations
    const total = ids.length;
  let matched = 0;
  let modified = 0;
  const errors = [];
  const perIdResults = [];
    try {
      this._bulkRunning = true;
      this._bulkCancelRequested = false;
      // controller to cancel in-flight requests immediately
      try { this._bulkAbortController = new AbortController(); } catch (_) { this._bulkAbortController = null; }
      // Disable bulk controls while running
      if (this.bulkApproveBtn) this.bulkApproveBtn.disabled = true;
      if (this.bulkRejectBtn) this.bulkRejectBtn.disabled = true;
      if (this.bulkChangeRoleBtn) this.bulkChangeRoleBtn.disabled = true;
      if (this.bulkDeleteBtn) this.bulkDeleteBtn.disabled = true;

      if (this.bulkSummaryModal && this.bulkSummaryContent) {
        this.bulkSummaryContent.innerHTML = `<div>Running bulk ${escapeHtml(String(payload.action))} on ${escapeHtml(String(total))} user(s)...</div><div id="bulkProgress">0 / ${escapeHtml(String(total))}</div>`;
        try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'inline-block'; } catch(_) {}
        try { if (this.retryBulkBtn) this.retryBulkBtn.style.display = 'none'; } catch(_) {}
        this.bulkSummaryModal.style.display = 'flex';
      }

      // Idempotency key for the overall bulk operation
      const idempotencyKey = `bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        for (let i = 0; i < ids.length; i += chunkSize) {
        if (this._bulkCancelRequested) {
          errors.push({ chunk: 'aborted', message: 'Operation aborted by user' });
          break;
        }
        const chunk = ids.slice(i, i + chunkSize);
        try {
          const res = await api.bulkUpdateUsers(Object.assign({}, payload, { userIds: chunk, idempotencyKey }), { signal: this._bulkAbortController ? this._bulkAbortController.signal : undefined });
          const data = res && res.data ? res.data : res || {};
          matched += (data.matched || 0);
          modified += (data.modified || 0);
          if (Array.isArray(data.results)) perIdResults.push(...data.results);
        } catch (err) {
          if (err && err.name === 'AbortError') {
            errors.push({ chunk: Math.floor(i / chunkSize) + 1, message: 'aborted' });
            notify.info('Bulk operation aborted');
            break;
          }
          errors.push({ chunk: Math.floor(i / chunkSize) + 1, message: err.message || String(err) });
        }
        try {
          const prog = document.getElementById('bulkProgress');
          if (prog) prog.innerHTML = `${escapeHtml(String(Math.min(i + chunk.length, total)))} / ${escapeHtml(String(total))}`;
        } catch (_) {}
      }

      // Show final summary
  const result = { matched, modified, errors };
  const summary = { action: payload.action, requested: total, result };
  if (perIdResults.length) summary.results = perIdResults;
  this.showBulkSummary(summary);

      // For safety, clear selection of processed ids
      ids.forEach(id => this.selected.delete(String(id)));
      if (this.selectAll) this.selectAll.checked = false;
      this.updateSelectionUI();
      try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
      this.loadUsers();
    } catch (err) {
      notify.error('Bulk operation failed: ' + escapeHtml(err.message));
    } finally {
      this._bulkRunning = false;
      try { this._bulkAbortController = null; } catch(_) {}
      this.updateSelectionUI();
      this._announce('Bulk operation completed');
    }
  }

  showBulkSummary(summary) {
    try {
      if (!this.bulkSummaryContent || !this.bulkSummaryModal) return;
      // store last summary for potential retry
      this._lastBulkSummary = summary;
      let html = `<div class="bulk-summary-row"><strong>Action:</strong> ${escapeHtml(String(summary.action || 'bulk'))}</div>`;
      if (summary.requested !== undefined) html += `<div class="bulk-summary-row"><strong>Requested:</strong> ${escapeHtml(String(summary.requested))}</div>`;
      if (summary.result) {
        html += `<div class="bulk-summary-row"><strong>Matched:</strong> ${escapeHtml(String(summary.result.matched || '0'))}</div>`;
        html += `<div class="bulk-summary-row"><strong>Modified:</strong> ${escapeHtml(String(summary.result.modified || '0'))}</div>`;
      }
      if (summary.deleted !== undefined) html += `<div class="bulk-summary-row"><strong>Deleted:</strong> ${escapeHtml(String(summary.deleted))}</div>`;
      if (Array.isArray(summary.results) && summary.results.length) {
        html += '<h4>Details</h4><ul class="bulk-results-list">';
        summary.results.forEach(r => {
          const status = r.ok ? 'ok' : 'fail';
          const label = r.ok ? (summary.action === 'delete' ? 'deleted' : 'updated') : (r.reason || 'failed');
          html += `<li>${escapeHtml(String(r.id))}: <span class="${status}">${escapeHtml(String(label))}</span></li>`;
        });
        html += '</ul>';
      }
      this.bulkSummaryContent.innerHTML = html;
      // set aria and show
      try { this.bulkSummaryModal.setAttribute('aria-hidden', 'false'); } catch(_) {}
      this.bulkSummaryModal.style.display = 'flex';
      // focus management: prefer retry button then close
      try {
        if (this.retryBulkBtn && this.retryBulkBtn.style.display !== 'none') { this.retryBulkBtn.focus(); }
        else if (this.closeBulkSummary) { this.closeBulkSummary.focus(); }
      } catch(_) {}
      // keyboard: Esc closes modal or aborts if running
      this._bulkModalKeyHandler = (e) => {
        if (e.key === 'Escape') {
          if (this._bulkRunning && this.abortBulkBtn && this.abortBulkBtn.style.display !== 'none') {
            this._bulkCancelRequested = true;
            notify.info('Bulk abort requested');
          } else {
            this.hideBulkSummary();
          }
        }
      };
      document.addEventListener('keydown', this._bulkModalKeyHandler);
      // show retry button if there are failures (now supported for all actions when per-id results are provided)
      try {
        const failures = Array.isArray(summary.results) ? summary.results.filter(r => !r.ok) : [];
        if (this.retryBulkBtn) this.retryBulkBtn.style.display = failures.length ? 'inline-block' : 'none';
      } catch (_) {}
      try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'none'; } catch(_) {}
    } catch (e) {
      // fallback to toast
      notify.info('Bulk operation completed');
    }
  }

  hideBulkSummary() { if (this.bulkSummaryModal) {
      try { this.bulkSummaryModal.setAttribute('aria-hidden', 'true'); } catch(_) {}
      this.bulkSummaryModal.style.display = 'none';
    }
    this._clearBulkModalButtons();
    try { document.removeEventListener('keydown', this._bulkModalKeyHandler); } catch(_) {}
  }
  
  // ensure modal buttons hidden when closed
  _clearBulkModalButtons() {
    try { if (this.retryBulkBtn) this.retryBulkBtn.style.display = 'none'; } catch(_) {}
    try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'none'; } catch(_) {}
  }

  // Select all users matching current filters across all pages
  async selectAllMatching() {
    try {
      // Prefer server-assisted IDs endpoint (with preview to know total)
      const baseParams = this.buildParams();
      const preview = await api.getAdminUserIds(Object.assign({}, baseParams, { page: 1, limit: 1 }));
      const total = preview.total || 0;
      if (total > 5000) {
        const ok = confirm(`This will select ${total} users matching your filters. This could be large and may impact performance. Continue?`);
        if (!ok) return;
      }
      const ids = [];
      const pageLimit = 10000;
      const pages = Math.max(1, Math.ceil(total / pageLimit));
      for (let p = 1; p <= pages; p++) {
        const res = await api.getAdminUserIds(Object.assign({}, baseParams, { page: p, limit: pageLimit }));
        (res.ids || []).forEach(id => ids.push(String(id)));
      }
      // set selection
      ids.forEach(id => this.selected.add(String(id)));
      this.updateSelectionUI();
      // Visual feedback: check visible checkboxes that are included
      this.tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => { cb.checked = this.selected.has(String(cb.dataset.id)); });
      notify.success(`Selected ${this.selected.size} user(s)`);
      this._announce(`Selected ${this.selected.size} users`);
    } catch (err) {
      notify.error('Failed to select all matching users: ' + escapeHtml(err.message || String(err)));
    }
  }

  _announce(text) {
    try { if (this._ariaLive) this._ariaLive.textContent = String(text || ''); } catch(_) {}
  }

  // Retry last bulk operation failures (currently supports delete retries where per-id failures are returned)
  async retryLastBulk() {
    const s = this._lastBulkSummary;
    if (!s) return notify.error('No bulk summary available to retry');
    if (Array.isArray(s.results) && s.results.length) {
      const failed = s.results.filter(r => !r.ok).map(r => String(r.id));
      if (!failed.length) return notify.info('No failed items to retry');
      const ok = confirm(`Retry ${s.action} for ${failed.length} failed item(s)?`);
      if (!ok) return;
      if (s.action === 'delete') {
        await this._bulkDeleteRetry(failed);
      } else {
        await this._bulkRetryAction(s.action, failed);
      }
    } else {
      notify.error('No per-item results available to retry');
    }
  }

  // Internal retry delete (no extra confirm)
  async _bulkDeleteRetry(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const chunkSize = 200;
    const total = ids.length;
    const resultsAgg = [];
    let deletedCount = 0;
    try {
      this._bulkRunning = true;
      this._bulkCancelRequested = false;
      try { this._bulkAbortController = new AbortController(); } catch (_) { this._bulkAbortController = null; }
      if (this.bulkSummaryModal && this.bulkSummaryContent) {
        this.bulkSummaryContent.innerHTML = `<div>Retrying delete for ${escapeHtml(String(total))} user(s)...</div><div id="bulkProgress">0 / ${escapeHtml(String(total))}</div>`;
        try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'inline-block'; } catch(_) {}
        this.bulkSummaryModal.style.display = 'flex';
      }
      for (let i = 0; i < ids.length; i += chunkSize) {
        if (this._bulkCancelRequested) { break; }
        const chunk = ids.slice(i, i + chunkSize);
        try {
          const res = await api.bulkDeleteUsers(chunk, { signal: this._bulkAbortController ? this._bulkAbortController.signal : undefined });
          const data = res?.data || {};
          const chunkResults = Array.isArray(data.results) ? data.results : (chunk.map(id => ({ id, ok: true })));
          resultsAgg.push(...chunkResults);
          deletedCount += (data.deleted || 0);
        } catch (err) {
          if (err && err.name === 'AbortError') { notify.info('Bulk retry aborted'); break; }
          resultsAgg.push({ chunk: Math.floor(i / chunkSize) + 1, error: err && err.message ? String(err.message) : String(err) });
        }
        try {
          const prog = document.getElementById('bulkProgress');
          if (prog) prog.innerHTML = `${escapeHtml(String(Math.min(i + chunk.length, total)))} / ${escapeHtml(String(total))}`;
        } catch (_) {}
      }
      this.showBulkSummary({ action: 'delete', requested: total, deleted: deletedCount, results: resultsAgg });
      resultsAgg.filter(r => r.ok).forEach(r => this.selected.delete(String(r.id)));
      this.updateSelectionUI();
  try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
  this.loadUsers();
    } catch (err) {
      handleAPIError(err);
    } finally {
      this._bulkRunning = false;
      try { this._bulkAbortController = null; } catch(_) {}
      try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'none'; } catch(_) {}
    }
  }

  // Generic retry for approve/reject/role failures
  async _bulkRetryAction(action, ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const chunkSize = 200;
    const total = ids.length;
    let matched = 0;
    let modified = 0;
    const resultsAgg = [];
    try {
      this._bulkRunning = true;
      this._bulkCancelRequested = false;
      try { this._bulkAbortController = new AbortController(); } catch(_) { this._bulkAbortController = null; }
      if (this.bulkSummaryModal && this.bulkSummaryContent) {
        this.bulkSummaryContent.innerHTML = `<div>Retrying ${escapeHtml(action)} for ${escapeHtml(String(total))} user(s)...</div><div id="bulkProgress">0 / ${escapeHtml(String(total))}</div>`;
        try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'inline-block'; } catch(_) {}
        this.bulkSummaryModal.style.display = 'flex';
      }
      const idempotencyKey = `bulk-retry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      for (let i = 0; i < ids.length; i += chunkSize) {
        if (this._bulkCancelRequested) break;
        const chunk = ids.slice(i, i + chunkSize);
        try {
          const res = await api.bulkUpdateUsers({ action, userIds: chunk, idempotencyKey }, { signal: this._bulkAbortController ? this._bulkAbortController.signal : undefined });
          const data = res && res.data ? res.data : res || {};
          matched += (data.matched || 0);
          modified += (data.modified || 0);
          if (Array.isArray(data.results)) resultsAgg.push(...data.results);
        } catch (err) {
          if (err && err.name === 'AbortError') { notify.info('Bulk retry aborted'); break; }
          resultsAgg.push({ chunk: Math.floor(i / chunkSize) + 1, error: err && err.message ? String(err.message) : String(err) });
        }
        try { const prog = document.getElementById('bulkProgress'); if (prog) prog.innerHTML = `${escapeHtml(String(Math.min(i + chunk.length, total)))} / ${escapeHtml(String(total))}`; } catch(_) {}
      }
      const summary = { action, requested: total, result: { matched, modified }, results: resultsAgg };
      this.showBulkSummary(summary);
      resultsAgg.filter(r => r.ok).forEach(r => this.selected.delete(String(r.id)));
      this.updateSelectionUI();
      try { document.dispatchEvent(new Event('stats:refresh')); } catch(_) {}
      this.loadUsers();
    } catch (err) {
      handleAPIError(err);
    } finally {
      this._bulkRunning = false;
      try { if (this.abortBulkBtn) this.abortBulkBtn.style.display = 'none'; } catch(_) {}
      try { this._bulkAbortController = null; } catch(_) {}
    }
  }

  // Focus trap helpers for modals
  _trapFocus(modalEl) {
    if (!modalEl) return () => {};
    const focusable = modalEl.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last && last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first && first.focus(); }
      }
    };
    modalEl.addEventListener('keydown', handler);
    try { first && first.focus(); } catch(_) {}
    return () => { modalEl.removeEventListener('keydown', handler); };
  }

  // Override show/hide to trap focus
  showUserDetails(userId) {
    try {
      const user = (this.users || []).find(u => String(u._id) === String(userId));
      if (!user) { notify.error('User details not available'); return; }
      const html = `
        <div class="detail-row"><strong>Name:</strong> ${escapeHtml(user.name || '-')}</div>
        <div class="detail-row"><strong>Username:</strong> ${escapeHtml(user.username || '-')}</div>
        <div class="detail-row"><strong>Email:</strong> ${escapeHtml(user.email || '-')}</div>
        <div class="detail-row"><strong>Role:</strong> ${escapeHtml(user.role || '-')}</div>
        <div class="detail-row"><strong>Status:</strong> ${escapeHtml(user.verificationStatus || '-')}</div>
        <div class="detail-row"><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</div>
        <div class="detail-row"><strong>Department:</strong> ${escapeHtml(user.department || '-')}</div>
        <div class="detail-row"><strong>Year:</strong> ${escapeHtml(user.year || '-')}</div>
        <div class="detail-row"><strong>Team:</strong> ${escapeHtml(user.team?.name || '-')}</div>
        <div class="detail-row"><strong>Registered:</strong> ${new Date(user.createdAt).toLocaleString()}</div>
      `;
      if (this.userDetailsContent) this.userDetailsContent.innerHTML = html;
      if (this.userDetailsModal) {
        try { this.userDetailsModal.setAttribute('aria-hidden', 'false'); } catch(_) {}
        this.userDetailsModal.style.display = 'flex';
        this._cleanupTrapUser = this._trapFocus(this.userDetailsModal);
      }
    } catch (err) { notify.error('Failed to show user details'); }
  }

  hideUserDetails() { if (this.userDetailsModal) { try { this.userDetailsModal.setAttribute('aria-hidden', 'true'); } catch(_) {} this.userDetailsModal.style.display = 'none'; try { this._cleanupTrapUser && this._cleanupTrapUser(); } catch(_) {} } }

  showRejectModal(id) {
    this.currentRejectUserId = id;
    this.rejectReason.value = '';
    this.rejectModal.style.display = 'flex';
    this._cleanupTrapReject = this._trapFocus(this.rejectModal);
  }

  hideRejectModal() { this.rejectModal.style.display = 'none'; this.currentRejectUserId = null; try { this._cleanupTrapReject && this._cleanupTrapReject(); } catch(_) {} }

  async openLogs(userId) {
    try {
      const res = await api.getActivityLogs({ userId, limit: 20 });
      const logs = res.data || [];
      this.activityList.innerHTML = logs.length ? logs.map(l => this.logItemHTML(l)).join('') : '<div class="activity-item">No activities found</div>';
      if (this.activityModal) {
        try { this.activityModal.setAttribute('aria-hidden', 'false'); } catch(_) {}
        this.activityModal.style.display = 'flex';
        try { if (this.closeActivity) this.closeActivity.focus(); } catch(_) {}
      }
    } catch (err) {
      notify.error('Failed to load activity logs: ' + escapeHtml(err.message));
    }
  }

  // Show user details modal using data from last loaded page
  showUserDetails(userId) {
    try {
      const user = (this.users || []).find(u => String(u._id) === String(userId));
      if (!user) {
        notify.error('User details not available');
        return;
      }
      const html = `
        <div class="detail-row"><strong>Name:</strong> ${escapeHtml(user.name || '-')}</div>
        <div class="detail-row"><strong>Username:</strong> ${escapeHtml(user.username || '-')}</div>
        <div class="detail-row"><strong>Email:</strong> ${escapeHtml(user.email || '-')}</div>
        <div class="detail-row"><strong>Role:</strong> ${escapeHtml(user.role || '-')}</div>
        <div class="detail-row"><strong>Status:</strong> ${escapeHtml(user.verificationStatus || '-')}</div>
        <div class="detail-row"><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</div>
        <div class="detail-row"><strong>Department:</strong> ${escapeHtml(user.department || '-')}</div>
        <div class="detail-row"><strong>Year:</strong> ${escapeHtml(user.year || '-')}</div>
        <div class="detail-row"><strong>Team:</strong> ${escapeHtml(user.team?.name || '-')}</div>
        <div class="detail-row"><strong>Registered:</strong> ${new Date(user.createdAt).toLocaleString()}</div>
      `;
      if (this.userDetailsContent) this.userDetailsContent.innerHTML = html;
      if (this.userDetailsModal) {
        try { this.userDetailsModal.setAttribute('aria-hidden', 'false'); } catch(_) {}
        this.userDetailsModal.style.display = 'flex';
        try { if (this.closeUserDetails) this.closeUserDetails.focus(); } catch(_) {}
      }
    } catch (err) {
      notify.error('Failed to show user details');
    }
  }

  hideUserDetails() { if (this.userDetailsModal) { try { this.userDetailsModal.setAttribute('aria-hidden', 'true'); } catch(_) {} this.userDetailsModal.style.display = 'none'; } }

  hideActivityModal() { if (this.activityModal) { try { this.activityModal.setAttribute('aria-hidden', 'true'); } catch(_) {} this.activityModal.style.display = 'none'; } }

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

// Expose for tests (no effect in browser)
try { if (typeof module !== 'undefined') module.exports = { AdminUsersManager }; } catch (_) {}
