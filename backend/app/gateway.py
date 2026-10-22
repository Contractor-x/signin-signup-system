"""Public sandbox payment API  ->  /sandbox/v1/*

Auth: `Authorization: Bearer sbx_sk_...` (create a key under /api/developer/keys).
The dashboard may also use a normal login session token against the same routes.
"""

import hmac
import json
import time
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from pydantic import BaseModel, Field

from . import payments, webhooks
from .db import audit
from .deps import DB, bearer, user_from_session
from .errors import ApiError
from .security import new_id, new_token, sha256, sign_webhook

router = APIRouter(prefix="/sandbox/v1", tags=["sandbox gateway"])


def merchant(db: DB, authorization: Annotated[str | None, Header()] = None) -> str:
    try:
        token = bearer(authorization)
    except Exception:
        raise ApiError(401, "missing_api_key", "Provide 'Authorization: Bearer sbx_sk_...'")
    if token.startswith(("live_", "sk_live", "sbx_live")):
        raise ApiError(403, "live_mode_unavailable", "Live keys are not accepted. This server only runs in sandbox mode.")
    if token.startswith("sbx_sk_"):
        row = db.execute("SELECT user_id FROM api_keys WHERE key_hash=? AND revoked=0", (sha256(token),)).fetchone()
        if row:
            return row["user_id"]
    elif (u := user_from_session(db, token)):
        return u["id"]
    raise ApiError(401, "invalid_api_key", "Invalid or revoked API key")


Merchant = Annotated[str, Depends(merchant)]


def _queue(db, bg: BackgroundTasks) -> None:
    """Commit first so the delivery worker (own connection) can see and lock the rows."""
    db.commit()
    bg.add_task(webhooks.dispatch_pending)


# ------------------------------------------------------------------ models
class CreateIntent(BaseModel):
    amount: int
    currency: str = "NGN"
    description: str | None = Field(None, max_length=500)
    metadata: dict[str, str] = {}


class PaymentMethod(BaseModel):
    type: str  # "card" | "wallet" | "bank_transfer"
    number: str | None = None
    exp_month: int | str | None = None
    exp_year: int | str | None = None
    cvc: str | None = None
    phone: str | None = None
    channel: str = "ussd"


class Confirm(BaseModel):
    payment_method: PaymentMethod


class Authenticate(BaseModel):
    otp: str


class RefundReq(BaseModel):
    payment_intent: str
    amount: int | None = None
    reason: str | None = Field(None, max_length=200)


class Settle(BaseModel):
    outcome: str  # "succeeded" | "failed"


class EndpointReq(BaseModel):
    url: str
    events: list[str] = ["*"]


EVENT_TYPES = ["payment.intent.created", "payment.intent.requires_action", "payment.intent.succeeded",
               "payment.intent.failed", "payment.intent.canceled", "refund.processed"]


def _idempotent(db, mid: str, route: str, key: str | None, produce):
    """Replay the stored response when the same Idempotency-Key is reused."""
    if not key:
        return produce()
    row = db.execute("SELECT response FROM idempotency WHERE merchant_id=? AND route=? AND key=?", (mid, route, key)).fetchone()
    if row:
        return json.loads(row["response"])
    out = produce()
    db.execute("INSERT INTO idempotency VALUES(?,?,?,?)", (mid, route, key, json.dumps(out)))
    return out


# ------------------------------------------------------------ public test data
@router.get("/test-cards")
def test_data():
    """No auth needed: everything a developer needs to simulate scenarios."""
    return {
        "is_test_mode": True,
        "cards": [{"number": n, "brand": b, "outcome": o, "description": d, "cvc": "any 3 digits", "expiry": "any future date"}
                  for n, (b, o, d) in payments.TEST_CARDS.items()],
        "wallets": [{"phone": p, "outcome": o, "description": d} for p, (o, d) in payments.TEST_WALLETS.items()],
        "otp": payments.OTP_CODE,
        "bank_transfer": "Confirm with type=bank_transfer, then POST /sandbox/v1/simulate/payment_intents/{id}/settle",
        "event_types": EVENT_TYPES,
        "amount_rules": {"unit": "minor units (kobo/cents)", "min": payments.MIN_AMOUNT, "max": payments.MAX_AMOUNT,
                         "currencies": sorted(payments.CURRENCIES)},
    }


