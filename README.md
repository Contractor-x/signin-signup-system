<div align="center">

# 🔐 Sign In / Sign Up

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## ✨ Features

- Sign in ជាមួយ **Email / Password** (Python backend + Supabase Auth)
- **Sign up តែតាម Google ប៉ុណ្ណោះ** (Continue with Google)
- Google OAuth sign-in ក៏មានដែរ នៅលើ panel Sign in
- Backend **FastAPI (Python)** មានក្នុង `backend/` — commented code
- Supabase ទុក **email + username** ក្នុង table `profiles`
- Forgot password modal (send reset link → auto-close)
- Toggle animation រវាង Sign in ↔ Sign up (sliding panel style)
- Responsive ពេញលេញ (Desktop / Tablet / Mobile)
- Show / Hide password toggle, Remember me, Loading spinner, Toast notification
- Client-side validation (required, email format, password length)
- Keyboard accessible (Escape បិទ modal, `sr-only` labels)

---

## 📁 Project Structure

```
Signin-Signup-System/
├── index.html          → HTML (Sign in form + Google button + Forgot password modal)
├── css/
│   └── style.css       → Layout + Animation + Responsive + Modal + Toast + Spinner
├── js/
│   ├── config.js       → API_BASE_URL (backend URL) — កន្លែងកំណត់ backend
│   ├── script.js       → Panel toggle + forgot-password modal + Google callback handler
│   ├── validation.js   → Form validation + fetch calls ទៅកាន់ Python endpoints
│   └── ux.js           → setLoading(), showToast(), show/hide password
├── backend/            → Python (FastAPI) backend
│   ├── app/
│   │   ├── main.py     → All API endpoints (commented)
│   │   ├── auth.py     → Google OAuth helpers
│   │   ├── db.py       → Supabase client + `profiles` helpers
│   │   └── config.py   → Environment variables
│   ├── requirements.txt
│   └── .env.example    → Copy → .env រួចបំពេញ keys
└── README.md
```

---

## 🚀 How to Run

### 1. Frontend (Vercel / local)

```bash
git clone <repo-url>
cd Signin-Signup-System
```

- Local: បើក `index.html` ជាមួយ **Live Server** (port 5500)
- Vercel: import repo ទៅ [vercel.com](https://vercel.com) → build command `none`, output `index.html` (static) — frontend នេះជា static files តែប៉ុណ្ណោះ

### 2. Backend (Python)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # បំពេញ Google + Supabase keys
uvicorn app.main:app --reload --port 8000
```

API docs អាចមើលបាននៅ `http://localhost:8000/docs` (Swagger UI)។

---

## 🔑 Google OAuth — Redirect URL នៅលើ Vercel និង Google

OAuth flow តម្រូវឲ្យ URL ត្រូវគ្នាត្រឹមត្រូវ **3 កន្លែង**៖

| # | កន្លែង | តើយក URL ពីណា | តម្លៃ |
|---|---|---|---|
| 1 | `FRONTEND_URL` (backend `.env`) | Vercel → Project → **Domains** ឬ **Deployments** | `https://your-app.vercel.app` |
| 2 | `GOOGLE_REDIRECT_URI` (backend `.env`) | ត្រូវតែត្រូវនឹង #3 | `https://your-app.vercel.app/api/auth/callback` |
| 3 | Google Cloud Console → **Credentials → OAuth 2.0 Client ID (Web) → Authorized redirect URIs** | ចម្លងពី #2 | `https://your-app.vercel.app/api/auth/callback` |

> ⚠️ Google ទទួលបាន redirect URIs **ពិតប្រាកដតែប៉ុណ្ណោះ** — មិនអាចប្រើ `localhost` ពេល deploy លើ Vercel បានទេ។ បើ frontend និង backend នៅលើ host ផ្សេងគ្នា ត្រូវដាក់ host នៃ backend នៅក្នុង #2/#3 ហើយកែ `js/config.js` → `API_BASE_URL` ឲ្យចង្អុលទៅ backend origin។

### របៀបតាមដាន url នីមួយៗ

1. **Vercel** → បើក project → **Settings → Domains** ឬ Preview Deployment URL (ឧ. `https://signin-signup-system.vercel.app`)
2. **Environment Variables (Vercel)** → project → **Settings → Environment Variables** → add:
   ```
   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, FRONTEND_URL
   ```
3. **Google Cloud Console** → **APIs & Services → Credentials → OAuth 2.0 Client (type: Web)** → បញ្ចូល Authorized redirect URI = `https://your-app.vercel.app/api/auth/callback`

### Supabase table `profiles`

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  sub text unique not null,          -- Google subject ID
  email text unique not null,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);
```

---

## 🐍 Python Backend Endpoints

Code ពេញលេញ (commented) មានក្នុង [`backend/app/main.py`](backend/app/main.py)។

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/google` | ចាប់ផ្តើម Google OAuth — Google button redirect មកទីនេះ |
| GET | `/api/auth/callback` | Google redirect back → Supabase session → save email + username → ត្រឡប់ទៅ frontend |
| POST | `/api/auth/login` | Email + password login (Supabase Auth) |
| POST | `/api/auth/signup` | Email + password signup (API-only; UI sign-up គឺ Google-only) |
| POST | `/api/auth/forgot-password` | ផ្ញើ reset link (+ មិនលេចធ្លាយ account ណាមាន) |
| POST | `/api/auth/reset-password` | កំណត់ password ថ្មី |
| GET | `/api/auth/me` | User បច្ចុប្បន្ន (email + username ពី Supabase) |
| POST | `/api/auth/logout` | Sign out / invalidate session |

### Frontend ↔ Backend wiring

- Google buttons → `window.location` → `GET /api/auth/google`
- Sign in form → `POST /api/auth/login` (fetch, JSON)
- Forgot password → `POST /api/auth/forgot-password`
- Callback success → browser ត្រលប់មក `?token=...&email=...` → `js/script.js` រក្សាទុក token ក្នុង `localStorage('auth_token')`
- Backend URL កំណត់នៅ `js/config.js` → `API_BASE_URL`

---

## ⚠️ Note

Frontend គឺ static (Vercel) ហើយ backend គឺ FastAPI (Python) ដាច់ដោយឡែក។
**Sign up** UI គឺ Google-only; password signup អាចប្រើបានតាម API `/api/auth/signup` ឬ Supabase dashboard។