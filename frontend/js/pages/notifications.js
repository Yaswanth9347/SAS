(function(){
  'use strict';

  class NotificationsPage {
    constructor() {
      this.container = null;
      this.pagination = null;
      this.filter = null;
      this.page = 1;
      this.limit = 10;
    }

    init() {
      if (!authManager.requireAuth()) return;
      navbarManager.setActivePage('notifications.html');

      this.container = document.getElementById('notifListContainer');
      this.pagination = document.getElementById('pagination');
      this.filter = document.getElementById('filterStatus');

      this.filter.addEventListener('change', () => { this.page = 1; this.load(); });
      document.getElementById('markAllRead').addEventListener('click', async () => {
        try { await api.markAllNotificationsRead(); this.load(); } catch (e) { handleAPIError(e); }
      });

      this.load();
    }

    async load() {
      try {
        const status = this.filter.value === 'all' ? undefined : this.filter.value;
        const res = await api.getNotifications({ status, page: this.page, limit: this.limit });
        const items = res?.data || [];
        if (!items.length) {
          this.container.innerHTML = '<div style="padding:18px;color:#666;text-align:center">No notifications</div>';
          this.pagination.innerHTML = '';
          return;
        }
        this.container.innerHTML = items.map(n => `
          <div class="notif-item ${n.read?'read':''}">
            <div style="font-size:20px">${n.type==='visit'?'📅':(n.type==='team'?'👥':'🔔')}</div>
            <div style="flex:1">
              <div style="font-weight:600">${escapeHtml(n.title)}</div>
              <div>${escapeHtml(n.message)}</div>
              <div class="notif-meta">${new Date(n.createdAt).toLocaleString()}</div>
            </div>
            <div class="notif-actions">
              ${n.link?`<a href="${n.link}" class="btn btn-secondary" style="padding:6px 10px">Open</a>`:''}
              <button class="btn" data-id="${n._id}" data-action="${n.read?'unread':'read'}" style="padding:6px 10px">Mark ${n.read?'unread':'read'}</button>
            </div>
          </div>
        `).join('');

        this.container.querySelectorAll('button[data-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const action = btn.getAttribute('data-action');
            try {
              if (action==='read') await api.markNotificationRead(id); else await api.markNotificationUnread(id);
              this.load();
            } catch (e) { handleAPIError(e); }
          });
        });

        // Pagination controls
        const total = res.pagination?.total || items.length;
        const totalPages = Math.max(1, Math.ceil(total / this.limit));
        this.pagination.innerHTML = this.renderPagination(totalPages);
        this.bindPagination(totalPages);
      } catch (e) {
        console.error(e);
        this.container.innerHTML = '<div style="padding:18px;color:#c62828;text-align:center">Failed to load notifications</div>';
      }
    }

    renderPagination(totalPages) {
      let html = '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">';
      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="btn ${i===this.page?'btn-primary':''}" data-page="${i}" style="padding:6px 10px">${i}</button>`;
      }
      html += '</div>';
      return html;
    }

    bindPagination(totalPages) {
      this.pagination.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.page = Number(btn.getAttribute('data-page'));
          this.load();
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new NotificationsPage().init());
  } else { new NotificationsPage().init(); }
})();
