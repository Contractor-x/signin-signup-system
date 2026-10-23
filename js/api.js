/* ==========================================================================
   Shared sandbox API client.
   The backend is a separate process: http://localhost:8000
   ========================================================================== */

const API_BASE_URL = 'http://localhost:8000';
const TOKEN_KEY = 'sandbox_token';

const token = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';

const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

/**
 * Persist a session. "Remember me" uses localStorage; otherwise the token
 * lives only for the browser tab (sessionStorage).
 */
const setToken = (value, remember = true) => {
  clearToken();
  if (!value) return;
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, value);
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));

const money = (minor, currency = 'NGN') => {
  const amount = Number(minor || 0) / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
};

function apiErrorMessage(data, res) {
  const detail = data?.error?.message ?? data?.detail ?? data?.message;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    return detail.map((item) => item.msg).join('. ');
  }
  if (res?.status === 0) return 'Cannot reach the sandbox API.';
  return res ? `Request failed (${res.status})` : 'Request failed';
}

/**
 * Fetch JSON from the sandbox API.
 * Throws an Error with `.status` and `.data` for non-2xx responses.
 */
async function api(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const current = token();
  if (auth && current) headers.Authorization = `Bearer ${current}`;

  let res;
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(
      'Cannot reach the sandbox API. Start the backend on localhost:8000 and try again.'
    );
  }

  const raw = await res.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = { detail: raw }; }
  }

  if (res.status === 401 && auth && current && !path.startsWith('/api/auth/')) {
    clearToken();
    const page = location.pathname.split('/').pop() || 'index.html';
    if (page !== 'signin.html') {
      location.replace(`signin.html?next=${encodeURIComponent(page + location.search)}`);
    }
  }

  if (!res.ok) {
    const error = new Error(apiErrorMessage(data, res));
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/** Protected pages send guests to the sign-in page, preserving their target. */
function requireAuth() {
  if (token()) return true;
  const page = location.pathname.split('/').pop() || 'index.html';
  location.replace(`signin.html?next=${encodeURIComponent(page + location.search)}`);
  return false;
}

function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-error', type === 'error');
  el.classList.add('is-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

/**
 * The auth page ships the original ux.js, which owns showToast().
 * New pages use toast() so the two scripts do not declare the same global.
 */
