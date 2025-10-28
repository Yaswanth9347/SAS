// Profile Management JavaScript
class ProfileManager {
  constructor() {
    this.api = new APIManager();
    this.currentUser = null;
    this.isEditing = false;
    this.init();
  }

  async init() {
    await this.checkAuth();
    await this.loadUserProfile();
    this.initializeEventListeners();
    this.switchTab('profile-tab');
  }

  async checkAuth() {
    try {
      this.currentUser = await this.api.getCurrentUser();
      if (!this.currentUser) {
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/login.html';
    }
  }

  async loadUserProfile() {
    try {
      Loading.show();
      const data = await this.api.getUserProfile();
      
      if (data.success) {
        this.displayProfileInfo(data.user);
        this.populateEditForm(data.user);
        
        // Load stats if available
        if (data.stats) {
          this.displayStats(data.stats);
        } else {
          await this.loadUserStats();
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      showNotification('Failed to load profile data', 'error');
    } finally {
      Loading.hide();
    }
  }

  displayProfileInfo(user) {
    // Update profile header
    document.getElementById('profile-avatar').textContent = 
      user.name.charAt(0).toUpperCase();
    document.getElementById('profile-name').textContent = user.name;
    
    const roleBadge = document.getElementById('profile-role');
    roleBadge.textContent = user.role;
    roleBadge.className = `role-badge ${user.role}`;

    // Update profile info fields
    document.getElementById('info-name').textContent = user.name;
    document.getElementById('info-email').textContent = user.email;
    document.getElementById('info-phone').textContent = user.phone || 'Not provided';
    document.getElementById('info-role').textContent = 
      user.role.charAt(0).toUpperCase() + user.role.slice(1);
    
    // Show department and year only for volunteers
    const deptField = document.getElementById('department-field');
    const yearField = document.getElementById('year-field');
    
    if (user.role === 'volunteer') {
      deptField.style.display = 'flex';
      yearField.style.display = 'flex';
      document.getElementById('info-department').textContent = 
        user.department || 'Not provided';
      document.getElementById('info-year').textContent = 
        user.year || 'Not provided';
    } else {
      deptField.style.display = 'none';
      yearField.style.display = 'none';
    }

    document.getElementById('info-joined').textContent = 
      new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
  }

  populateEditForm(user) {
    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-phone').value = user.phone || '';
    
    // Show department and year fields only for volunteers
    const deptGroup = document.querySelector('#edit-department').closest('.form-group');
    const yearGroup = document.querySelector('#edit-year').closest('.form-group');
    
    if (user.role === 'volunteer') {
      deptGroup.style.display = 'block';
      yearGroup.style.display = 'block';
      document.getElementById('edit-department').value = user.department || '';
      document.getElementById('edit-year').value = user.year || '';
    } else {
      deptGroup.style.display = 'none';
      yearGroup.style.display = 'none';
    }
  }

  async loadUserStats() {
    try {
      const data = await this.api.getUserStats();
      if (data.success) {
        this.displayStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Display default stats
      this.displayStats({
        totalVisits: 0,
        totalHours: 0,
        schoolsVisited: 0,
        completedVisits: 0
      });
    }
  }

  displayStats(stats) {
    document.getElementById('stat-visits').textContent = stats.totalVisits || 0;
    document.getElementById('stat-hours').textContent = stats.totalHours || 0;
    document.getElementById('stat-schools').textContent = stats.schoolsVisited || 0;
    document.getElementById('stat-completed').textContent = stats.completedVisits || 0;
  }

  initializeEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        this.switchTab(tabId);
      });
    });

