// Tab switching
const authTabs = document.querySelectorAll('.auth-tab');
const authForms = document.querySelectorAll('.auth-form');

authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active form
    authForms.forEach(f => f.classList.remove('active'));
    document.getElementById(`${tabName}Form`).classList.add('active');

    // Clear messages
    document.getElementById('loginMessage').innerHTML = '';
    document.getElementById('registerMessage').innerHTML = '';
  });
});

// Login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const messageDiv = document.getElementById('loginMessage');

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      messageDiv.innerHTML = '<div class="success-message">Login successful! Redirecting...</div>';
      setTimeout(() => {
        // Check if there's a redirect parameter
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || '/';
        window.location.href = redirect;
      }, 1000);
    } else {
      messageDiv.innerHTML = `<div class="error-message">${data.error}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="error-message">Login failed. Please try again.</div>';
  }
});

// Register form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
  const messageDiv = document.getElementById('registerMessage');

  // Validate passwords match
  if (password !== passwordConfirm) {
    messageDiv.innerHTML = '<div class="error-message">Passwords do not match</div>';
    return;
  }

  if (password.length < 4) {
    messageDiv.innerHTML = '<div class="error-message">Password must be at least 4 characters</div>';
    return;
  }

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      messageDiv.innerHTML = '<div class="success-message">Registration successful! Redirecting...</div>';
      setTimeout(() => {
        // Check if there's a redirect parameter
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect') || '/';
        window.location.href = redirect;
      }, 1000);
    } else {
      messageDiv.innerHTML = `<div class="error-message">${data.error}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="error-message">Registration failed. Please try again.</div>';
  }
});

// Check if already logged in
fetch('/current-user')
  .then(response => response.json())
  .then(data => {
    if (data.loggedIn) {
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect') || '/';
      window.location.href = redirect;
    }
  });