# -------------------------------------------------------------- payment intents
@router.post("/payment_intents", status_code=201)
def create_intent(body: CreateIntent, db: DB, mid: Merchant, bg: BackgroundTasks,
                  idempotency_key: Annotated[str | None, Header()] = None):
    out = _idempotent(db, mid, "pi.create", idempotency_key,
                      lambda: payments.create_intent(db, mid, body.amount, body.currency, body.description, body.metadata))
    _queue(db, bg)
    return out


@router.get("/payment_intents")
def list_intents(db: DB, mid: Merchant, limit: int = 25):
    rows = db.execute("SELECT * FROM payment_intents WHERE merchant_id=? ORDER BY rowid DESC LIMIT ?", (mid, min(limit, 100))).fetchall()
    return {"object": "list", "data": [payments.public_intent(r) for r in rows]}


@router.get("/payment_intents/{iid}")
def get_intent(iid: str, db: DB, mid: Merchant):
    return payments.public_intent(payments.get_intent(db, mid, iid))


@router.post("/payment_intents/{iid}/confirm")
def confirm(iid: str, body: Confirm, db: DB, mid: Merchant, bg: BackgroundTasks):
    out = payments.confirm_intent(db, mid, iid, body.payment_method.model_dump())
    _queue(db, bg)
    return out


@router.post("/payment_intents/{iid}/authenticate")
def authenticate(iid: str, body: Authenticate, db: DB, mid: Merchant, bg: BackgroundTasks):
    out = payments.authenticate_intent(db, mid, iid, body.otp)
    _queue(db, bg)
    return out


@router.post("/payment_intents/{iid}/cancel")
def cancel(iid: str, db: DB, mid: Merchant, bg: BackgroundTasks):
    out = payments.cancel_intent(db, mid, iid)
    _queue(db, bg)
    return out


# --------------------------------------------------------------------- refunds
@router.post("/refunds", status_code=201)
def refund(body: RefundReq, db: DB, mid: Merchant, bg: BackgroundTasks,
           idempotency_key: Annotated[str | None, Header()] = None):
    out = _idempotent(db, mid, "refund.create", idempotency_key,
                      lambda: payments.create_refund(db, mid, body.payment_intent, body.amount, body.reason))
    _queue(db, bg)
    return out


@router.get("/refunds/{rid}")
def get_refund(rid: str, db: DB, mid: Merchant):
    row = db.execute("SELECT * FROM refunds WHERE id=? AND merchant_id=?", (rid, mid)).fetchone()
    if not row:
        raise ApiError(404, "resource_missing", "No such refund")
    return payments.public_refund(row)


# ------------------------------------------------------------------- simulator
@router.post("/simulate/payment_intents/{iid}/settle")
def simulate_settle(iid: str, body: Settle, db: DB, mid: Merchant, bg: BackgroundTasks):
    """Trigger asynchronous outcomes: pending bank clearance / wallet approval."""
    out = payments.settle_intent(db, mid, iid, body.outcome)
    _queue(db, bg)
    return out


# -------------------------------------------------------------------- webhooks
@router.post("/webhook_endpoints", status_code=201)
def add_endpoint(body: EndpointReq, db: DB, mid: Merchant):
    webhooks.validate_url(body.url)
    bad = [e for e in body.events if e != "*" and e not in EVENT_TYPES]
    if bad:
        raise ApiError(422, "invalid_events", f"Unknown event types: {bad}")
    wid, secret = new_id("we"), new_token("whsec_")
    db.execute("INSERT INTO webhook_endpoints(id,merchant_id,url,secret,events) VALUES(?,?,?,?,?)",
               (wid, mid, body.url, secret, ",".join(body.events)))
    audit(db, mid, "webhook_endpoint.create", wid)
    return {"id": wid, "url": body.url, "events": body.events, "secret": secret,
            "note": "Store this signing secret now; it is not shown again."}


@router.get("/webhook_endpoints")
def list_endpoints(db: DB, mid: Merchant):
    rows = db.execute("SELECT id,url,events,created_at FROM webhook_endpoints WHERE merchant_id=?", (mid,)).fetchall()
    return {"object": "list", "data": [dict(r) for r in rows]}


