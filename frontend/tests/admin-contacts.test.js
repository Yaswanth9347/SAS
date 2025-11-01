/** @jest-environment jsdom */

// Admin Contacts tests validate rendering, selection, and basic actions

function buildDOM() {
  document.body.innerHTML = `
  <div>
    <div id="statsDashboard"></div>
    <div id="contactsTableContainer"></div>
    <div id="paginationContainer"></div>

    <input id="searchInput" />
    <button id="applyFilters"></button>
    <button id="clearFilters"></button>
    <select id="statusFilter"><option value="">All</option><option value="new">New</option></select>

    <div id="viewContactModal" class="modal"></div>
    <div id="replyModal" class="modal"></div>
    <div id="contactDetailsBody"></div>
    <div id="replyToInfo"></div>
    <textarea id="replyMessage"></textarea>
    <div id="replyCharCounter"></div>
    <button id="sendReply"></button>
    <button id="openReplyFromView"></button>

    <button id="bulkArchive" disabled></button>
    <button id="bulkDelete" disabled></button>
  </div>`;
}

beforeEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
  // Minimal loading and notify shims
  global.loading = {
    show: jest.fn(),
    hide: jest.fn(),
    showFullPage: jest.fn(),
    hideFullPage: jest.fn(),
  };
  global.notify = global.notify || { success: jest.fn(), error: jest.fn(), info: jest.fn(), confirm: (msg, cb) => cb && cb(), loading: () => ({ remove() {} }) };
  global.showNotification = jest.fn();
  buildDOM();
});

function fireDOMContentLoaded() {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

async function initContacts() {
  require('../js/admin-contacts.js');
  fireDOMContentLoaded();
  // wait until the global instance is created and initial async work finishes
  let tries = 0;
  while (!global.adminContacts && tries < 10) {
    await Promise.resolve();
    tries++;
  }
  // allow pending promises/microtasks to flush
  await new Promise((r) => setTimeout(r, 0));
}

async function waitForSelector(sel, timeout = 500) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const el = document.querySelector(sel);
    if (el) return el;
    if (Date.now() - start > timeout) return null;
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('AdminContacts - rendering and empty state', () => {
  test('renders empty state when no contacts', async () => {
    // mock API to return no contacts
    global.api.getContactStats.mockResolvedValueOnce({ success: true, data: { total: 0, byStatus: {} } });
    global.api.getContacts.mockResolvedValueOnce({ success: true, data: [], currentPage: 1, totalPages: 1 });

  await initContacts();
    const container = document.getElementById('contactsTableContainer');
    expect(container.textContent).toMatch(/No Contacts Found/i);
  });
});

describe('AdminContacts - selection and bulk actions', () => {
  test('selecting rows enables bulk buttons and bulk archive calls API', async () => {
    const contacts = [
      { _id: 'c1', name: 'A', email: 'a@example.com', subject: 'S', message: 'M', status: 'new', createdAt: Date.now() },
      { _id: 'c2', name: 'B', email: 'b@example.com', subject: 'S2', message: 'M2', status: 'read', createdAt: Date.now() }
    ];
    global.api.getContactStats.mockResolvedValueOnce({ success: true, data: { total: 2, byStatus: { new: 1, read: 1 } } });
    global.api.getContacts.mockResolvedValueOnce({ success: true, data: contacts, currentPage: 1, totalPages: 1 });

  await initContacts();

  const tableContainer = document.getElementById('contactsTableContainer');
  // Force render with known data to ensure deterministic test
  global.adminContacts.contacts = contacts;
  global.adminContacts.renderContactsTable();
  await Promise.resolve();
  const cbs = tableContainer.querySelectorAll('input[type="checkbox"][data-id]');
    expect(cbs.length).toBe(2);

    // select first row
    cbs[0].click();
    const bulkArchiveBtn = document.getElementById('bulkArchive');
    const bulkDeleteBtn = document.getElementById('bulkDelete');
    expect(bulkArchiveBtn.disabled).toBe(false);
    expect(bulkDeleteBtn.disabled).toBe(false);

    // run bulk archive
    const spy = jest.spyOn(global.api, 'bulkUpdateContacts').mockResolvedValueOnce({ success: true });
    bulkArchiveBtn.click(); // confirm will auto-accept in notify shim
    // let async handler run
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });
});

describe('AdminContacts - view and mark as read', () => {
  test('viewing a new contact marks it as read', async () => {
    const contact = { _id: 'c9', name: 'New', email: 'n@example.com', subject: 'Hi', message: 'Hello', status: 'new', createdAt: Date.now() };
    global.api.getContactStats.mockResolvedValueOnce({ success: true, data: { total: 1, byStatus: { new: 1 } } });
    global.api.getContacts.mockResolvedValueOnce({ success: true, data: [contact], currentPage: 1, totalPages: 1 });
    global.api.getContact.mockResolvedValueOnce({ success: true, data: contact });
    const markSpy = jest.spyOn(global.api, 'markContactAsRead').mockResolvedValueOnce({ success: true });

  await initContacts();

    // simulate clicking View by calling global handler
  await global.adminContacts.viewContact('c9');
    expect(markSpy).toHaveBeenCalledWith('c9');
  });
});

describe('AdminContacts - reply validation', () => {
  test('reply requires minimum length and shows error', async () => {
    const contact = { _id: 'cx', name: 'X', email: 'x@example.com', subject: 'S', message: 'M', status: 'read', createdAt: Date.now() };
    global.api.getContactStats.mockResolvedValueOnce({ success: true, data: { total: 1, byStatus: { read: 1 } } });
    global.api.getContacts.mockResolvedValueOnce({ success: true, data: [contact], currentPage: 1, totalPages: 1 });

    require('../js/admin-contacts.js');
    fireDOMContentLoaded();
    await Promise.resolve();

  // open reply modal with too-short message and call sendReply directly
  global.adminContacts.openReplyModal('cx');
  document.getElementById('replyMessage').value = 'short';
  await global.adminContacts.sendReply();

    expect(global.showNotification).toHaveBeenCalled();
  });
});
