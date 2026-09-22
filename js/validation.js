// ---------- Helpers ----------
function showError(input, errorEl, message) {
  input.classList.add('input-error');
  errorEl.textContent = message;
}

function clearError(input, errorEl) {
  input.classList.remove('input-error');
  errorEl.textContent = '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// POST JSON to the Python backend and parse the response.
// Throws an Error with a readable message when the backend replies with an error.
async function postJSON(path, body) {
  const res = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    // non-JSON response body
  }

  if (!res.ok) {
    const detail = data && data.detail;
    const message = typeof detail === 'string' ? detail : 'Something went wrong';
    throw new Error(message);
  }

  return data;
}

// Persist the Supabase access token returned by the backend.
function saveAuthToken(token) {
  if (token) localStorage.setItem('auth_token', token);
}

// ---------- Sign In (email + password) ----------
const signInForm = document.getElementById('signInForm');

if (signInForm) {
  const siEmail = document.getElementById('siEmail');
  const siEmailError = document.getElementById('siEmailError');
  const siPassword = document.getElementById('siPassword');
  const siPasswordError = document.getElementById('siPasswordError');

  signInForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    clearError(siEmail, siEmailError);
    clearError(siPassword, siPasswordError);

    if (siEmail.value.trim() === '') {
      showError(siEmail, siEmailError, 'Email is required');
      valid = false;
    } else if (!isValidEmail(siEmail.value.trim())) {
      showError(siEmail, siEmailError, 'Please enter a valid email');
      valid = false;
    }

    if (siPassword.value === '') {
      showError(siPassword, siPasswordError, 'Password is required');
      valid = false;
    }

    if (valid) {
      const btn = document.getElementById('signInSubmit');
      setLoading(btn, true);

      postJSON('/api/auth/login', {
        email: siEmail.value.trim(),
        password: siPassword.value,
      })
        .then((data) => {
          saveAuthToken(data.access_token);
          showToast('Signed in successfully', 'success');
          signInForm.reset();
          window.location.href = 'dashboard.html';
        })
        .catch((err) => {
          showToast(err.message, 'error');
        })
        .finally(() => {
          setLoading(btn, false);
        });
    }
  });

  // clear error as the user types
  [siEmail, siPassword].forEach((input) => {
    input.addEventListener('input', () => {
      const errorEl = input === siEmail ? siEmailError : siPasswordError;
      clearError(input, errorEl);
    });
  });
}

// ---------- Sign Up (email + password) ----------
const signUpForm = document.getElementById('signUpForm');

if (signUpForm) {
  const suName = document.getElementById('suName');
  const suNameError = document.getElementById('suNameError');
  const suEmail = document.getElementById('suEmail');
  const suEmailError = document.getElementById('suEmailError');
  const suPassword = document.getElementById('suPassword');
  const suPasswordError = document.getElementById('suPasswordError');

  signUpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    clearError(suName, suNameError);
    clearError(suEmail, suEmailError);
    clearError(suPassword, suPasswordError);

    if (suName.value.trim() === '') {
      showError(suName, suNameError, 'Name is required');
      valid = false;
    }

    if (suEmail.value.trim() === '') {
      showError(suEmail, suEmailError, 'Email is required');
      valid = false;
    } else if (!isValidEmail(suEmail.value.trim())) {
      showError(suEmail, suEmailError, 'Please enter a valid email');
      valid = false;
    }

    if (suPassword.value === '') {
      showError(suPassword, suPasswordError, 'Password is required');
      valid = false;
    } else if (suPassword.value.length < 8) {
      showError(suPassword, suPasswordError, 'Password must be at least 8 characters');
      valid = false;
    }

    if (valid) {
      const btn = document.getElementById('signUpSubmit');
      setLoading(btn, true);

      postJSON('/api/auth/signup', {
        username: suName.value.trim(),
        email: suEmail.value.trim(),
        password: suPassword.value,
      })
        .then((data) => {
          signUpForm.reset();

          if (data.access_token) {
            saveAuthToken(data.access_token);
            window.location.href = 'dashboard.html';
          } else {
            // Supabase has email confirmation enabled: no session until the
            // confirmation link is clicked.
            showToast('Account created. Check your email to confirm.', 'success');
          }
        })
        .catch((err) => {
          showToast(err.message, 'error');
        })
        .finally(() => {
          setLoading(btn, false);
        });
    }
  });

  [suName, suEmail, suPassword].forEach((input) => {
    input.addEventListener('input', () => {
      const errorEl =
        input === suName ? suNameError :
        input === suEmail ? suEmailError : suPasswordError;
      clearError(input, errorEl);
    });
  });
}

// ---------- Forgot password ----------
const forgotFormEl = document.getElementById('forgotForm');

if (forgotFormEl) {
  const forgotEmail = document.getElementById('forgotEmail');
  const forgotEmailError = document.getElementById('forgotEmailError');

  forgotFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError(forgotEmail, forgotEmailError);

    if (forgotEmail.value.trim() === '') {
      showError(forgotEmail, forgotEmailError, 'Email is required');
      return;
    }
    if (!isValidEmail(forgotEmail.value.trim())) {
      showError(forgotEmail, forgotEmailError, 'Please enter a valid email');
      return;
    }

    const btn = document.getElementById('forgotSubmit');
    setLoading(btn, true);

    postJSON('/api/auth/forgot-password', { email: forgotEmail.value.trim() })
      .then(() => {
        const sentTo = document.getElementById('forgotSentTo');
        if (sentTo) sentTo.textContent = forgotEmail.value.trim();

        document.getElementById('forgotStepForm').hidden = true;
        document.getElementById('forgotStepSuccess').hidden = false;

        // auto-dismiss the modal after 8s so the user doesn't have to click "Back to sign in"
        if (typeof scheduleForgotAutoClose === 'function') {
          scheduleForgotAutoClose(8000);
        }
      })
      .catch((err) => {
        showToast(err.message, 'error');
      })
      .finally(() => {
        setLoading(btn, false);
      });
  });

  forgotEmail.addEventListener('input', () => {
    clearError(forgotEmail, forgotEmailError);
  });
}