@router.delete("/webhook_endpoints/{wid}")
def delete_endpoint(wid: str, db: DB, mid: Merchant):
    db.execute("DELETE FROM deliveries WHERE endpoint_id=? AND endpoint_id IN (SELECT id FROM webhook_endpoints WHERE merchant_id=?)", (wid, mid))
    cur = db.execute("DELETE FROM webhook_endpoints WHERE id=? AND merchant_id=?", (wid, mid))
    if not cur.rowcount:
        raise ApiError(404, "resource_missing", "No such webhook endpoint")
    return {"id": wid, "deleted": True}


@router.get("/events")
def list_events(db: DB, mid: Merchant, limit: int = 25):
    rows = db.execute("SELECT * FROM events WHERE merchant_id=? ORDER BY rowid DESC LIMIT ?", (mid, min(limit, 100))).fetchall()
    out = []
    for r in rows:
        dl = db.execute("SELECT endpoint_id,status,attempts,response_code,detail FROM deliveries WHERE event_id=?", (r["id"],)).fetchall()
        out.append({**webhooks.payload_dict(r["payload"]), "deliveries": [dict(d) for d in dl]})
    return {"object": "list", "data": out}


@router.post("/events/{eid}/resend")
def resend(eid: str, db: DB, mid: Merchant, bg: BackgroundTasks):
    if not db.execute("SELECT 1 FROM events WHERE id=? AND merchant_id=?", (eid, mid)).fetchone():
        raise ApiError(404, "resource_missing", "No such event")
    db.execute("UPDATE deliveries SET status='pending',attempts=0 WHERE event_id=?", (eid,))
    _queue(db, bg)
    return {"id": eid, "resend": "queued"}


@router.post("/webhook-sink/{wid}")
async def webhook_sink(wid: str, request: Request, db: DB):
    """Built-in demo listener: verifies the HMAC signature of whatever is posted to it."""
    q, args = ("SELECT secret FROM webhook_endpoints", ()) if wid == "auto" else ("SELECT secret FROM webhook_endpoints WHERE id=?", (wid,))
    secrets_ = [r["secret"] for r in db.execute(q, args)]
    body = (await request.body()).decode()
    header = request.headers.get("sandbox-signature", "")
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        ts = int(parts["t"])
    except (ValueError, KeyError):
        raise ApiError(400, "bad_signature_header", "Missing or malformed Sandbox-Signature")
    if not secrets_ or abs(time.time() - ts) > 300:
        raise ApiError(400, "signature_rejected", "Unknown endpoint or timestamp outside tolerance")
    if not any(hmac.compare_digest(sign_webhook(sec, ts, body), header) for sec in secrets_):
        raise ApiError(400, "signature_mismatch", "Signature verification failed")
    return {"received": True, "signature": "verified"}


# --------------------------------------------------------------- developer keys
dev = APIRouter(prefix="/api/developer", tags=["developer"])


@dev.post("/keys", status_code=201)
def roll_key(db: DB, authorization: Annotated[str | None, Header()] = None):
    """Create a sandbox secret key (revokes the previous one). Shown once."""
    u = user_from_session(db, bearer(authorization))
    if not u:
        raise ApiError(401, "unauthorized", "Invalid or expired token")
    db.execute("UPDATE api_keys SET revoked=1 WHERE user_id=?", (u["id"],))
    key = new_token("sbx_sk_")
    db.execute("INSERT INTO api_keys(id,user_id,key_hash,hint) VALUES(?,?,?,?)",
               (new_id("key"), u["id"], sha256(key), key[:12] + "…" + key[-4:]))
    audit(db, u["id"], "api_key.roll")
    return {"secret_key": key, "note": "Shown once. Sandbox only - cannot move real money."}


@dev.get("/keys")
def list_keys(db: DB, authorization: Annotated[str | None, Header()] = None):
    u = user_from_session(db, bearer(authorization))
    if not u:
        raise ApiError(401, "unauthorized", "Invalid or expired token")
    rows = db.execute("SELECT id,hint,revoked,created_at FROM api_keys WHERE user_id=? ORDER BY rowid DESC", (u["id"],)).fetchall()
    return {"data": [dict(r) for r in rows]}
