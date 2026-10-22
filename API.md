# STILL Sandbox — API contract

Base URL: `http://localhost:8000`

The frontend (`http://localhost:5500`) is a separate static site. CORS is restricted to local frontend origins.

Every response carries `X-Sandbox-Mode: test`. No real money moves here.

## Conventions

### Authentication

Protected endpoints need the session token returned by signup/login:

```http
Authorization: Bearer <access_token>
```

Roles: `customer` (default), `shop_owner`, `superuser`.

### Errors

Application errors use one shape:

```json
{
  "error": { "code": "invalid_state", "message": "Order is 'paid'" },
  "detail": "Order is 'paid'"
}
```

Common statuses: `400` validation, `401` missing/bad session, `403` wrong role,
`404` not found, `409` state conflict, `422` unprocessable body.

### Money

All amounts are **integer minor units** (kobo/cents). Example: `₦78,000` is
`7800000`. Supported currencies: `NGN`, `USD`, `GHS`, `KES`.

### Order statuses

| Status | Meaning |
|---|---|
| `pending_payment` | Stock reserved; payment not completed |
| `payment_failed` | Payment attempt failed; can retry or cancel |
| `paid` | Payment succeeded |
| `canceled` | Buyer canceled; stock restored |
| `refunded` | Shop owner refunded the payment |

### Payment statuses

`requires_payment_method`, `requires_action` (3-D Secure), `processing`
(wallet/bank), `succeeded`, `failed`, `canceled`.

---

## 1. Health

### `GET /health`

Public liveness check.

```json
{ "status": "ok", "mode": "sandbox", "is_test_mode": true, "livemode": false }
```

---

## 2. Auth — `/api/auth`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/signup` | public | Create a customer account |
| POST | `/login` | public | Sign in and create a session |
| POST | `/forgot-password` | public | Queue a reset token in the offline outbox |
| POST | `/reset-password` | public | Set a new password with a reset token |
| GET | `/me` | session | Current user |
| POST | `/logout` | session | Delete the current session |
| GET | `/dev/outbox` | public (dev only) | Read the fake mailbox |
| POST | `/signup-as` | superuser | Create a user with any role |
| GET | `/users` | superuser | List users |
| PATCH | `/users/{uid}/role` | superuser | Change a user's role |

### `POST /api/auth/signup`

```json
{ "email": "ada@example.com", "password": "Test1234!", "username": "Ada" }
```

`username` 3–30 chars; password at least 8 chars. Role is always `customer`.

Response:

```json
{
  "access_token": "…",
  "user": { "id": "usr_…", "email": "ada@example.com", "username": "Ada", "role": "customer" }
}
```

### `POST /api/auth/login`

```json
{ "email": "ada@example.com", "password": "Test1234!" }
```

Response is the same `access_token` + `user` shape. Five bad attempts per email
trigger a temporary `429`.

### `POST /api/auth/forgot-password`

```json
{ "email": "ada@example.com" }
```

Always returns:

```json
{ "message": "If an account exists, a reset link has been sent." }
```

In this offline build the reset token is written to `GET /api/auth/dev/outbox`
instead of being emailed.

### `POST /api/auth/reset-password`

```json
{ "token": "<token from outbox>", "new_password": "NewTest1234!" }
```

Returns `{ "message": "Password updated." }` and deletes old sessions.

### `GET /api/auth/me`

Returns the current user:

```json
{ "id": "usr_…", "email": "ada@example.com", "username": "Ada", "role": "customer" }
```

### `POST /api/auth/logout`

Returns `{ "message": "Signed out" }`. The frontend also clears its stored token.

### `GET /api/auth/dev/outbox`

Dev-only (`SANDBOX_DEV=1`). Returns the 20 latest outbox entries:

```json
[{ "to_email": "ada@example.com", "subject": "Reset your password", "body": "Reset token…", "created_at": "…" }]
```

### `POST /api/auth/signup-as` (superuser)

```json
{ "email": "owner@example.com", "password": "Test1234!", "username": "Owner", "role": "shop_owner" }
```

`role` must be `customer`, `shop_owner`, or `superuser`. Returns `201` plus the
same token/user response as signup.

### `GET /api/auth/users` (superuser)

```json
{ "data": [{ "id": "usr_…", "email": "…", "username": "…", "role": "customer", "created_at": "…" }] }
```

### `PATCH /api/auth/users/{uid}/role` (superuser)

```json
{ "role": "shop_owner" }
```

Returns `{ "id": "usr_…", "role": "shop_owner" }`.

---

## 3. Storefront and orders — `/api/store`

