/**
 * Reset Password Page
 * Handles password reset with validation and strength checking
 */

// Check if already logged in
const token = localStorage.getItem('token');
if (token) {
  window.location.href = 'dashboard.html';
}

// Get reset token from URL
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('token');

if (!resetToken) {
  showExpiredToken('Invalid or missing reset token');
}

const form = document.getElementById('resetPasswordForm');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const submitBtn = document.getElementById('submitBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const strengthBar = document.getElementById('strengthBar');
const strengthText = document.getElementById('strengthText');

/**
 * Toggle password visibility
 */
function setupPasswordToggles() {
  document.getElementById('togglePassword').addEventListener('click', function() {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
  });

  document.getElementById('toggleConfirmPassword').addEventListener('click', function() {
    const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
    confirmPasswordInput.type = type;
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
  });
}

/**
 * Hide all messages
 */
function hideMessages() {
  successMessage.classList.remove('show');
  errorMessage.classList.remove('show');
}

/**
 * Show error message
 */
function showError(message) {
  hideMessages();
  errorText.textContent = message;
  errorMessage.classList.add('show');
}

/**
 * Show expired token screen
 */
function showExpiredToken(message) {
  document.getElementById('mainContainer').innerHTML = `
    <div class="expired-token">
      <i class="fas fa-exclamation-triangle"></i>
      <h2>Link Expired or Invalid</h2>
      <p>${message || 'This password reset link has expired or is invalid.'}</p>
      <a href="forgot-password.html" class="btn-secondary">
        <i class="fas fa-redo"></i> Request New Link
      </a>
    </div>
    <div class="back-to-login">
      <a href="login.html">
        <i class="fas fa-arrow-left"></i>
        <span>Back to Login</span>
      </a>
    </div>
  `;
}

/**
 * Check password strength
 */
function checkPasswordStrength(password) {
  let strength = 0;
  
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;

  return strength;
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength() {
  const password = passwordInput.value;
  const strength = checkPasswordStrength(password);

  strengthBar.className = 'password-strength-bar';
  
  if (password.length === 0) {
    strengthBar.style.width = '0';
    strengthText.textContent = '';
  } else if (strength <= 2) {
    strengthBar.classList.add('weak');
    strengthText.textContent = 'Weak password';
    strengthText.style.color = '#f44336';
  } else if (strength <= 3) {
    strengthBar.classList.add('medium');
    strengthText.textContent = 'Medium password';
    strengthText.style.color = '#ff9800';
  } else {
    strengthBar.classList.add('strong');
    strengthText.textContent = 'Strong password';
    strengthText.style.color = '#4caf50';
  }
}

/**
 * Check password requirements
 */
function checkRequirements() {
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Length requirement
  const reqLength = document.getElementById('req-length');
  if (password.length >= 6) {
    reqLength.classList.add('met');
    reqLength.querySelector('i').className = 'fas fa-check-circle';
  } else {
    reqLength.classList.remove('met');
    reqLength.querySelector('i').className = 'fas fa-circle';
  }

  // Letter requirement
  const reqLetter = document.getElementById('req-letter');
  if (/[a-zA-Z]/.test(password)) {
    reqLetter.classList.add('met');
    reqLetter.querySelector('i').className = 'fas fa-check-circle';
  } else {
    reqLetter.classList.remove('met');
    reqLetter.querySelector('i').className = 'fas fa-circle';
  }

  // Number requirement
  const reqNumber = document.getElementById('req-number');
  if (/\d/.test(password)) {
    reqNumber.classList.add('met');
    reqNumber.querySelector('i').className = 'fas fa-check-circle';
  } else {
    reqNumber.classList.remove('met');
    reqNumber.querySelector('i').className = 'fas fa-circle';
  }

  // Enable/disable submit button
  const allMet = password.length >= 6 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  
  submitBtn.disabled = !(allMet && passwordsMatch);
}

/**
 * Setup input event listeners
 */
function setupInputListeners() {
  // Password input event
  passwordInput.addEventListener('input', () => {
    updatePasswordStrength();
    checkRequirements();
    hideMessages();
  });

  // Confirm password input event
  confirmPasswordInput.addEventListener('input', () => {
    checkRequirements();
    hideMessages();
  });
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }

  try {
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
    hideMessages();

    const response = await api.resetPassword(resetToken, password);

    if (response.success) {
      successMessage.classList.add('show');
      form.style.display = 'none';
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-check"></i> Reset Password';
      
      if (response.message && response.message.includes('expired')) {
        showExpiredToken(response.message);
      } else {
        showError(response.message || 'Failed to reset password. Please try again.');
      }
    }
  } catch (error) {
    console.error('Reset password error:', error);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Reset Password';
    
    if (error.response && error.response.data) {
      if (error.response.data.message && error.response.data.message.includes('expired')) {
        showExpiredToken(error.response.data.message);
      } else {
        showError(error.response.data.message || 'An error occurred. Please try again.');
      }
    } else {
      showError('An error occurred. Please try again later.');
    }
  }
}

/**
 * Initialize page
 */
function init() {
  setupPasswordToggles();
  setupInputListeners();
  form.addEventListener('submit', handleSubmit);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
