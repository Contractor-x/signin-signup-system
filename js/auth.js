/* ==========================================================================
   Auth bridge — original slider page -> sandbox API.
   The markup and slider styles are the originals; this file only wires the
   forms to the FastAPI backend and adds inline errors.
   ========================================================================== */

const AUTH_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function isValidEmail(value) {
  return AUTH_EMAIL_RE.test(value);
}

function showError(input, errorEl, message) {
  if (input) {
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');
  }
  if (errorEl) errorEl.textContent = message;
}

function clearError(input, errorEl) {
  if (input) {
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
  }
  if (errorEl) errorEl.textContent = '';
}

function nextPage() {
  const raw = new URLSearchParams(location.search).get('next');
  const allowed = /^(store\.html|checkout\.html|orders\.html)(\?.*)?$/;
  return raw && allowed.test(raw) ? raw : 'store.html';
}

function finishAuth(data, remember) {
  setToken(data.access_token, remember);
  const name = data.user?.username ? `, ${data.user.username}` : '';
  showToast(`Welcome${name}`, 'success');
  window.setTimeout(() => { location.href = nextPage(); }, 220);
}

/* If the browser already holds a valid session, skip the sign-in screen. */
(async function skipWhenSignedIn() {
  if (!token()) return;
  try {
    await api('/api/auth/me');
    location.replace(nextPage());
  } catch (_) {
    clearToken();
  }
})();

/* --------------------------------------------------------------- sign in */
const authSignIn = document.getElementById('signInForm');
if (authSignIn) {
  const email = document.getElementById('siEmail');
  const emailError = document.getElementById('siEmailError');
  const password = document.getElementById('siPassword');
  const passwordError = document.getElementById('siPasswordError');
  const remember = document.getElementById('rememberMe');
  const submit = document.getElementById('signInSubmit');

  authSignIn.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(email, emailError);
    clearError(password, passwordError);

    const emailValue = email.value.trim();
    let valid = true;

    if (!emailValue) {
      showError(email, emailError, 'Email is required');
      valid = false;
    } else if (!isValidEmail(emailValue)) {
      showError(email, emailError, 'Enter a valid email address');
      valid = false;
    }

    if (!password.value) {
      showError(password, passwordError, 'Password is required');
      valid = false;
    }

    if (!valid) {
      (email.classList.contains('input-error') ? email : password).focus();
      return;
    }

    setLoading(submit, true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: emailValue, password: password.value },
      });
      finishAuth(data, Boolean(remember?.checked));
    } catch (err) {
      showToast(err.message, 'error');
      showError(password, passwordError, err.status === 401 ? 'Check your email and password' : '');
      password.focus();
    } finally {
      setLoading(submit, false);
    }
  });

  [[email, emailError], [password, passwordError]].forEach(([input, errorEl]) => {
    input.addEventListener('input', () => clearError(input, errorEl));
  });
}

/* --------------------------------------------------------------- sign up */
const authSignUp = document.getElementById('signUpForm');
if (authSignUp) {
  const name = document.getElementById('suName');
  const nameError = document.getElementById('suNameError');
  const email = document.getElementById('suEmail');
  const emailError = document.getElementById('suEmailError');
  const password = document.getElementById('suPassword');
  const passwordError = document.getElementById('suPasswordError');
  const submit = document.getElementById('signUpSubmit');

  authSignUp.addEventListener('submit', async (event) => {
    event.preventDefault();
    [name, email, password].forEach((input, index) => {
      clearError(input, [nameError, emailError, passwordError][index]);
    });

    const nameValue = name.value.trim();
    const emailValue = email.value.trim();
    let valid = true;

    if (nameValue.length < 3) {
      showError(name, nameError, 'Use at least 3 characters');
      valid = false;
    }
    if (!emailValue) {
      showError(email, emailError, 'Email is required');
      valid = false;
    } else if (!isValidEmail(emailValue)) {
      showError(email, emailError, 'Enter a valid email address');
      valid = false;
    }
    if (password.value.length < 8) {
      showError(password, passwordError, 'Use at least 8 characters');
      valid = false;
    }

    if (!valid) {
      const first = [name, email, password].find((input) => input.classList.contains('input-error'));
      first?.focus();
      return;
    }

    setLoading(submit, true);
    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        auth: false,
        body: { username: nameValue, email: emailValue, password: password.value },
      });
      finishAuth(data, true);
    } catch (err) {
      showToast(err.message, 'error');
      if (err.status === 400 && /email/i.test(err.message)) {
        showError(email, emailError, err.message);
        email.focus();
      }
    } finally {
      setLoading(submit, false);
    }
  });

  [[name, nameError], [email, emailError], [password, passwordError]].forEach(([input, errorEl]) => {
    input.addEventListener('input', () => clearError(input, errorEl));
  });
}

