# STILL — offline sandbox marketplace

A two-process demo: the original slider sign-in page, a protected design-object
storefront, and a sandbox payment flow that ends with a real order record and a
printable receipt.

- **Frontend:** `index.html`, `store.html`, `checkout.html`, `orders.html` — static HTML/CSS/JS
- **Backend:** FastAPI + SQLite in `backend/` — API only, no templates or static files
- **Payments:** deterministic sandbox cards, wallets, 3-D Secure and bank transfer
- **Receipt:** a local thermal-paper layout inspired by
  [Receiptable](https://github.com/tom-draper/receiptable); no receipt API or account is used
- **No backend services required:** the catalogue, users, sessions and payments
  all live locally. Product photos and display webfonts load from the internet
  when available, with local fallbacks, so the shop still works offline.

---

## Run from scratch — two terminals

You need **Python 3.11+** (tested on 3.13), `git`, and a terminal. No Node.js,
Docker, external database or payment keys are needed.

### Terminal 1 — backend

From the folder where you keep projects:

```bash
git clone https://github.com/Contractor-x/signin-signup-system.git
cd signin-signup-system/backend
```

Create the virtual environment and install the API:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create the local config and database. `seed.py` creates the schema, the default
admin account, the catalogue owner and all 12 products. It is safe to run more
than once.

```bash
cp .env.example .env
python seed.py
```

Expected output:

```text
Seeded shop: 12 inserted, 0 updated, 0 old demo products retired.
```

Start the API:

```bash
./dev.sh
```

You should see `Uvicorn running on http://127.0.0.1:8000`. **Leave this terminal
running.** If `./dev.sh` is not executable, run `chmod +x dev.sh` once, or use
`bash dev.sh`.

<details>
<summary>Windows (PowerShell or Command Prompt)</summary>

Activation is not required if you call the venv Python directly:

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

### Terminal 2 — frontend

Open a **new** terminal at the repository root (not `backend/`):

```bash
cd signin-signup-system
python3 -m http.server 5500 --bind 127.0.0.1
```

On Windows, use `python -m http.server 5500 --bind 127.0.0.1`.

Open **http://localhost:5500** in a browser. The frontend is plain HTML/CSS/JS,
so there is no build step and no `npm install`.

Keep this terminal open as well. This `http.server` does not auto-reload; refresh
the browser after editing frontend files.

> Do not double-click `index.html` or open it with a `file://` URL. The site must
> be served over HTTP on port **5500** or **5173**, the two origins allowed by the
> backend's CORS policy.

If port 5500 is already busy, use the other allowed port:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open **http://localhost:5173**.

#### Optional: VS Code Live Server instead

Open the repository root in VS Code, click **Go Live**, and make sure it uses
port `5500`. If your Live Server chooses another port, set it in VS Code
settings:

```json
{
  "liveServer.settings.port": 5500
}
```

The database is stored at `~/.local/share/still-sandbox/sandbox.db`, outside the
folder served by Live Server. This prevents a database write from reloading the
browser in the middle of checkout.

### Terminal 3 — optional smoke test

With the backend still running:

```bash
curl http://localhost:8000/health
```

Expected JSON:

```json
{"status":"ok","mode":"sandbox","is_test_mode":true,"livemode":false}
```

The interactive API docs are at **http://localhost:8000/docs**.

---

## First purchase walkthrough

1. Open **http://localhost:5500**. The original slider sign-in/sign-up page loads.
2. Choose **Create account** and sign up. New accounts are always `customer`.
3. You are redirected to the protected storefront (`store.html`).
4. Filter or search the 12 seeded objects, then add one to the bag.
5. Open the bag and choose **Checkout**.
6. Fill in any delivery name, phone and address.
7. Choose **Card** and pay with:

   | Field | Value |
   |---|---|
   | Card number | `4242 4242 4242 4242` |
   | Expiry | `12/30` |
   | CVC | `123` |

8. The success screen shows the thermal receipt. Use **Print receipt** to print
   it or save it as a PDF from the browser print dialog.
9. Open **Orders** to see the same receipt in the order detail dialog.

The receipt is rendered entirely by `js/shop-ui.js`. It includes the store
header, order number, date/time, customer and delivery details, line items,
subtotal, shipping, total, payment method, amount paid, change due, a barcode
and a sandbox disclaimer.

---

## Demo accounts and data

| Role | Email | Password |
|---|---|---|
| Superuser | `admin@sandbox.local` | `Admin1234!` |

The 12 seeded products belong to **Atelier Sandbox** (`studio@sandbox.local`).
That account is a display-only catalogue owner; its login is disabled.

Create a normal customer with the sign-up form. To create a usable
`shop_owner` or `superuser`, sign in as the admin and call
`POST /api/auth/signup-as` (see [`API.md`](API.md)).

A shop owner cannot buy their own products. Use a separate customer account for
the purchase walkthrough.

---

## Payment sandbox

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Approved (Visa) |
| `5555 5555 5555 4444` | Approved (Mastercard) |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 3220` | 3-D Secure — OTP `123456` |

Any future expiry (`12/30`) and any 3-digit CVC (`123`) work. Wallets:

- `+2348000000001` — approved instantly
- `+2348000000003` — stays pending; settle it from the checkout simulator

`bank_transfer` shows sandbox account details and settles through the same
simulator. **No real card number is accepted.** Luhn-valid numbers that are not
in the test list are rejected on purpose.

---

## Roles

- **customer** — browse, buy, view own orders. Default on signup.
- **shop_owner** — everything a customer can do, plus own product CRUD, sales and refunds.
- **superuser** — manage products/orders and assign roles through `POST /api/auth/users/{uid}/role`.

---

## Tests

Stop the dev server or use a second terminal, then:

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

Use `python -m pytest`, not a bare `pytest`, so the project venv is used. The
suite covers auth, roles, catalogue filtering, order reservation, card
success/decline, 3-D Secure, wallet/bank processing, cancellation, refunds and
seed idempotency. Tests use a temporary `sandbox_test.db` and never touch the
live database.

---

## Reset everything

This deletes **all local users, orders and products**. Stop the backend first
with `Ctrl+C`.

macOS/Linux:

```bash
cd backend
source .venv/bin/activate
rm -f ~/.local/share/still-sandbox/sandbox.db \
      ~/.local/share/still-sandbox/sandbox.db-shm \
      ~/.local/share/still-sandbox/sandbox.db-wal
python seed.py
./dev.sh
```

Windows:

```bat
cd backend
del "%USERPROFILE%\.local\share\still-sandbox\sandbox.db"
del "%USERPROFILE%\.local\share\still-sandbox\sandbox.db-shm"
del "%USERPROFILE%\.local\share\still-sandbox\sandbox.db-wal"
.venv\Scripts\python seed.py
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

If you changed `DB_PATH` in `backend/.env`, delete that file instead.

---

## Troubleshooting

**`Cannot reach the sandbox API`**
The backend is not running, or it is on a different port. Check
`curl http://localhost:8000/health` and restart `./dev.sh`.

**CORS error in the browser**
Serve the frontend from `http://localhost:5500` or `http://localhost:5173`.
Do not use `file://` and do not use an arbitrary port.

**`Address already in use`**
Find and stop the process using the port:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5500 -sTCP:LISTEN
```

Then press `Ctrl+C` in the matching terminal, or kill the PID shown by `lsof`.

**`ModuleNotFoundError: No module named 'app'`**
Run backend commands from the `backend/` directory and use the venv Python.

**`No module named pytest`**
Install the development requirements: `pip install -r requirements-dev.txt`.

**`dev.sh: Permission denied`**
Run `chmod +x dev.sh`, or start with `bash dev.sh`.

**PowerShell blocks activation**
Skip activation and use `.venv\Scripts\python ...` for every command, as shown
in the Windows section.

**The browser reloads while paying**
Make sure `DB_PATH` still points outside the repository
(`~/.local/share/still-sandbox/sandbox.db`). Restart the backend after changing
`.env`.

**Receipt printing shows the rest of the page**
Use the **Print receipt** button and enable background graphics in the browser
print dialog if the barcode is missing. The print stylesheet isolates the
receipt and targets an 80 mm paper width.

---

## API documentation

The full request/response contract, status codes, test data and end-to-end buy
sequence are in [`API.md`](API.md).

Quick map:

| Area | Prefix |
|---|---|
| Health | `GET /health` |
| Auth | `/api/auth/*` |
| Storefront + orders | `/api/store/*` |
| Payment engine | `/sandbox/v1/*` |
| Developer keys | `/api/developer/*` |

---

## Project layout

```text
index.html            original slider sign-in/sign-up, wired to the sandbox API
store.html            protected catalogue
checkout.html         delivery -> payment -> receipt
orders.html           order history and receipt dialog
css/style.css         original auth-slider styles
css/auth-extras.css   small additions for the sandbox outbox panel
css/shop.css          storefront design system + printable receipt styles
js/api.js             shared API client, token helpers, money/date/escape helpers
js/auth.js            auth form behaviour (validation, login, signup, reset)
js/shop-ui.js         session shell, account menu, bag, drawer and receipt renderer
js/shop.js            catalogue, filters, search, sort, quick view
js/checkout.js        order creation, card/wallet/bank payment, simulator
js/orders.js          order list, filters, receipt dialog and cancellation
backend/app/          FastAPI application
backend/seed.py       creates the schema, admin, catalogue owner and 12 products
backend/tests/        pytest suite
```

> The terminal-only frontend command is for local development only. It serves
> files under the repository root on loopback; never bind it to `0.0.0.0` or
> expose it to a network.
