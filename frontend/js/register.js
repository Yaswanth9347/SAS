// File: register.js
// Handles modal, validation, and submission for register.html

(() => {
  // Modal elements
  const termsLink = document.getElementById("termsLink");
  const termsModal = document.getElementById("termsModal");
  const termsClose = document.getElementById("termsClose");
  const backdrop = termsModal.querySelector(".terms-modal__backdrop");

  function openModal() {
    termsModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    termsModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  termsLink.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
  termsClose.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Regex rules
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  const phoneRegex = /^\d{10}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Elements
  const form = document.getElementById("registerForm");
  const submitBtn = document.getElementById("submitBtn");
  const card = document.getElementById("card");

  const fields = {
    name: document.getElementById("name"),
    username: document.getElementById("username"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    confirmPassword: document.getElementById("confirmPassword"),
    collegeId: document.getElementById("collegeId"),
    phone: document.getElementById("phone"),
    department: document.getElementById("department"),
    year: document.getElementById("year"),
    skills: document.getElementById("skills"),
  };

  const errs = {
    name: document.getElementById("nameError"),
    username: document.getElementById("usernameError"),
    email: document.getElementById("emailError"),
    password: document.getElementById("passwordError"),
    confirm: document.getElementById("confirmError"),
    college: document.getElementById("collegeError"),
    phone: document.getElementById("phoneError"),
    dept: document.getElementById("deptError"),
    year: document.getElementById("yearError")
  };

  const hintNodes = {
    len: document.getElementById("h_len"),
    lower: document.getElementById("h_lower"),
    upper: document.getElementById("h_upper"),
    digit: document.getElementById("h_digit"),
    special: document.getElementById("h_special"),
  };

  function setValid(el, ok) {
    if (ok) { el.classList.remove("invalid"); el.classList.add("valid"); }
    else { el.classList.remove("valid"); el.classList.add("invalid"); }
  }

  function validateName() {
    const ok = fields.name.value.trim().length >= 2;
    errs.name.style.display = ok ? "none" : "block";
    setValid(fields.name, ok);
    return ok;
  }

  function validateUsername() {
    const v = fields.username.value.trim();
    const ok = v.length >= 3 && !/\s/.test(v);
    errs.username.style.display = ok ? "none" : "block";
    setValid(fields.username, ok);
    return ok;
  }

  // Username availability helpers
  let usernameTimer = null;
  const usernameHint = document.getElementById('usernameHint');
  async function checkUsernameAvailability(name) {
    if (!name || name.length < 3) {
      usernameHint.textContent = '';
      return;
    }
    try {
      usernameHint.textContent = 'Checking...';
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(name)}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        if (json.available) {
          usernameHint.style.color = '#2e7d32';
          usernameHint.textContent = 'Available';
        } else {
          usernameHint.style.color = '#b00020';
          usernameHint.textContent = 'Taken';
        }
      } else {
        usernameHint.style.color = '#777';
        usernameHint.textContent = '';
      }
    } catch (err) {
      usernameHint.style.color = '#777';
      usernameHint.textContent = '';
    }
  }

  function validateEmail() {
    const ok = emailRegex.test(fields.email.value.trim());
    errs.email.style.display = ok ? "none" : "block";
    setValid(fields.email, ok);
    return ok;
  }

  function validatePassword() {
    const val = fields.password.value;
    const ok = passwordRegex.test(val);
    errs.password.style.display = ok ? "none" : "block";

    // Update hint colors
    hintNodes.len.style.color = val.length >= 8 ? "#2e7d32" : "#555";
    hintNodes.lower.style.color = /[a-z]/.test(val) ? "#2e7d32" : "#555";
    hintNodes.upper.style.color = /[A-Z]/.test(val) ? "#2e7d32" : "#555";
    hintNodes.digit.style.color = /\d/.test(val) ? "#2e7d32" : "#555";
    hintNodes.special.style.color = /[\W_]/.test(val) ? "#2e7d32" : "#555";

    setValid(fields.password, ok);
    return ok;
  }

  function validateConfirm() {
    const ok = fields.confirmPassword.value === fields.password.value && fields.confirmPassword.value.length > 0;
    errs.confirm.style.display = ok ? "none" : "block";
    setValid(fields.confirmPassword, ok);
    return ok;
  }

  function validateCollege() {
    const ok = fields.collegeId.value.trim().length > 0;
    errs.college.style.display = ok ? "none" : "block";
    setValid(fields.collegeId, ok);
    return ok;
  }

  function validatePhone() {
    const raw = fields.phone.value.replace(/\D/g, "");
    const ok = phoneRegex.test(raw);
    errs.phone.style.display = ok ? "none" : "block";
    setValid(fields.phone, ok);
    return ok;
  }

  function validateDept() {
    const ok = fields.department.value !== "";
    errs.dept.style.display = ok ? "none" : "block";
    setValid(fields.department, ok);
    return ok;
  }

  function validateYear() {
    const ok = fields.year.value !== "";
    errs.year.style.display = ok ? "none" : "block";
    setValid(fields.year, ok);
    return ok;
  }

  // live listeners
  fields.name.addEventListener("input", validateName);
  fields.username.addEventListener("input", validateUsername);
  // debounce availability check
  fields.username.addEventListener('input', (e) => {
    validateUsername();
    clearTimeout(usernameTimer);
    const value = e.target.value.trim().toLowerCase();
    usernameTimer = setTimeout(() => checkUsernameAvailability(value), 450);
  });
  fields.email.addEventListener("input", validateEmail);
  fields.password.addEventListener("input", () => { validatePassword(); validateConfirm(); });
  fields.confirmPassword.addEventListener("input", validateConfirm);
  fields.collegeId.addEventListener("input", validateCollege);
  fields.phone.addEventListener("input", validatePhone);
  fields.department.addEventListener("change", validateDept);
  fields.year.addEventListener("change", validateYear);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Ensure terms are agreed
    const agree = document.getElementById('agreeTerms');
    if (!agree || !agree.checked) {
      alert('You must agree to the Terms & Conditions to register.');
      agree.focus();
      return;
    }

    const allOk = [
      validateName(), validateUsername(), validateEmail(),
      validatePassword(), validateConfirm(), validateCollege(),
      validatePhone(), validateDept(), validateYear()
    ].every(Boolean);

    // If username hint says Taken, block submission
    if (usernameHint && usernameHint.textContent === 'Taken') {
      alert('Username already taken. Please choose another.');
      fields.username.focus();
      return;
    }

    if (!allOk) {
      const firstInvalid = form.querySelector(".invalid");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const payload = {
      name: fields.name.value.trim(),
      username: fields.username.value.trim(),
      email: fields.email.value.trim().toLowerCase(),
      password: fields.password.value, // Server must hash
      collegeId: fields.collegeId.value.trim(),
      phone: fields.phone.value.replace(/\D/g, ""),
      department: fields.department.value,
      year: parseInt(fields.year.value, 10),
      skills: fields.skills.value.split(",").map(s => s.trim()).filter(Boolean),
    };

    // Disable UI while request in progress
    submitBtn.disabled = true;
    card.classList.add("loading");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({ success: false, message: "Invalid server response" }));

      if (response.ok && data.success) {
        // Use absolute path to make sure redirect works from any route
        alert("Registration successful! Please login.");
        window.location.href = "/login.html";
        return;
      }

      // If server returned non-OK status or data.success is false, show message
      const msg = data && data.message ? data.message : (response.statusText || 'Unknown server error');
      alert('Registration failed: ' + msg);
    } catch (err) {
      console.error("Registration error:", err);
      alert("Something went wrong. Try again later.");
    } finally {
      submitBtn.disabled = false;
      card.classList.remove("loading");
    }
  });

  // Password visibility toggles
  // Password visibility toggles (match login.html behavior)
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  const confirmInput = document.getElementById('confirmPassword');
  const toggleConfirm = document.getElementById('toggleConfirmPassword');
  if (toggleConfirm && confirmInput) {
    toggleConfirm.addEventListener('click', () => {
      const type = confirmInput.getAttribute('type') === 'password' ? 'text' : 'password';
      confirmInput.setAttribute('type', type);
      toggleConfirm.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

})();
