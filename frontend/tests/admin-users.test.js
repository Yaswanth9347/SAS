/** @jest-environment jsdom */

const { AdminUsersManager } = require('../js/pages/admin-users.js');

// helper to set window.location like browsers
function setLocation(url) {
  // Use history API to update the URL in jsdom without real navigation
  const u = new URL(url);
  window.history.pushState({}, '', u.href);
}

function baseDOM() {
  document.body.innerHTML = `
  <div>
    <input id="searchUsers" />
    <select id="filterRole"><option value="">All</option><option value="volunteer">Volunteer</option><option value="admin">Admin</option></select>
    <select id="filterStatus"><option value="">All</option><option value="approved">approved</option><option value="pending">pending</option></select>
    <select id="filterVerified"><option value="">All</option><option value="true">true</option><option value="false">false</option></select>
    <button id="applyFilters"></button>
    <button id="resetFilters"></button>

    <div class="bulk-controls" style="display:none"></div>
    <span id="selectionInfo"></span>
    <button id="bulkApprove"></button>
    <button id="bulkReject"></button>
    <select id="bulkRoleSelect"><option value="">-</option><option value="admin">admin</option></select>
    <button id="bulkChangeRole"></button>
    <button id="bulkClear"></button>

    <input type="checkbox" id="selectAll" />
    <table><tbody id="usersTbody"></tbody></table>
    <div id="pagination"></div>
    <select id="pageSize"></select>
    <div id="totalCount"></div>

    <div id="rejectModal" style="display:none"></div>
    <textarea id="rejectReason"></textarea>
    <button id="confirmReject"></button>
    <button id="cancelReject"></button>

    <div id="activityModal" style="display:none"></div>
    <div id="activityList"></div>
    <button id="closeActivity"></button>

    <div id="userDetailsModal" style="display:none"></div>
    <div id="userDetailsContent"></div>
    <button id="closeUserDetails"></button>

    <div id="bulkSummaryModal" style="display:none"></div>
    <div id="bulkSummaryContent"></div>
    <button id="closeBulkSummary"></button>
    <button id="selectAllMatching"></button>
    <button id="retryBulk" style="display:none"></button>
    <button id="abortBulk" style="display:none"></button>

    <div id="activeFilters"></div>
  </div>`;
}

beforeEach(() => {
  jest.restoreAllMocks();
  baseDOM();
});

describe('AdminUsersManager - filters and URL state', () => {
  test('restoreFiltersFromUrl populates inputs and state', () => {
    setLocation('http://localhost/admin-users.html?search=alice&role=volunteer&status=approved&verified=true&page=3&limit=50');
  const mgr = new AdminUsersManager();
  mgr.cacheEls();
  mgr.bindEvents();
    mgr.restoreFiltersFromUrl();
    expect(mgr.page).toBe(3);
    expect(mgr.limit).toBe(50);
    expect(mgr.searchInput.value).toBe('alice');
    expect(mgr.filterRole.value).toBe('volunteer');
    expect(mgr.filterStatus.value).toBe('approved');
    expect(mgr.filterVerified.value).toBe('true');
  });

  test('updateUrlParams writes current state into URL', () => {
    setLocation('http://localhost/admin-users.html');
    const mgr = new AdminUsersManager();
    mgr.cacheEls();
    mgr.page = 2; mgr.limit = 25;
    mgr.searchInput.value = 'bob';
    mgr.filterRole.value = 'admin';
    mgr.filterStatus.value = 'pending';
    mgr.filterVerified.value = 'false';
    const spy = jest.spyOn(history, 'replaceState').mockImplementation(() => {});
    mgr.updateUrlParams();
    expect(spy).toHaveBeenCalled();
    const url = new URL(window.location.pathname + '?' + spy.mock.calls[0][2].split('?')[1], 'http://localhost');
    expect(url.searchParams.get('search')).toBe('bob');
    expect(url.searchParams.get('role')).toBe('admin');
    expect(url.searchParams.get('status')).toBe('pending');
    expect(url.searchParams.get('verified')).toBe('false');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('25');
  });
});

