// Check if already logged in
const token = localStorage.getItem('token');
if (token) {
  window.location.href = 'dashboard.html';
}

const form = document.getElementById('forgotPasswordForm');
const emailInput = document.getElementById('email');
const submitBtn = document.getElementById('submitBtn');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const successText = document.getElementById('successText');
const errorText = document.getElementById('errorText');

// Hide messages
function hideMessages() {
  successMessage.classList.remove('show');
  errorMessage.classList.remove('show');
}

// Show success message
function showSuccess(message) {
  hideMessages();
  successText.textContent = message;
  successMessage.classList.add('show');
}

// Show error message
function showError(message) {
  hideMessages();
  errorText.textContent = message;
  errorMessage.classList.add('show');
}

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  
  if (!email) {
    showError('Please enter your email address');
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address');
    return;
  }

  try {
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    hideMessages();

    const response = await api.forgotPassword(email);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';

    if (response.success) {
      showSuccess('Check your email! We\'ve sent you a password reset link. It will expire in 1 hour.');
      form.reset();
      
      // Optionally redirect after a delay
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000);
    } else {
      showError(response.message || 'Failed to send reset email. Please try again.');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
    
    if (error.response && error.response.data && error.response.data.message) {
      showError(error.response.data.message);
    } else {
      showError('An error occurred. Please try again later.');
    }
  }
});

// Clear messages on input
emailInput.addEventListener('input', hideMessages);
