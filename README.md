# STILL — offline sandbox marketplace

A two-process demo: the original slider sign-in page, a protected design-object
storefront, and a sandbox payment flow that ends with a real order record.

- **Frontend:** `index.html`, `store.html`, `checkout.html`, `orders.html` — static HTML/CSS/JS
- **Backend:** FastAPI + SQLite in `backend/` — API only, no templates or static files
- **Payments:** deterministic sandbox cards, wallets, 3-D Secure and bank transfer
- **No internet services required:** products are seeded, password-reset emails go to a local outbox, webhooks can be observed locally

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # already present in this checkout
python seed.py             # idempotent: 12 products + demo accounts
./dev.sh                   # http://localhost:8000
```

Health check: `curl http://localhost:8000/health`

### 2. Frontend

Open the **repository root** in VS Code and run Live Server on `index.html`
(`http://localhost:5500`). No build step is needed.

The frontend expects the API at `http://localhost:8000`; change
`API_BASE_URL` in `js/api.js` if your backend uses another port.

### 3. Use the shop

1. Sign up (always creates a `customer`) or sign in.
2. You are redirected to `store.html`. The shop cannot be opened without a session.
3. Add an object, open the bag, choose **Checkout**.
4. Enter delivery details, pay with a documented test card, wallet or bank transfer.
5. `orders.html` keeps the receipt and payment state.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Superuser | `admin@sandbox.local` | `Admin1234!` |

The seeded catalogue belongs to **Atelier Sandbox** (`studio@sandbox.local`).
That account is a display owner only and has sign-in disabled. A superuser can
create a usable role account with `POST /api/auth/signup-as` (see `API.md`).

A customer cannot buy their own products; create a separate customer with the
sign-up form.

## Payment sandbox

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Approved |
| `5555 5555 5555 4444` | Approved (Mastercard) |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 3220` | 3-D Secure, OTP `123456` |

Any future expiry (`12/30`) and any 3-digit CVC (`123`) work. Wallets:
`+2348000000001` approves instantly, `+2348000000003` stays pending and can be
settled from the checkout simulator. `bank_transfer` shows sandbox account
details and settles through the same simulator.

**No real card number is accepted.** Luhn-valid numbers that are not in the
test list are rejected on purpose.

## Roles

- **customer** — browse, buy, view own orders. Default on signup.
- **shop_owner** — everything a customer can do, plus own product CRUD, sales and refunds.
- **superuser** — manage products/orders and assign roles through `/api/auth/users/{uid}/role`.

## API documentation

The full request/response contract, statuses and end-to-end buy sequence are in
[`API.md`](API.md).

Quick map:

| Area | Prefix |
|---|---|
| Health | `GET /health` |
| Auth | `/api/auth/*` |
| Storefront + orders | `/api/store/*` |
| Payment engine | `/sandbox/v1/*` |
| Developer keys | `/api/developer/*` |

## Tests

```bash
cd backend
pytest -q
```

The suite covers auth, roles, catalogue filtering, order reservation, card
success/decline, 3-D Secure, wallet/bank processing, cancellation, refunds and
seed idempotency. The test database is recreated each session.

## Project layout

```
index.html            original slider sign-in/sign-up, wired to the sandbox API
store.html            protected catalogue
checkout.html         delivery -> payment -> receipt
orders.html           order history and detail dialog
css/style.css         original auth-slider styles
css/auth-extras.css   small additions for the sandbox outbox panel
css/shop.css          storefront design system
js/api.js             shared API client, token helpers, money/date/escape helpers
js/auth.js            auth form behaviour (validation, login, signup, reset)
js/shop-ui.js         session shell, account menu, bag persistence and drawer
js/shop.js            catalogue, filters, search, sort, quick view
js/checkout.js        order creation, card/wallet/bank payment, simulator
js/orders.js          order list, filters, receipt and cancellation
backend/app/          FastAPI application
backend/seed.py       idempotent catalogue and demo-account seed
```