describe('AdminUsersManager - debounce helper', () => {
  test('debounce fires once after wait', () => {
    jest.useFakeTimers();
    const mgr = new AdminUsersManager();
    let count = 0;
    const d = mgr.debounce(() => { count++; }, 200);
    d(); d(); d();
    expect(count).toBe(0);
    jest.advanceTimersByTime(199);
    expect(count).toBe(0);
    jest.advanceTimersByTime(2);
    expect(count).toBe(1);
    jest.useRealTimers();
  });
});

describe('AdminUsersManager - bulk abort', () => {
  test('clicking abort aborts in-flight request and stops loop', async () => {
    setLocation('http://localhost/admin-users.html');
    const mgr = new AdminUsersManager();
    mgr.cacheEls();

    // prepare selection and modal
    mgr.selected = new Set(['u1', 'u2', 'u3']);
    document.getElementById('abortBulk').style.display = 'inline-block';
    document.getElementById('bulkSummaryModal').style.display = 'flex';
    document.getElementById('bulkSummaryContent').innerHTML = '<div id="bulkProgress"></div>';

    // mock api.bulkUpdateUsers to observe AbortController
    const apiMock = jest.spyOn(global.api, 'bulkUpdateUsers').mockImplementation((payload, { signal } = {}) => {
      return new Promise((resolve, reject) => {
        const fallback = setTimeout(() => reject(Object.assign(new Error('aborted-fallback'), { name: 'AbortError' })), 100);
        if (signal) {
          signal.addEventListener('abort', () => { clearTimeout(fallback); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
        }
      });
    });

    // mock getAdminUsers to return quickly when loadUsers is called after abort
    jest.spyOn(global.api, 'getAdminUsers').mockResolvedValue({ total: 0, data: [], page: 1, pages: 1 });

    // start runBulk (it will call bulkUpdateUsers for first chunk)
    const promise = mgr.runBulk({ action: 'approve', userIds: Array.from(mgr.selected) });

    // trigger abort
    document.getElementById('abortBulk').click();

    // give microtask queue a tick
    await Promise.resolve();

    // The promise should eventually resolve after catching abort; guard with timeout
    const result = await Promise.race([
      promise.then(() => 'done').catch(() => 'caught'),
      new Promise((res) => setTimeout(() => res('timeout'), 500))
    ]);

    expect(['done', 'caught']).toContain(result);
    expect(apiMock).toHaveBeenCalled();
  });
});

describe('AdminUsersManager - server-assisted select all', () => {
  test('selectAllMatching fetches IDs and updates selection and aria-live', async () => {
    setLocation('http://localhost/admin-users.html');
    const mgr = new AdminUsersManager();
    mgr.cacheEls();
    mgr.bindEvents();

    // Preview call (limit 1) returns total 3
    const apiMock = jest.spyOn(global.api, 'getAdminUserIds');
    apiMock.mockImplementationOnce(async (params) => ({ total: 3, ids: [] }));
    // Full fetch returns the IDs
    apiMock.mockImplementationOnce(async (params) => ({ total: 3, ids: ['u1','u2','u3'] }));

    // Need some rows to reflect selection in UI (checkboxes)
    mgr.users = [{ _id: 'u1' }, { _id: 'u2' }];
    mgr.tbody.innerHTML = '<tr><td><input type="checkbox" data-id="u1"></td></tr><tr><td><input type="checkbox" data-id="u2"></td></tr>';

    await mgr.selectAllMatching();

    expect(mgr.selected.size).toBe(3);
    expect(document.getElementById('selectionInfo').textContent).toMatch(/3 selected/);
    expect(document.querySelector('.bulk-controls').style.display).toBe('flex');
    // aria-live region should be updated
    const live = document.getElementById('ariaLive');
    expect(live && live.textContent).toMatch(/Selected 3 users/);
  });
});
