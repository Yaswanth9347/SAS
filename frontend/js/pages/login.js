// Password visibility toggle with SVG icons
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");

// SVG Icons
const eyeIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
const eyeSlashIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';

togglePassword.addEventListener("click", () => {
  const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
  passwordInput.setAttribute("type", type);
  togglePassword.innerHTML = type === "password" ? eyeIcon : eyeSlashIcon;
});

// Proactively clear any browser autofill of demo/admin creds
window.addEventListener('DOMContentLoaded', () => {
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  // double-clear in next tick for stubborn autofill
  setTimeout(() => {
    if (usernameInput && /admin/i.test(usernameInput.value)) usernameInput.value = '';
    if (passwordInput && passwordInput.value.length) passwordInput.value = '';
  }, 0);
});

// Login logic
document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  
  const loginStatus = document.getElementById("loginStatus");
  loginStatus.className = "loading";
  loginStatus.textContent = "Logging in...";
  
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    // Removed legacy admin shortcut to avoid confusion; rely solely on server auth
    
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    // Check content type before parsing JSON
    const contentType = response.headers.get("content-type");
    let data;
    
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      // Handle non-JSON response (rate limit HTML or other errors)
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      throw new Error(text.includes("Too many") 
        ? "Too many login attempts. Please try again in 15 minutes." 
        : "Server error. Please try again later.");
    }

    console.log('Login response:', data);

    if (data.success) {
      loginStatus.className = "success";
      loginStatus.textContent = "Login successful! Redirecting...";
      
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // Store server instance ID for session validation
      if (data.serverInstanceId) {
        localStorage.setItem("serverInstanceId", data.serverInstanceId);
      }
      
      // Redirect all users to dashboard
      window.location.href = "dashboard.html";
    } else {
      loginStatus.className = "error";
      loginStatus.textContent = data.message || "Login failed. Please check your credentials.";
    }
  } catch (error) {
    console.error("Login error:", error);
    loginStatus.className = "error";
    
    // Show user-friendly error message
    if (error.message.includes("Too many")) {
      loginStatus.textContent = error.message;
    } else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      loginStatus.textContent = "Unable to connect to server. Please check your internet connection.";
    } else {
      loginStatus.textContent = error.message || "Login failed. Please try again.";
    }
  }
});

// If user is already logged in, redirect
if (localStorage.getItem("token")) {
  window.location.href = "dashboard.html";
}