### Products

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/products` | public | Catalogue: search, category, sort |
| GET | `/categories` | public | Category chips with counts |
| GET | `/my/products` | shop_owner | Products owned by the signed-in seller |
| POST | `/products` | shop_owner | Create a product |
| PUT | `/products/{pid}` | shop_owner | Replace own product |
| DELETE | `/products/{pid}` | shop_owner | Soft-delete own product |

#### `GET /api/store/products`

Query parameters:

| Name | Values | Default |
|---|---|---|
| `q` | free text (name/description) | empty |
| `category` | exact category, or `All` | empty |
| `sort` | `featured`, `newest`, `price_asc`, `price_desc`, `name_asc` | `featured` |

Example: `GET /api/store/products?q=stool&category=Seating&sort=price_asc`

```json
{
  "data": [{
    "id": "prd_…", "seller_id": "usr_…", "name": "Arc Counter Stool",
    "description": "…", "price_minor": 7800000, "currency": "NGN",
    "stock": 8, "emoji": "🪑", "image_url": "https://…",
    "category": "Seating", "active": 1, "seller": "Atelier Sandbox"
  }]
}
```

#### `GET /api/store/categories`

```json
{ "data": [{ "category": "Lighting", "count": 2 }, { "category": "Seating", "count": 2 }] }
```

#### `POST /api/store/products` (shop_owner)

```json
{
  "name": "Arc Counter Stool",
  "description": "Powder-coated steel and oak.",
  "price_minor": 7800000,
  "stock": 8,
  "emoji": "🪑",
  "image_url": "https://…",
  "category": "Seating",
  "currency": "NGN"
}
```

Returns the product (`201`). `PUT /api/store/products/{pid}` uses the same body;
`DELETE` returns `{ "id": "prd_…", "deleted": true }`.

### Orders

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/orders` | customer | Reserve stock and create an order |
| GET | `/orders` | customer | Own orders (latest 50) |
| GET | `/orders/{oid}` | customer | One own order |
| POST | `/orders/{oid}/pay` | customer | Pay with card/wallet/bank |
| POST | `/orders/{oid}/authenticate` | customer | Complete a 3-D Secure OTP challenge |
| POST | `/orders/{oid}/simulate-settle` | customer | Settle a processing wallet/bank payment |
| POST | `/orders/{oid}/cancel` | customer | Cancel an unpaid order; restores stock |
| POST | `/orders/{oid}/refund` | shop_owner | Refund a paid order |

#### `POST /api/store/orders`

```json
{
  "items": [{ "product_id": "prd_…", "quantity": 1 }],
  "shipping": {
    "name": "Ada Obi",
    "address": "12 Marina Road, Lagos Island, Lagos",
    "phone": "08012345678"
  }
}
```

Creates a payment intent, reserves stock, and returns `201` with the order in
`pending_payment`:

```json
{
  "id": "ord_…",
  "status": "pending_payment",
  "total_minor": 7800000,
  "currency": "NGN",
  "created_at": "2026-10-22T15:20:00Z",
  "items": [{ "product_id": "prd_…", "name": "Arc Counter Stool", "unit_minor": 7800000, "quantity": 1 }],
  "shipping": { "name": "Ada Obi", "address": "…", "phone": "08012345678" },
  "payment": {
    "id": "pi_…", "status": "requires_payment_method", "amount": 7800000,
    "currency": "NGN", "payment_method": null, "next_action": null
  }
}
```

Own products cannot be bought (`422 own_product`), mixed currencies are rejected
(`422 mixed_currency`), and insufficient stock returns `409 out_of_stock`.

#### `POST /api/store/orders/{oid}/pay`

Body is the payment method:

```json
{ "payment_method": { "type": "card", "number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123" } }
```

```json
{ "payment_method": { "type": "wallet", "phone": "+2348000000001" } }
```

```json
{ "payment_method": { "type": "bank_transfer" } }
```

Response is the updated order. Possible outcomes:

| Scenario | Order status | Payment status |
|---|---|---|
| Approved card | `paid` | `succeeded` |
| Declined card | `payment_failed` | `failed` |
| 3-D Secure card | `pending_payment` | `requires_action` |
| Successful wallet | `paid` | `succeeded` |
| Pending wallet/bank | `pending_payment` | `processing` |

#### `POST /api/store/orders/{oid}/authenticate`

```json
{ "otp": "123456" }
```

Only valid while the payment is `requires_action`. Correct OTP marks the order
`paid`; three wrong attempts fail the payment.

#### `POST /api/store/orders/{oid}/simulate-settle`

Sandbox-only shortcut for `processing` payments:

```json
{ "outcome": "succeeded" }
```

Use `"failed"` to simulate a failed bank transfer or wallet timeout.

#### `POST /api/store/orders/{oid}/cancel`

No body. Only `pending_payment` and `payment_failed` orders can be canceled.
Cancels the payment intent, restores reserved stock, and returns `status: "canceled"`.

#### `POST /api/store/orders/{oid}/refund` (shop_owner)

No request body. A shop owner may refund only an order where **every item**
belongs to them. The refund is always for the full order. A fully refunded
order becomes `refunded` and its stock is restored.

