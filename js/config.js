// Backend API base URL.
// The backend runs on your machine, so keep this pointing at localhost.
// Modern browsers (Chrome/Edge/Firefox) allow an HTTPS site to call
// http://localhost, so this works even when index.html is hosted on Vercel.
//
// - Local dev:  http://localhost:8000
// - Same machine as the backend (Vercel-hosted page): http://localhost:8000
// - Open this from ANOTHER device: put your computer's LAN IP here,
//   e.g. "http://192.168.1.50:8000" (and add that IP to the CORS list).
const API_BASE_URL = 'http://localhost:8000';