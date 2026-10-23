# STILL — sandbox shop

A public storefront backed by a FastAPI API, with a simulated payment flow.
The shop opens directly; sign in only when you check out or view orders.

It runs as **two local processes**:

| Process | What it is | Address |
|---|---|---|
| **Backend** | FastAPI + SQLite (`backend/`) | `http://localhost:8000` |
| **Frontend** | Static HTML/CSS/JS (repo root) | `http://localhost:5500` |

Everything runs offline. No Node.js, Docker, external database or payment keys
are required — only Python 3.11+.

---

## Launch from two terminals

Open **two terminals in the project root**. Terminal 1 runs the API; Terminal 2
serves the website.

You need **Python 3.11+** (tested on 3.13), `git` and a terminal.

### Terminal 1 — Backend

```bash
cd backend
./dev.sh
```

`dev.sh` creates `.venv`, installs `requirements.txt`, and starts Uvicorn:

```text
Uvicorn running on http://127.0.0.1:8000
```

**Leave this terminal running.** If the script is not executable, run
`chmod +x dev.sh` once, or start it with `bash dev.sh`.

On the **first run only**, seed the demo catalogue (default admin + 12
products). Do this from a spare terminal, or after stopping the server with
`Ctrl+C` — it is safe to run more than once:

```bash
cd backend
cp .env.example .env      # skip if .env already exists
./.venv/bin/python seed.py
```

<details>
<summary>Windows (PowerShell or Command Prompt)</summary>

```bat
cd backend
py -3 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python seed.py
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

</details>

### Terminal 2 — Frontend

Open a **new** terminal at the repository root (not `backend/`):

```bash
 
```

Then open **http://localhost:5500**.

The frontend is plain HTML/CSS/JS — there is no build step and no `npm install`.
This server does not auto-reload; refresh the browser after editing files.

> Do **not** double-click `index.html` or open it as a `file://` URL. It must be
> served over HTTP from port **5500** (or **5173**), the origins the backend's
> CORS policy allows.

If port 5500 is busy, use the other allowed port:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open **http://localhost:5173**.

> Using a different port? Add its origin to `allow_origins` in
> `backend/app/main.py` (or set `FRONTEND_URL` in `backend/.env`).

---

## Verify it works

With both terminals running:

```bash
curl http://localhost:8000/health
# {"status":"ok","mode":"sandbox","is_test_mode":true,"livemode":false}
```

- Interactive API docs: **http://localhost:8000/docs**
- Frontend root (**STILL storefront**): **http://localhost:5500** — opens
  directly, no sign-in required.
- Sign-in page: **http://localhost:5500/signin.html**

### Demo accounts

These accounts are **hardcoded** in `backend/app/db.py` and recreated whenever
the backend starts.

| Role | Email | Password |
|---|---|---|
| Admin (`shop_owner`) | `admin@still.local` | `Admin1234!` |
| Superuser (`superuser`) | `superuser@still.local` | `Super1234!` |
| Customer (`customer`) | `customer@still.local` | `Customer1234!` |

The legacy account `admin@sandbox.local` / `Admin1234!` (role `superuser`) is
also seeded for the test suite.

---

## Configuration

The backend reads `backend/.env` (create it from the example on a fresh clone):

```bash
cd backend
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `DB_PATH` | `~/.local/share/still-sandbox/sandbox.db` | SQLite database location |
| `SESSION_TTL_HOURS` | `24` | Session lifetime |
| `SANDBOX_DEV` | `1` | Enables the dev password-reset outbox endpoint |
| `FRONTEND_URL` | `http://localhost:5173` | Extra origin allowed by CORS |

The database is kept **outside** the served folder so writes don't reload the
browser mid-checkout. To start the backend on another port, use
`PORT=8001 ./dev.sh`.

---

## Tests

With the backend stopped (or from a second terminal):

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt   # first time only: adds pytest + httpx
python -m pytest -q
```

On Windows:

```bat
cd backend
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest -q
```

Use `python -m pytest`, not a bare `pytest`, so the project venv is used.

---

## Troubleshooting

**`Cannot reach the sandbox API`** — the backend is not running or is on a
different port. Check `curl http://localhost:8000/health` and restart `./dev.sh`.

**CORS error in the browser** — serve the frontend from `http://localhost:5500`
or `http://localhost:5173`. Do not use `file://` or an arbitrary port.

**`Address already in use`** — find and stop the process using the port:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5500 -sTCP:LISTEN
```

**`ModuleNotFoundError: No module named 'app'`** — run backend commands from the
`backend/` directory and use the venv Python.

**`No module named pytest`** — install `requirements-dev.txt`.

**`dev.sh: Permission denied`** — run `chmod +x dev.sh`, or `bash dev.sh`.

**PowerShell blocks venv activation** — skip activation and call
`.venv\Scripts\python ...` directly, as shown in the Windows section.

---

## Project layout

```text
index.html            STILL storefront (public landing page)
signin.html           simple sign-in form (no slider)
store.html            redirects to index.html (old-link compatibility)
dashboard.html        legacy account page (not linked from the shop)
checkout.html         delivery -> payment -> receipt
orders.html           order history and receipt dialog
css/                  shop styles + printable receipt
js/                   API client, catalogue, sign-in, checkout, orders
assets/               images (incl. dashboard image)
assets/products/      local product photos (12, bundled — no CDN needed)
assets/store/         local hero photos
backend/
  app/                FastAPI application (auth, store, payments, gateway)
  seed.py             creates schema, default admin and 12 demo products
  tests/              pytest suite
  dev.sh              one-command dev server (:8000)
  run.sh              gunicorn launcher for production
```

Full API contract: [`API.md`](API.md).
