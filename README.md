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

- **Sign in** ជាមួយ Email / Password
- **Sign up** ជាមួយ Email / Password (Name / Email / Password)
- Backend **FastAPI (Python)** មានក្នុង `backend/` — commented code
- Supabase Auth គ្រប់គ្រងគណនី ហើយ Supabase ទុក **email + username** ក្នុង table `profiles`
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
├── index.html          → HTML (Sign in form + Sign up form + Forgot password modal)
├── css/
│   └── style.css       → Layout + Animation + Responsive + Modal + Toast + Spinner
├── js/
│   ├── config.js       → API_BASE_URL (backend URL) — កន្លែងកំណត់ backend
│   ├── script.js       → Panel toggle + forgot-password modal
│   ├── validation.js   → Form validation + fetch calls ទៅកាន់ Python endpoints
│   └── ux.js           → setLoading(), showToast(), show/hide password
├── backend/            → Python (FastAPI) backend
│   ├── app/
│   │   ├── main.py     → All API endpoints (commented)
│   │   ├── db.py       → Supabase client + `profiles` helpers
│   │   └── config.py   → Environment variables
│   ├── requirements.txt
│   ├── .env.example    → Copy → .env រួចបំពេញ keys
│   ├── run.sh          → Production launcher (gunicorn / uvicorn workers)
│   └── .gitignore      → មិន commit .env
└── README.md
```

---

## 🚀 How to Run

### 1. Frontend (local)

```bash
git clone <repo-url>
cd Signin-Signup-System
```

បើក `index.html` ជាមួយ **Live Server** (port 5500)។

### 2. Backend (Python)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # បំពេញ Supabase keys
uvicorn app.main:app --reload --port 8000
```

API docs អាចមើលបាននៅ `http://localhost:8000/docs` (Swagger UI)។

---

## 🗄️ Supabase Setup (via MCP or SQL editor)

Backend ប្រើ **Supabase Auth** (email/password) និង table `profiles` សម្រាប់ email + username។

1. បើក `supabase/setup.sql` ហើយ run ម្តងក្នុង **Supabase Dashboard → SQL Editor → New query → Run** (ឬ run តាម Supabase MCP) — វាបង្កើត table `profiles` និង RLS policy ដើម្បីឲ្យ signup/signin ដំណើរការដោយគ្មានកំហុស។
2. Supabase Auth → **Providers → Email** → បើក "Enable Sign up" (email confirmation អាចបិទបានពេល test)។
3. Keys ដាក់ក្នុង `backend/.env`:
   ```
   SUPABASE_URL=https://qcknajramizetgecqgna.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # optional
   FRONTEND_URL=http://localhost:5500
   ```

អំពី `SUPABASE_SERVICE_ROLE_KEY` (optional)៖
- បើគ្មាន → backend ប្រើ user metadata ជំនួស `profiles` table ពេល RLS ទប់ insert (signup/login នៅតែដំណើរការ)។
- បើមាន → backend សរសេរ email + username ទៅ `profiles` table ដោយផ្ទាល់ (bypass RLS) — key នេះទុកតែក្នុង backend `backend/.env` កុំដាក់ក្នុង frontend។

> 💡 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` រកបាននៅ Supabase Dashboard → **Project → Settings → API**។

---

## 🔧 Production — Frontend លើ Vercel, Backend លើ Server របស់អ្នក

### Frontend

Import repo ទៅ [vercel.com](https://vercel.com) — static files វាដំណើរការតែប៉ុណ្ណោះ (build command `none`)។

### Backend env (production)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
FRONTEND_URL=https://signin-signup-system.vercel.app   # Vercel frontend URL
```

### Frontend → backend

`js/config.js` → `API_BASE_URL = 'https://auth.your-domain.com'` ចង្អុលទៅ server អ្នក។

### Run backend (HTTPS)

```bash
cd backend
./run.sh           # gunicorn on 0.0.0.0:8000 (uvicorn workers)
```

ដាក់នៅពីក្រោយ reverse proxy (Caddy ឬ Nginx) ដើម្បីផ្តល់ HTTPS៖

```caddyfile
auth.your-domain.com {
    reverse_proxy 127.0.0.1:8000
}
```

### systemd (auto-start, optional)

```ini
[Unit]
Description=Signin Auth API
After=network.target

[Service]
WorkingDirectory=/path/to/signin-signup-system/backend
ExecStart=/path/to/signin-signup-system/backend/.venv/bin/gunicorn app.main:app --bind 127.0.0.1:8000 --workers 2 --worker-class uvicorn.workers.UvicornWorker
Restart=always
User=contractor

[Install]
WantedBy=multi-user.target
```

---

## 🐍 Python Backend Endpoints

Code ពេញលេញ (commented) មានក្នុង [`backend/app/main.py`](backend/app/main.py)។

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | បង្កើតគណនី Email + Password (store username ក្នុង Supabase) |
| POST | `/api/auth/login` | Sign in Email + Password (Supabase Auth) |
| POST | `/api/auth/forgot-password` | ផ្ញើ reset link (+ មិនលេចធ្លាយ account ណាមាន) |
| POST | `/api/auth/reset-password` | កំណត់ password ថ្មី |
| GET | `/api/auth/me` | User បច្ចុប្បន្ន (email + username ពី Supabase) |
| POST | `/api/auth/logout` | Sign out / invalidate session |
| GET | `/health` | ពិនិត្យ backend ↔ Supabase connection |

### Frontend ↔ Backend wiring

- Sign in form → `POST /api/auth/login` (fetch, JSON)
- Sign up form → `POST /api/auth/signup`
- Forgot password → `POST /api/auth/forgot-password`
- Backend URL កំណត់នៅ `js/config.js` → `API_BASE_URL`
- ការចូលជោគជ័យ → backend ផ្ញើ `access_token` → frontend ទុកក្នុង `localStorage('auth_token')`