### Seller/admin

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/seller/orders` | shop_owner | Sales lines for this seller |
| GET | `/seller/summary` | shop_owner | Revenue/refund counts |
| GET | `/admin/orders` | superuser | All orders |
| GET | `/admin/products` | superuser | All products including inactive |
| PUT | `/admin/products/{pid}` | superuser | Update any product |
| DELETE | `/admin/products/{pid}` | superuser | Soft-delete any product |

`GET /api/store/seller/orders` returns:

```json
{
  "data": [{
    "order_id": "ord_…", "name": "Arc Counter Stool", "quantity": 1,
    "unit_minor": 7800000, "status": "paid", "currency": "NGN",
    "created_at": "…", "buyer": "Ada", "ship_to": "Ada Obi"
  }]
}
```

`ship_to` is intentionally `null` until the order is paid.

---

## 4. Sandbox payment engine — `/sandbox/v1`

These are the lower-level gateway endpoints. The shop UI uses the order
endpoints above, but they are useful for API testing and for building another
client.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/test-cards` | public | Documented cards, wallets, OTP and limits |
| POST | `/payment_intents` | API key/session | Create an intent |
| GET | `/payment_intents?limit=25` | API key/session | List intents |
| GET | `/payment_intents/{iid}` | API key/session | Retrieve an intent |
| POST | `/payment_intents/{iid}/confirm` | API key/session | Confirm a payment method |
| POST | `/payment_intents/{iid}/authenticate` | API key/session | Submit 3-D Secure OTP |
| POST | `/payment_intents/{iid}/cancel` | API key/session | Cancel an intent |
| POST | `/refunds` | API key/session | Refund a succeeded intent |
| GET | `/refunds/{rid}` | API key/session | Retrieve a refund |
| POST | `/simulate/payment_intents/{iid}/settle` | API key/session | Settle a processing intent |
| POST | `/webhook_endpoints` | API key/session | Register a webhook |
| GET | `/webhook_endpoints` | API key/session | List webhooks |
| DELETE | `/webhook_endpoints/{wid}` | API key/session | Delete a webhook |
| GET | `/events?limit=25` | API key/session | List emitted events and deliveries |
| POST | `/events/{eid}/resend` | API key/session | Requeue webhook deliveries |
| POST | `/webhook-sink/{wid}` | signature | Built-in webhook verification sink |

### `GET /sandbox/v1/test-cards`

Public and safe to call from the browser. Returns arrays of `cards` and
`wallets`, the OTP (`123456`), event types, and amount/currency rules.

### `POST /sandbox/v1/payment_intents`

```json
{ "amount": 500000, "currency": "NGN", "description": "Test charge", "metadata": { "order_id": "ord_…" } }
```

Supports `Idempotency-Key` header. Auth is either a sandbox secret key
(`Authorization: Bearer sbx_sk_…`) or a normal session token.

### `POST /sandbox/v1/payment_intents/{iid}/confirm`

```json
{ "payment_method": { "type": "card", "number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123" } }
```

`POST /simulate/payment_intents/{iid}/settle` takes `{ "outcome": "succeeded" | "failed" }`.

### Developer keys

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/developer/keys` | session | Roll and reveal a sandbox secret key once |
| GET | `/api/developer/keys` | session | List key hints (never the secret) |

---

## 5. Test payment data

### Cards

| Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | Approved |
| `5555 5555 5555 4444` | Approved (Mastercard) |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 9979` | Stolen card |
| `4000 0000 0000 3220` | 3-D Secure, OTP `123456` |

Use any future expiry (`12/30`) and any 3-digit CVC (`123`).

### Wallets

| Phone | Scenario |
|---|---|
| `+2348000000001` | Instant approval |
| `+2348000000002` | Insufficient balance |
| `+2348000000003` | Pending; settle with the simulator |
| `+2348000000004` | Timeout |

### Bank transfer

1. Pay with `{"type":"bank_transfer"}`.
2. Read the sandbox account details from `order.payment.next_action`.
3. `POST /api/store/orders/{oid}/simulate-settle` with `{"outcome":"succeeded"}`.

---

## 6. End-to-end buy sequence

```
POST /api/auth/login                         -> access_token
GET  /api/store/products?category=Seating    -> product ids
POST /api/store/orders                        -> pending_payment + payment intent
POST /api/store/orders/{oid}/pay              -> paid | payment_failed | requires_action | processing
POST /api/store/orders/{oid}/authenticate     -> paid (only for 3-D Secure)
POST /api/store/orders/{oid}/simulate-settle  -> paid | payment_failed (wallet/bank)
GET  /api/store/orders/{oid}                  -> receipt state
POST /api/store/orders/{oid}/cancel           -> canceled + stock restored
```

The browser stores the session token in `localStorage` (remember me) or
`sessionStorage` (tab only). The bag is stored under `still_bag_v1`; delivery
details under `still_delivery_v1`.
