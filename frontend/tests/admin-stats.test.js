/** @jest-environment jsdom */

const { AdminStatsManager } = require('../js/pages/admin-stats.js');

describe('AdminStatsManager - stats caching and click-to-filter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="adminStats">
        <div class="stat-card" id="stat-totalVolunteers" data-key="totalVolunteers"><div class="stat-value"></div></div>
        <div class="stat-card" id="stat-activeVolunteers" data-key="activeVolunteers"><div class="stat-value"></div></div>
        <div class="stat-card" id="stat-totalTeams" data-key="totalTeams"><div class="stat-value"></div></div>
        <div class="stat-card" id="stat-volunteersWithoutTeam" data-key="volunteersWithoutTeam"><div class="stat-value"></div></div>
      </div>
      <div id="activityList"></div>
      <div id="activityPagination"></div>
      <input id="activitySearch" />
      <select id="activityAction"></select>
      <input id="activityUser" />
      <button id="applyActivityFilters"></button>
      <button id="resetActivityFilters"></button>
    `;
    jest.restoreAllMocks();
  });

  test('fetchStats caches response for ~60s', async () => {
    const stats = { totalVolunteers: 10, activeVolunteers: 3, totalTeams: 2, volunteersWithoutTeam: 1 };
    const getSpy = jest.spyOn(global.api, 'get').mockResolvedValue({ data: stats });

    const mgr = new AdminStatsManager();
    // First call: should hit API
    await mgr.fetchStats();
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Second call: should use cache and not call API again
    await mgr.fetchStats();
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  test('clicking activeVolunteers navigates to admin-users with filters', () => {
    const mgr = new AdminStatsManager();
    // Enable test navigation capture
    window.__TEST_NAV_CAPTURE__ = true;
    mgr.init();
    const card = document.querySelector('#stat-activeVolunteers');
    card.click();
    expect(window.__LAST_NAV__).toMatch(/admin-users\.html\?/);
    delete window.__TEST_NAV_CAPTURE__;
    delete window.__LAST_NAV__;
  });
});