    // Edit Profile Form
    const editForm = document.getElementById('edit-profile-form');
    editForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));

    // Add input validation listeners
    document.getElementById('edit-name').addEventListener('input', (e) => {
      this.validateField(e.target, (val) => val.length >= 2, 'Name must be at least 2 characters');
    });

    document.getElementById('edit-email').addEventListener('input', (e) => {
      this.validateField(e.target, (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Invalid email format');
    });

    document.getElementById('edit-phone').addEventListener('input', (e) => {
      const cleaned = e.target.value.replace(/\D/g, '');
      e.target.value = cleaned;
      this.validateField(e.target, (val) => val.length === 0 || val.length === 10, 'Phone must be 10 digits');
    });

    // Change Password Form
    const passwordForm = document.getElementById('change-password-form');
    passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));

    // Password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const input = e.target.closest('.password-input-group').querySelector('input');
        const icon = e.target;
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.textContent = '👁️';
        } else {
          input.type = 'password';
          icon.textContent = '👁️‍🗨️';
        }
      });
    });

    // Password strength indicator
    document.getElementById('new-password').addEventListener('input', (e) => {
      this.updatePasswordStrength(e.target.value);
      this.validatePasswordMatch();
    });

    document.getElementById('confirm-password').addEventListener('input', () => {
      this.validatePasswordMatch();
    });
  }

  switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      if (content.id === tabId) {
        content.classList.add('active');
      }
    });
  }

  validateField(input, validationFn, errorMessage) {
    const value = input.value.trim();
    const errorElement = input.nextElementSibling;

    if (value && !validationFn(value)) {
      input.classList.add('invalid');
      input.classList.remove('valid');
      if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.textContent = errorMessage;
        errorElement.style.display = 'block';
      }
      return false;
    } else if (value) {
      input.classList.remove('invalid');
      input.classList.add('valid');
      if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.style.display = 'none';
      }
      return true;
    } else {
      input.classList.remove('invalid', 'valid');
      if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.style.display = 'none';
      }
      return true;
    }
  }

  updatePasswordStrength(password) {
    const strengthIndicator = document.getElementById('password-strength');
    const strengthText = strengthIndicator.querySelector('.strength-text');
    const strengthBar = strengthIndicator.querySelector('.strength-bar-fill');

    if (!password) {
      strengthIndicator.style.display = 'none';
      return;
    }

    strengthIndicator.style.display = 'block';

    let strength = 0;
    let strengthLabel = 'Weak';
    let strengthColor = '#ff4444';

    // Check various criteria
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    // Determine strength level
    if (strength >= 4) {
      strengthLabel = 'Strong';
      strengthColor = '#4CAF50';
    } else if (strength >= 3) {
      strengthLabel = 'Medium';
      strengthColor = '#ff9800';
    }

    strengthText.textContent = strengthLabel;
    strengthBar.style.width = `${(strength / 5) * 100}%`;
    strengthBar.style.backgroundColor = strengthColor;
  }

  validatePasswordMatch() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorElement = document.getElementById('password-match-error');

    if (confirmPassword && newPassword !== confirmPassword) {
      errorElement.textContent = 'Passwords do not match';
      errorElement.style.display = 'block';
      document.getElementById('confirm-password').classList.add('invalid');
      return false;
    } else {
      errorElement.style.display = 'none';
      document.getElementById('confirm-password').classList.remove('invalid');
      if (confirmPassword) {
        document.getElementById('confirm-password').classList.add('valid');
      }
      return true;
    }
  }

  async handleProfileUpdate(e) {
    e.preventDefault();

    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();

    // Validate fields
    let isValid = true;
    isValid &= this.validateField(
      document.getElementById('edit-name'),
      (val) => val.length >= 2,
      'Name must be at least 2 characters'
    );
    isValid &= this.validateField(
      document.getElementById('edit-email'),
      (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Invalid email format'
    );
    if (phone) {
      isValid &= this.validateField(
        document.getElementById('edit-phone'),
        (val) => val.length === 10,
        'Phone must be 10 digits'
      );
    }

    if (!isValid) {
      showNotification('Please fix the errors before submitting', 'error');
      return;
    }

    const profileData = { name, email };
    if (phone) profileData.phone = phone;

    // Add department and year if volunteer
    if (this.currentUser.role === 'volunteer') {
      const department = document.getElementById('edit-department').value.trim();
      const year = document.getElementById('edit-year').value.trim();
      if (department) profileData.department = department;
      if (year) profileData.year = year;
    }

    try {
      Loading.show();
      const data = await this.api.updateUserProfile(profileData);

      if (data.success) {
        showNotification('Profile updated successfully!', 'success');
        await this.loadUserProfile();
        this.switchTab('profile-tab');
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      const message = error.response?.data?.message || 'Failed to update profile';
      showNotification(message, 'error');
    } finally {
      Loading.hide();
    }
  }

  async handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validate
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotification('All password fields are required', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showNotification('New password must be at least 6 characters', 'error');
      return;
    }

    if (!this.validatePasswordMatch()) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    try {
      Loading.show();
      const data = await this.api.changePassword({
        currentPassword,
        newPassword
      });

      if (data.success) {
        showNotification('Password changed successfully!', 'success');
        
        // Clear form
        document.getElementById('change-password-form').reset();
        document.getElementById('password-strength').style.display = 'none';
        document.querySelectorAll('#change-password-form input').forEach(input => {
          input.classList.remove('valid', 'invalid');
        });
      }
    } catch (error) {
      console.error('Password change failed:', error);
      const message = error.response?.data?.message || 'Failed to change password';
      showNotification(message, 'error');
    } finally {
      Loading.hide();
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  new ProfileManager();
});