/* ------------------------------------------------------- forgot password */
const authForgot = document.getElementById('forgotForm');
if (authForgot) {
  const email = document.getElementById('forgotEmail');
  const emailError = document.getElementById('forgotEmailError');
  const submit = document.getElementById('forgotSubmit');
  let sandboxPanel;

  function buildSandboxPanel() {
    if (sandboxPanel) return sandboxPanel;

    sandboxPanel = document.createElement('div');
    sandboxPanel.className = 'sandbox-reset';
    sandboxPanel.innerHTML = `
      <button type="button" class="sandbox-reset__toggle" id="sandboxInboxToggle">
        Sandbox: open the fake inbox
      </button>
      <div class="sandbox-reset__panel" id="sandboxInboxPanel" hidden>
        <p class="sandbox-reset__note">
          This backend has no mail server. The reset token is written to a local
          outbox — use it here to finish the flow.
        </p>
        <div class="sandbox-reset__fields">
          <input type="password" id="sandboxNewPassword" placeholder="New password" minlength="8" autocomplete="new-password">
          <input type="password" id="sandboxConfirmPassword" placeholder="Confirm new password" minlength="8" autocomplete="new-password">
          <button type="button" class="sandbox-reset__submit" id="sandboxResetSubmit">
            Set new password
          </button>
        </div>
        <p class="sandbox-reset__status" id="sandboxResetStatus"></p>
      </div>`;

    document.getElementById('forgotStepSuccess')?.appendChild(sandboxPanel);

    const toggle = sandboxPanel.querySelector('#sandboxInboxToggle');
    const panel = sandboxPanel.querySelector('#sandboxInboxPanel');
    const status = sandboxPanel.querySelector('#sandboxResetStatus');
    const newPassword = sandboxPanel.querySelector('#sandboxNewPassword');
    const confirmPassword = sandboxPanel.querySelector('#sandboxConfirmPassword');
    const resetSubmit = sandboxPanel.querySelector('#sandboxResetSubmit');

    let resetToken = '';

    const setStatus = (message, type = '') => {
      status.textContent = message;
      status.className = 'sandbox-reset__status' + (type ? ` is-${type}` : '');
    };

    toggle.addEventListener('click', async () => {
      if (!panel.hidden) {
        panel.hidden = true;
        toggle.textContent = 'Sandbox: open the fake inbox';
        return;
      }

      panel.hidden = false;
      toggle.textContent = 'Sandbox: hide the fake inbox';
      setStatus('Looking for the reset email…');

      try {
        const outbox = await api('/api/auth/dev/outbox', { auth: false });
        const wanted = email.value.trim().toLowerCase();
        const mail = (outbox || []).find((item) =>
          item.to_email?.toLowerCase() === wanted && /reset/i.test(item.subject || '')
        );
        if (!mail) {
          resetToken = '';
          setStatus('No reset email yet. Submit the form above, then try again.', 'error');
          return;
        }
        resetToken = String(mail.body || '').split(':').pop().trim();
        if (!resetToken) {
          setStatus('The reset email did not contain a token.', 'error');
          return;
        }
        setStatus('Reset email found. Choose a new password.');
        newPassword.focus();
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });

    resetSubmit.addEventListener('click', async () => {
      if (!resetToken) {
        setStatus('Open the fake inbox first.', 'error');
        return;
      }
      if (newPassword.value.length < 8) {
        setStatus('Use at least 8 characters.', 'error');
        newPassword.focus();
        return;
      }
      if (newPassword.value !== confirmPassword.value) {
        setStatus('The two passwords do not match.', 'error');
        confirmPassword.focus();
        return;
      }

      resetSubmit.disabled = true;
      setStatus('Updating password…');
      try {
        await api('/api/auth/reset-password', {
          method: 'POST',
          auth: false,
          body: { token: resetToken, new_password: newPassword.value },
        });
        setStatus('Password updated. You can sign in now.', 'ok');
        resetSubmit.textContent = 'Password updated';
        document.getElementById('siEmail').value = email.value.trim();
        document.getElementById('siPassword').focus();
      } catch (err) {
        setStatus(err.message, 'error');
        resetSubmit.disabled = false;
      }
    });

    return sandboxPanel;
  }

  authForgot.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(email, emailError);

    const value = email.value.trim();
    if (!value) {
      showError(email, emailError, 'Email is required');
      email.focus();
      return;
    }
    if (!isValidEmail(value)) {
      showError(email, emailError, 'Enter a valid email address');
      email.focus();
      return;
    }

    setLoading(submit, true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email: value },
      });
      document.getElementById('forgotSentTo').textContent = value;
      document.getElementById('forgotStepForm').hidden = true;
      document.getElementById('forgotStepSuccess').hidden = false;
      buildSandboxPanel();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(submit, false);
    }
  });

  email.addEventListener('input', () => clearError(email, emailError));
}
