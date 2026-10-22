// Shared API client for the sandbox shop.
// Backend runs separately on http://localhost:8000
const API_BASE_URL = 'http://localhost:8000';
const TOKEN_KEY = 'auth_token';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const money = (minor, cur = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: cur }).format(minor / 100);

const token = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (_) { /* ignore */ }
  clearToken();
  location.href = 'index.html';
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token()) headers.Authorization = 'Bearer ' + token();
  const res = await fetch(API_BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (res.status === 401 && auth && token()) {
    clearToken();
    location.href = 'index.html';
  }
  if (!res.ok) throw new Error(data.error?.message || typeof data.detail === 'string'
    ? data.detail : 'Request failed');
  return data;
}

// Require login before viewing a page. Call at the top of store/checkout/orders pages.
function requireAuth() {
  if (!token()) {
    localStorage.removeItem(TOKEN_KEY);
    location.href = 'index.html';
  }
}
