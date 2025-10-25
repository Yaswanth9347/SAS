// Profile page script

authManager.requireAuth();

async function loadProfile(){
  try{
    loading.show('profileForm','Loading profile...');
    const res = await api.getUserProfile();
    loading.hide('profileForm');
    if(!res || !res.success){
      renderError('profileForm','Failed to load profile');
      return;
    }

  const user = res.data || authManager.getUser();
  const container = document.getElementById('profileForm');

  // Render avatar
  renderAvatar(user.profileImage, user.name);

  // Populate hero header
  try {
    const nameEl = document.getElementById('heroName');
    const roleEl = document.getElementById('heroRole');
    const emailEl = document.getElementById('heroEmail');
    const phoneEl = document.getElementById('heroPhone');
    if(nameEl) nameEl.textContent = user.name || 'User';
    if(roleEl){
      roleEl.textContent = (user.role || 'user').toUpperCase();
      roleEl.classList.remove('admin');
      if((user.role||'').toLowerCase()==='admin') roleEl.classList.add('admin');
    }
    if(emailEl) emailEl.textContent = user.email || '';
    if(phoneEl) phoneEl.textContent = user.phone || '';
  } catch(e){ console.warn('Hero header population failed', e); }

  container.innerHTML = `
      <div class="form-group">
        <label for="p_name">Full Name</label>
        <input id="p_name" type="text" value="${escapeHtml(user.name || '')}">
      </div>
      <div class="form-group">
        <label for="p_email">Email</label>
        <input id="p_email" type="email" value="${escapeHtml(user.email || '')}" disabled>
      </div>
      <div class="form-group">
        <label for="p_phone">Phone</label>
        <input id="p_phone" type="tel" value="${escapeHtml(user.phone || '')}">
      </div>
      <div class="form-group">
        <label for="p_role">Role</label>
        <input id="p_role" type="text" value="${escapeHtml((user.role || 'user').toUpperCase())}" disabled>
      </div>
    `;

    document.getElementById('saveProfileBtn').onclick = saveProfile;
    // Avatar handlers
    const avatarInput = document.getElementById('avatarInput');
    const changeBtn = document.getElementById('changeAvatarBtn');
    const removeBtn = document.getElementById('removeAvatarBtn');
    const avatarWrapper = document.getElementById('profileAvatarWrapper');

    changeBtn.addEventListener('click', ()=> avatarInput.click());
    // Clicking the avatar now opens a viewer (not the file picker)
    avatarWrapper.addEventListener('click', ()=> {
      const imgEl = avatarWrapper.querySelector('img');
      const src = imgEl ? imgEl.src : null;
      if(!src){ return; }
      openAvatarLightbox(src);
    });
    avatarInput.addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      // simple client-side validation
      if(!file.type.startsWith('image/')){ notify.error('Please select an image file'); return; }
      if(file.size > (5 * 1024 * 1024)){ notify.error('Image must be smaller than 5MB'); return; }

      // Preview locally
      const reader = new FileReader();
      reader.onload = (ev)=>{
        avatarWrapper.innerHTML = `<img src="${ev.target.result}" alt="avatar">`;
      };
      reader.readAsDataURL(file);

      // Upload
      try{
        const fd = new FormData();
        fd.append('avatar', file);
        loading.showFullPage('Uploading avatar...');
        const up = await api.uploadProfileAvatar(fd);
        loading.hideFullPage();
        if(up.success){
          notify.success('Avatar uploaded');
          // update local user
          const userLoc = authManager.getUser() || {};
          userLoc.profileImage = up.data.profileImage;
          authManager.setAuth(authManager.getToken(), userLoc);
          renderAvatar(up.data.profileImage, userLoc.name);
          if(typeof navbarManager !== 'undefined') navbarManager.setupNavbar();
        } else {
          notify.error(up.message || 'Upload failed');
        }
      }catch(err){ loading.hideFullPage(); handleAPIError(err); }
    });

    removeBtn.addEventListener('click', async ()=>{
      if(!confirm('Remove profile photo?')) return;
      try{
        loading.showFullPage('Removing avatar...');
        const res = await api.updateUserProfile({ profileImage: null });
        loading.hideFullPage();
        if(res.success){
          notify.success('Avatar removed');
          const userLoc = authManager.getUser() || {};
          userLoc.profileImage = null;
          authManager.setAuth(authManager.getToken(), userLoc);
          renderAvatar(null, userLoc.name);
          if(typeof navbarManager !== 'undefined') navbarManager.setupNavbar();
        } else notify.error(res.message || 'Failed to remove avatar');
      }catch(err){ loading.hideFullPage(); handleAPIError(err); }
    });

    // Setup tabs
    setupTabs();
  }catch(err){
    loading.hide('profileForm');
    renderError('profileForm','Failed to load profile');
    console.error(err);
  }
}

