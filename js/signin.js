/* ==========================================================================
   Sign-in page — simple email/password form for the sandbox API.
   ========================================================================== */

const signinForm = document.getElementById('signinForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const formError = document.getElementById('formError');
const submitButton = document.getElementById('submit');

const NEXT_ALLOWED = /^(index\.html|checkout\.html|orders\.html|dashboard\.html)(\?.*)?$/;

function nextPage() {
  const raw = new URLSearchParams(location.search).get('next');
  if (raw && NEXT_ALLOWED.test(raw)) return raw;
  return 'index.html';
}

function setBusy(busy) {
  submitButton.disabled = busy;
  submitButton.textContent = busy ? 'Signing in…' : 'Sign in';
}

/* An existing valid session skips the form. */
(async function skipWhenSignedIn() {
  if (!token()) return;
  try {
    await api('/api/auth/me');
    location.replace(nextPage());
  } catch (_) {
    clearToken();
  }
})();

signinForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    formError.textContent = 'Enter your email and password.';
    (!email ? emailInput : passwordInput).focus();
    return;
  }

  setBusy(true);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    setToken(data.access_token, true);
    location.replace(nextPage());
  } catch (err) {
    if (err.status === 401) {
      formError.textContent = 'Wrong email or password.';
    } else {
      formError.textContent = err.message || 'Could not sign in. Try again.';
    }
    passwordInput.focus();
    setBusy(false);
  }
});
