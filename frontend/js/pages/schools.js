// Page-specific JavaScript for Schools page

// Require authentication
authManager.requireAuth();

// Admin check and gated initialization
const isAdmin = authManager.isAdmin();
if (!isAdmin) {
  notify.error('Access Denied: Only administrators can access the Schools page.');
  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 2000);
} else {
  initializeSchoolsPage();
}

function initializeSchoolsPage() {
  // Open modal for add/edit school
  function openSchoolModal(school = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal">
      <h2>${school ? 'Edit School' : 'Add School'}</h2>
      <label>School Name</label><input id="s_name" type="text" value="${school ? escapeHtml(school.name) : ''}">
      <label>Headmaster Name</label><input id="s_head" type="text" value="${school && school.contactPerson ? escapeHtml(school.contactPerson.name) : ''}">
      <label>Contact Number 1</label><input id="s_phone1" type="tel" maxlength="10" value="${school && school.contactPerson ? escapeHtml(school.contactPerson.phone || '') : ''}">
      <label>Contact Number 2</label><input id="s_phone2" type="tel" maxlength="10" value="${school && school.contactPerson ? escapeHtml(school.contactPerson.phone2 || '') : ''}">
      <label>Address (street, city, state, pincode)</label><input id="s_address" type="text" value="${school && school.address ? escapeHtml([school.address.street, school.address.city, school.address.state, school.address.pincode].filter(Boolean).join(', ')) : ''}">
      <label>Total Classes</label><input id="s_total" type="number" min="1" value="${school ? school.totalClasses : ''}">
      <label>Available Classes</label><input id="s_available" type="number" min="0" value="${school ? school.availableClasses : ''}">
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-save">Save</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    // Show modal (CSS requires .open)
    requestAnimationFrame(() => overlay.classList.add('open'));

    // Cancel handler with graceful close
    overlay.querySelector('.btn-cancel').onclick = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    // Save handler
    overlay.querySelector('.btn-save').onclick = async () => {
      const schoolName = document.getElementById('s_name').value.trim();
      const headName = document.getElementById('s_head').value.trim();
      const rawPhone1 = document.getElementById('s_phone1').value.trim();
      const rawPhone2 = document.getElementById('s_phone2').value.trim();
      const addressInput = document.getElementById('s_address').value.trim();
      const totalClasses = parseInt(document.getElementById('s_total').value, 10) || 0;
      const availableClasses = parseInt(document.getElementById('s_available').value, 10) || 0;

      const cleanPhone1 = rawPhone1.replace(/\D/g, '');
      const cleanPhone2 = rawPhone2.replace(/\D/g, '');

      const validationErrors = [];
      if (!schoolName) validationErrors.push('School name is required');
      else if (schoolName.length < 3) validationErrors.push('School name must be at least 3 characters');

      if (!headName) validationErrors.push('Contact person name is required');
      else if (headName.length < 2) validationErrors.push('Contact person name must be at least 2 characters');

      if (!cleanPhone1) validationErrors.push('Contact Number 1 is required');
      else if (cleanPhone1.length !== 10) validationErrors.push('Contact Number 1 must be exactly 10 digits');

      if (cleanPhone2 && cleanPhone2.length !== 10) validationErrors.push('Contact Number 2 must be exactly 10 digits (or leave empty)');

      if (!addressInput) validationErrors.push('Address is required');
      else if (addressInput.length < 10) validationErrors.push('Please provide a complete address (street, city, state, pincode)');

      if (totalClasses < 1) validationErrors.push('Total classes must be at least 1');
      if (availableClasses < 0) validationErrors.push('Available classes cannot be negative');
      if (availableClasses > totalClasses) validationErrors.push('Available classes cannot exceed total classes');

      if (validationErrors.length > 0) {
        notify.error(validationErrors.join('<br>'));
        return;
      }

      const payload = {
        name: schoolName,
        address: parseAddress(addressInput),
        contactPerson: {
          name: headName,
          phone: cleanPhone1,
          phone2: cleanPhone2 || ''
        },
        totalClasses: totalClasses,
        availableClasses: availableClasses
      };

      try {
        loading.showFullPage('Saving school...');
        let data;
        if (school && school._id) {
          data = await api.updateSchool(school._id, payload);
        } else {
          data = await api.createSchool(payload);
        }
        loading.hideFullPage();

        if (data.success) {
          overlay.classList.remove('open');
          setTimeout(() => overlay.remove(), 200);
          notify.success(school ? 'School updated successfully!' : 'School added successfully!');
          loadSchools();
        } else {
          notify.error(data.message || 'Unable to save school');
        }
      } catch (err) {
        loading.hideFullPage();
        handleAPIError(err);
      }
    };
  }

  function parseAddress(input) {
    const parts = input.split(',').map(p => p.trim());
    return { street: parts[0] || '', city: parts[1] || '', state: parts[2] || '', pincode: parts[3] || '' };
  }

  async function loadSchools() {
    try {
      loading.show('schoolsList', 'Loading schools...');
      const data = await api.getSchools();
      loading.hide('schoolsList');

      const list = document.getElementById('schoolsList');
      list.innerHTML = '';
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const editIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
        const deleteIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1z"/></svg>';
        const personIcon = '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.7 0 4.88-2.18 4.88-4.88S14.7 2.24 12 2.24 7.12 4.42 7.12 7.12 9.3 12 12 12zm0 2.44c-3.26 0-9.76 1.64-9.76 4.88V22h19.52v-2.68c0-3.24-6.5-4.88-9.76-4.88z"/></svg></span>';
        const locationIcon = '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg></span>';
        data.data.forEach(s => {
          const row = document.createElement('div');
          row.className = 'school-row';
          row.innerHTML = `
            <div class="school-info">
              <div class="school-name">${escapeHtml(s.name)}</div>
              <div class="meta-row headmaster-name">${personIcon}<span>${escapeHtml(s.contactPerson?.name || 'N/A')}</span></div>
              <div class="meta-row school-address">${locationIcon}<span>${escapeHtml([s.address?.street, s.address?.city].filter(Boolean).join(', '))}</span></div>
              <div class="school-meta">
                <span class="badge" title="Total Classes">Total: ${Number(s.totalClasses ?? 0)}</span>
                <span class="badge ${Number(s.availableClasses ?? 0) === 0 ? 'warn' : ''}" title="Available Classes">Avail: ${Number(s.availableClasses ?? 0)}</span>
              </div>
            </div>
            <div class="school-actions">
              <button class="icon-btn btn-edit" title="Edit" aria-label="Edit school" data-school-id="${s._id}">${editIcon}</button>
              <button class="icon-btn btn-delete" title="Delete" aria-label="Delete school" data-school-id="${s._id}">${deleteIcon}</button>
            </div>`;
          document.getElementById('schoolsList').appendChild(row);

          const editBtn = row.querySelector('.btn-edit');
          editBtn.addEventListener('click', function() {
            openSchoolModal(s);
          });

          const deleteBtn = row.querySelector('.btn-delete');
          deleteBtn.addEventListener('click', function() {
            deleteSchool(s._id);
          });
        });
      } else {
        renderNoData('schoolsList', 'No schools found. Add your first school!');
      }
    } catch (err) {
      loading.hide('schoolsList');
      console.error('Failed to load schools', err);
      renderError('schoolsList', 'Failed to load schools');
    }
  }

  async function deleteSchool(id) {
    notify.confirm(
      'Are you sure you want to delete this school? This action cannot be undone.',
      async () => {
        try {
          loading.showFullPage('Deleting school...');
          const data = await api.deleteSchool(id);
          loading.hideFullPage();

          if (data.success) {
            notify.success('School deleted successfully!');
            loadSchools();
          } else {
            notify.error(data.message || 'Failed to delete school');
          }
        } catch (err) {
          loading.hideFullPage();
          handleAPIError(err);
        }
      }
    );
  }

  // Setup Add School button click event
  const addSchoolBtn = document.getElementById('addSchoolBtn');
  if (addSchoolBtn) {
    addSchoolBtn.addEventListener('click', function() {
      openSchoolModal();
    });
  }

  // Initialize list
  loadSchools();
}