function renderAvatar(url, name){
  const wrapper = document.getElementById('profileAvatarWrapper');
  if(!wrapper) return;
  wrapper.innerHTML = '';
  if(url){
    const img = document.createElement('img'); img.src = url; img.alt = 'Avatar'; wrapper.appendChild(img);
  } else {
    // show initials
    const initials = (name || authManager.getUser()?.name || '').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase() || 'U';
    wrapper.textContent = initials;
  }
}

// Simple lightbox for viewing avatar in large size
function openAvatarLightbox(src){
  // Prevent duplicates
  let overlay = document.getElementById('avatarLightbox');
  if(overlay){
    const img = overlay.querySelector('img');
    if(img) img.src = src;
  } else {
    overlay = document.createElement('div');
    overlay.id = 'avatarLightbox';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 11000;
      display: flex; align-items: center; justify-content: center; padding: 24px; cursor: zoom-out;
    `;
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Profile photo';
    img.style.cssText = `
      max-width: 90vw; max-height: 85vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      background: #111;
    `;
    overlay.appendChild(img);

    // Close on click or ESC
    overlay.addEventListener('click', ()=> close());
    document.addEventListener('keydown', escHandler);

    function escHandler(e){ if(e.key==='Escape'){ close(); } }
    function close(){
      document.removeEventListener('keydown', escHandler);
      if(overlay && overlay.parentNode){ overlay.parentNode.removeChild(overlay); }
    }
  }
  document.body.appendChild(overlay);
}

async function saveProfile(){
  const name = document.getElementById('p_name').value.trim();
  const phone = document.getElementById('p_phone').value.trim();

  if(!name){ notify.error('Please enter your name'); return; }
  if(phone && !utils.isValidPhone(phone)){ notify.error('Please enter a valid phone number'); return; }

  try{
    loading.showFullPage('Updating profile...');
    const result = await api.updateUserProfile({ name, phone });
    loading.hideFullPage();
    if(result.success){
      notify.success('Profile updated successfully');
      // update local storage copy
      const user = authManager.getUser() || {};
      user.name = name; user.phone = phone;
      authManager.setAuth(authManager.getToken(), user);
      // refresh nav
      if(typeof navbarManager !== 'undefined') navbarManager.setupNavbar();
    } else {
      notify.error(result.message || 'Failed to update profile');
    }
  }catch(err){ loading.hideFullPage(); handleAPIError(err); }
}

// Change password handler
async function changePassword(){
  const cur = document.getElementById('cur_pwd').value;
  const nw = document.getElementById('new_pwd').value;
  const c = document.getElementById('confirm_pwd').value;
  if(!cur || !nw){ notify.error('Please provide current and new password'); return; }
  if(nw !== c){ notify.error('New password and confirmation do not match'); return; }

  try{
    loading.showFullPage('Changing password...');
    const res = await api.changePassword({ currentPassword: cur, newPassword: nw });
    loading.hideFullPage();
    if(res.success){ notify.success('Password changed successfully'); document.getElementById('cur_pwd').value=''; document.getElementById('new_pwd').value=''; document.getElementById('confirm_pwd').value=''; }
    else notify.error(res.message || 'Failed to change password');
  }catch(err){ loading.hideFullPage(); handleAPIError(err); }
}

document.getElementById('changePwdBtn').addEventListener('click', changePassword);

// Initialize
document.addEventListener('DOMContentLoaded', loadProfile);

// Tabs setup
function setupTabs(){
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  if(!buttons.length || !panels.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      // toggle buttons
      buttons.forEach(b => b.classList.toggle('active', b===btn));
      // toggle panels
      panels.forEach(p => {
        const isActive = p.id === `tab-${tab}`;
        p.classList.toggle('active', isActive);
      });
    });
  });
}
