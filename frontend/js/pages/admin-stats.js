/* Admin Stats & Activity Page
 * Renders admin dashboard stats with short-lived caching and an activity log
 * viewer with filters and pagination. Provides click-to-filter navigation into
 * the users page for common cohorts.
 */

class AdminStatsManager {
  constructor() {
    this.statsEl = document.getElementById('adminStats');
    this.activityList = document.getElementById('activityList');
    this.activityPagination = document.getElementById('activityPagination');
    this.activitySearch = document.getElementById('activitySearch');
    this.activityAction = document.getElementById('activityAction');
    this.activityUser = document.getElementById('activityUser');
    this.applyActivityFilters = document.getElementById('applyActivityFilters');
    this.resetActivityFilters = document.getElementById('resetActivityFilters');

    this.activityPage = 1;
    this.activityLimit = 25;
    this._latestActivityRequest = 0;
  }

  init() {
    // wire elements that may not exist immediately
    this.activityList = document.getElementById('activityList');
    this.activityPagination = document.getElementById('activityPagination');
    this.activitySearch = document.getElementById('activitySearch');
    this.activityAction = document.getElementById('activityAction');
    this.activityUser = document.getElementById('activityUser');
    this.applyActivityFilters = document.getElementById('applyActivityFilters');
    this.resetActivityFilters = document.getElementById('resetActivityFilters');

    // Bind events
    if (this.applyActivityFilters) this.applyActivityFilters.addEventListener('click', () => { this.activityPage = 1; this.loadActivity(); });
    if (this.resetActivityFilters) this.resetActivityFilters.addEventListener('click', () => { this.activitySearch.value = ''; this.activityAction.value = ''; this.activityUser.value = ''; this.activityPage = 1; this.loadActivity(); });

    // Click-to-filter on stat cards
    document.querySelectorAll('#adminStats .stat-card').forEach(card => {
      // accessibility: make cards focusable and keyboard-activatable
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.addEventListener('click', (e) => { this.onStatClick(card.dataset.key); });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onStatClick(card.dataset.key);
        }
      });
    });

    // Listen for stats-refresh events from other pages/actions
    document.addEventListener('stats:refresh', () => this.fetchStats());

    // initial load (with short cache)
    this.fetchStats();
    this.loadActivity();

    // keyboard: Enter in search triggers load
    if (this.activitySearch) {
      this.activitySearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') { this.activityPage = 1; this.loadActivity(); } });
    }
  }

  async fetchStats() {
    const CACHE_KEY = 'admin_stats_cache_v1';
    try {
      const cached = utils.storage.get(CACHE_KEY);
      const now = Date.now();
      if (cached && cached.ts && (now - cached.ts) < (60 * 1000) && cached.data) {
        this.renderStats(cached.data);
        return;
      }
      const res = await api.get('/admin/stats');
      const data = (res && res.data) ? res.data : (res || {});
      this.renderStats(data);
      try { utils.storage.set(CACHE_KEY, { ts: Date.now(), data }); } catch (_) {}
    } catch (err) {
      console.error('Failed to load stats', err);
      try { notify.error('Failed to load admin stats: ' + (err.message || String(err))); } catch(_) {}
      // show dashes
      try { const el = document.getElementById('stat-totalVolunteers'); if (el) el.querySelector('.stat-value').textContent = '-'; } catch(_) {}
      try { const el = document.getElementById('stat-activeVolunteers'); if (el) el.querySelector('.stat-value').textContent = '-'; } catch(_) {}
      try { const el = document.getElementById('stat-totalTeams'); if (el) el.querySelector('.stat-value').textContent = '-'; } catch(_) {}
      try { const el = document.getElementById('stat-volunteersWithoutTeam'); if (el) el.querySelector('.stat-value').textContent = '-'; } catch(_) {}
    }
  }

  renderStats(s) {
    try {
      document.getElementById('stat-totalVolunteers').querySelector('.stat-value').textContent = s.totalVolunteers ?? 0;
      document.getElementById('stat-activeVolunteers').querySelector('.stat-value').textContent = s.activeVolunteers ?? 0;
      document.getElementById('stat-totalTeams').querySelector('.stat-value').textContent = s.totalTeams ?? 0;
      document.getElementById('stat-volunteersWithoutTeam').querySelector('.stat-value').textContent = s.volunteersWithoutTeam ?? 0;
    } catch (e) {}
  }

  onStatClick(key) {
    // click-to-filter behavior: navigate to admin-users with sensible filters
    if (key === 'totalVolunteers' || key === 'activeVolunteers' || key === 'volunteersWithoutTeam') {
      // Navigate to users page with role=volunteer
      const qs = new URLSearchParams();
      qs.set('role', 'volunteer');
      if (key === 'activeVolunteers') qs.set('status', 'approved');
      if (key === 'volunteersWithoutTeam') qs.set('availableOnly', 'true');
      if (typeof window !== 'undefined' && window.__TEST_NAV_CAPTURE__) {
        window.__LAST_NAV__ = `admin-users.html?${qs.toString()}`;
      } else {
        window.location = `admin-users.html?${qs.toString()}`;
      }
      return;
    }
    if (key === 'totalTeams') {
      window.location = 'teams.html';
      return;
    }
  }

  async loadActivity(page = this.activityPage) {
    const requestId = ++this._latestActivityRequest;
    try {
      const params = { page: page, limit: this.activityLimit };
      const q = (this.activitySearch && this.activitySearch.value && this.activitySearch.value.trim()) ? this.activitySearch.value.trim() : '';
      if (q) params.search = q;
      if (this.activityAction && this.activityAction.value) params.action = this.activityAction.value;
      if (this.activityUser && this.activityUser.value) params.userId = this.activityUser.value.trim();
      // Support backend filters if optional inputs exist
      const actorEl = document.getElementById('activityActor');
      const targetTypeEl = document.getElementById('activityTargetType');
      const targetIdEl = document.getElementById('activityTargetId');
      if (actorEl && actorEl.value) params.actorId = actorEl.value.trim();
      if (targetTypeEl && targetTypeEl.value) params.targetType = targetTypeEl.value.trim();
      if (targetIdEl && targetIdEl.value) params.targetId = targetIdEl.value.trim();

      const res = await api.getActivityLogs(params);
      if (requestId !== this._latestActivityRequest) return; // stale
  const logs = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
  const total = (res && typeof res.total !== 'undefined') ? res.total : (logs.length || 0);
  const curPage = (res && res.page) ? res.page : 1;
  const pages = (res && res.pages) ? res.pages : Math.max(1, Math.ceil(total / this.activityLimit));
  this.renderActivity(logs);
  this.renderActivityPagination(curPage, pages);
    } catch (err) {
      console.error('Failed to load activity logs', err);
      try { notify.error('Failed to load activity logs: ' + (err.message || String(err))); } catch(_) {}
      if (this.activityList) this.activityList.innerHTML = '<div class="activity-item">Failed to load activity logs</div>';
    }
  }

  renderActivity(logs) {
    if (!this.activityList) return;
    if (!logs.length) {
      this.activityList.innerHTML = '<div class="activity-item">No activity found</div>';
      return;
    }
    this.activityList.innerHTML = logs.map(l => this.activityItemHTML(l)).join('');
    // make activity items keyboard-focusable for accessibility
    Array.from(this.activityList.querySelectorAll('.activity-item')).forEach(item => {
      item.setAttribute('tabindex', '0');
    });
  }

  activityItemHTML(l) {
    const when = new Date(l.createdAt).toLocaleString();
    const actor = l.actor?.name || l.actor?.username || 'System';
    const user = l.user?.name || l.user?.username || (l.user?._id || '—');
    const meta = JSON.stringify(l.metadata || {});
    const shortMeta = utils.truncate(meta, 140);
    return `<div class="activity-item" role="article" aria-label="Activity ${escapeHtml(l.action)}">
      <div class="activity-main"><strong>${escapeHtml(l.action)}</strong> — ${escapeHtml(shortMeta)}</div>
      <div class="activity-meta">by ${escapeHtml(actor)} on ${when} (target: ${escapeHtml(user)})</div>
    </div>`;
  }

  renderActivityPagination(page, pages) {
    if (!this.activityPagination) return;
    this.activityPagination.innerHTML = '';
    if (pages <= 1) return;
    const createBtn = (label, disabled, onClick) => {
      const b = document.createElement('button'); b.className = 'page-btn'; if (disabled) b.disabled = true; b.textContent = label; if (onClick) b.addEventListener('click', onClick); return b;
    };
    this.activityPagination.appendChild(createBtn('Prev', page <= 1, () => { this.activityPage = Math.max(1, page-1); this.loadActivity(); }));
    for (let p = 1; p <= pages; p++) {
      const btn = createBtn(String(p), false, () => { this.activityPage = p; this.loadActivity(); });
      if (p === page) btn.classList.add('active');
      this.activityPagination.appendChild(btn);
    }
    this.activityPagination.appendChild(createBtn('Next', page >= pages, () => { this.activityPage = Math.min(pages, page+1); this.loadActivity(); }));
  }
}

let adminStatsManager;

document.addEventListener('DOMContentLoaded', () => {
  adminStatsManager = new AdminStatsManager();
  adminStatsManager.init();
});

// Expose for tests (no effect in browser)
try { if (typeof module !== 'undefined') module.exports = { AdminStatsManager }; } catch (_) {}
