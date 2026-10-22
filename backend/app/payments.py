"""Sandbox payment engine. Pure business logic - no HTTP concerns.

Everything here is simulated: no real card network, bank or wallet is contacted
and real card numbers are refused (see ``_check_card``).
"""

import json
import re
import sqlite3
from datetime import datetime, timezone

from .errors import ApiError
from .security import luhn_ok, new_id, new_token

CURRENCIES = {"NGN", "GHS", "KES", "USD"}
MIN_AMOUNT, MAX_AMOUNT = 100, 10_000_000_00  # minor units
OTP_CODE = "123456"

# number -> (brand, outcome, label). Outcomes drive the simulator.
TEST_CARDS = {
    "4242424242424242": ("visa", "success", "Approved payment"),
    "5555555555554444": ("mastercard", "success", "Approved payment"),
    "4000000000009995": ("visa", "insufficient_funds", "Insufficient funds"),
    "4000000000000069": ("visa", "expired_card", "Expired card"),
    "4000000000009979": ("visa", "stolen_card", "Stolen card (pick up)"),
    "4000000000003220": ("visa", "requires_3ds", f"3D Secure / OTP challenge (OTP {OTP_CODE})"),
}
TEST_WALLETS = {
    "+2348000000001": ("success", "Instant approval"),
    "+2348000000002": ("insufficient_funds", "Wallet has insufficient balance"),
    "+2348000000003": ("pending", "Pending USSD approval - settle with the simulator"),
    "+2348000000004": ("timeout", "Customer never responds (timeout)"),
}
FAILURES = {
    "insufficient_funds": "The account has insufficient funds.",
    "expired_card": "The card has expired.",
    "stolen_card": "The card was reported stolen. Do not retry.",
    "wallet_timeout": "The customer did not approve the request in time.",
    "bank_transfer_failed": "The transfer was not received.",
    "otp_failed": "Too many incorrect OTP attempts.",
}

HOOKS: list = []  # in-process listeners: fn(db, merchant_id, event_type, obj)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- serializers
def public_intent(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "object": "payment_intent",
        "amount": row["amount"],
        "currency": row["currency"],
        "status": row["status"],
        "description": row["description"],
        "metadata": json.loads(row["metadata"] or "{}"),
        "payment_method": json.loads(row["payment_method"]) if row["payment_method"] else None,
        "failure_code": row["failure_code"],
        "failure_message": row["failure_message"],
        "next_action": json.loads(row["next_action"]) if row["next_action"] else None,
        "amount_refunded": row["amount_refunded"],
        "client_secret": row["client_secret"],
        "created_at": row["created_at"],
        "livemode": False,
        "is_test_mode": True,
    }


def public_refund(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "object": "refund",
        "payment_intent": row["intent_id"],
        "amount": row["amount"],
        "status": row["status"],
        "reason": row["reason"],
        "created_at": row["created_at"],
        "livemode": False,
        "is_test_mode": True,
    }


def get_intent(db, merchant_id: str, intent_id: str) -> sqlite3.Row:
    row = db.execute(
        "SELECT * FROM payment_intents WHERE id=? AND merchant_id=?", (intent_id, merchant_id)
    ).fetchone()
    if not row:
        raise ApiError(404, "resource_missing", "No such payment_intent")
    return row


# ---------------------------------------------------------------------- events
def emit(db, merchant_id: str, etype: str, obj: dict) -> None:
    """Persist an event, queue webhook deliveries, run in-process hooks."""
    eid = new_id("evt")
    payload = json.dumps(
        {
            "id": eid,
            "type": etype,
            "created_at": _now(),
            "livemode": False,
            "is_test_mode": True,
            "data": {"object": obj},
        }
    )
    db.execute("INSERT INTO events(id,merchant_id,type,payload) VALUES(?,?,?,?)", (eid, merchant_id, etype, payload))
    for ep in db.execute("SELECT * FROM webhook_endpoints WHERE merchant_id=?", (merchant_id,)):
        wanted = ep["events"].split(",")
        if "*" in wanted or etype in wanted:
            db.execute("INSERT INTO deliveries(id,event_id,endpoint_id) VALUES(?,?,?)", (new_id("dlv"), eid, ep["id"]))
    for hook in HOOKS:
        hook(db, merchant_id, etype, obj)


def _save(db, intent_id: str, **fields) -> sqlite3.Row:
    cols = ", ".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE payment_intents SET {cols} WHERE id=?", (*fields.values(), intent_id))
    return db.execute("SELECT * FROM payment_intents WHERE id=?", (intent_id,)).fetchone()


# ------------------------------------------------------------------ lifecycle
def create_intent(db, merchant_id: str, amount: int, currency: str = "NGN",
                  description: str | None = None, metadata: dict | None = None) -> dict:
    currency = currency.upper()
    if currency not in CURRENCIES:
        raise ApiError(422, "invalid_currency", f"Supported currencies: {', '.join(sorted(CURRENCIES))}")
    if not MIN_AMOUNT <= amount <= MAX_AMOUNT:
        raise ApiError(422, "invalid_amount", f"amount must be an integer of minor units between {MIN_AMOUNT} and {MAX_AMOUNT}")
    metadata = metadata or {}
    if len(metadata) > 20 or any(len(str(k)) > 40 or len(str(v)) > 500 for k, v in metadata.items()):
        raise ApiError(422, "invalid_metadata", "metadata: max 20 keys, 40-char keys, 500-char values")
    iid = new_id("pi")
    db.execute(
        "INSERT INTO payment_intents(id,merchant_id,amount,currency,status,description,metadata,client_secret) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (iid, merchant_id, amount, currency, "requires_payment_method", description,
         json.dumps(metadata), f"{iid}_secret_{new_token()[:16]}"),
    )
    obj = public_intent(db.execute("SELECT * FROM payment_intents WHERE id=?", (iid,)).fetchone())
    emit(db, merchant_id, "payment.intent.created", obj)
    return obj


def _check_card(m: dict) -> tuple[str, str, str, int, int]:
    """Validate a card. Returns (brand, outcome, last4, month, year)."""
    number = re.sub(r"[\s-]", "", str(m.get("number") or ""))
    cvc = str(m.get("cvc") or "")
    try:
        month, year = int(m.get("exp_month")), int(m.get("exp_year"))
    except (TypeError, ValueError):
        raise ApiError(422, "invalid_expiry", "exp_month and exp_year are required")
    if year < 100:
        year += 2000
    if not 1 <= month <= 12:
        raise ApiError(422, "invalid_expiry", "exp_month must be 1-12")
    if not re.fullmatch(r"\d{3,4}", cvc):
        raise ApiError(422, "invalid_cvc", "cvc must be 3 or 4 digits")
    if number not in TEST_CARDS:
        if luhn_ok(number):
            # Ethical guard: never process what could be a real card.
            raise ApiError(422, "real_card_rejected",
                           "This is a sandbox. Real card numbers are refused - use a documented test card.")
        raise ApiError(422, "invalid_card_number", "Card number is invalid. See GET /sandbox/v1/test-cards.")
    brand, outcome, _ = TEST_CARDS[number]
    today = datetime.now(timezone.utc)
    if (year, month) < (today.year, today.month):
        outcome = "expired_card"
    return brand, outcome, number[-4:], month, year


def normalize_phone(raw: str) -> str:
    p = re.sub(r"[\s-]", "", raw or "")
    return "+234" + p[1:] if p.startswith("0") else p


def confirm_intent(db, merchant_id: str, intent_id: str, method: dict) -> dict:
    row = get_intent(db, merchant_id, intent_id)
    if row["status"] not in ("requires_payment_method", "failed"):
        raise ApiError(409, "invalid_state", f"Cannot confirm a payment_intent in status '{row['status']}'")
    mtype = method.get("type")
    action = None
    if mtype == "card":
        brand, outcome, last4, mo, yr = _check_card(method)
        pm = {"type": "card", "brand": brand, "last4": last4, "exp_month": mo, "exp_year": yr}
    elif mtype == "wallet":
        phone = normalize_phone(method.get("phone", ""))
        if phone not in TEST_WALLETS:
            raise ApiError(422, "unknown_test_wallet", "Unknown sandbox wallet. See GET /sandbox/v1/test-cards.")
        outcome = TEST_WALLETS[phone][0]
        pm = {"type": "wallet", "phone_last4": phone[-4:], "channel": method.get("channel", "ussd")}
    elif mtype == "bank_transfer":
        outcome = "pending"
        acct = "9" + str(int(intent_id[3:11], 16) % 10**9).zfill(9)
        pm = {"type": "bank_transfer"}
        action = {"type": "bank_transfer_instructions", "bank_name": "Sandbox Bank",
                  "account_number": acct, "account_name": "SANDBOX PAY LTD", "amount": row["amount"]}
    else:
        raise ApiError(422, "invalid_payment_method", "payment_method.type must be card, wallet or bank_transfer")
    return _apply(db, row, outcome, pm, action)


def _apply(db, row, outcome: str, pm: dict, action: dict | None = None) -> dict:
    mid, base = row["merchant_id"], {"payment_method": json.dumps(pm), "failure_code": None, "failure_message": None}
    if outcome == "success":
        new = _save(db, row["id"], status="succeeded", next_action=None, **base)
        etype = "payment.intent.succeeded"
    elif outcome == "requires_3ds":
        new = _save(db, row["id"], status="requires_action", next_action=json.dumps({"type": "otp_challenge", "attempts": 0}), **base)
        etype = "payment.intent.requires_action"
    elif outcome == "pending":
        action = action or {"type": "await_customer_approval"}
        new = _save(db, row["id"], status="processing", next_action=json.dumps(action), **base)
        etype = None  # async: final event fires on settlement
    else:
        code = "wallet_timeout" if outcome == "timeout" else outcome
        base.update(failure_code=code, failure_message=FAILURES.get(code, "Payment failed."))
        new = _save(db, row["id"], status="failed", next_action=None, **base)
        etype = "payment.intent.failed"
    obj = public_intent(new)
    if etype:
        emit(db, mid, etype, obj)
    return obj


def authenticate_intent(db, merchant_id: str, intent_id: str, otp: str) -> dict:
    row = get_intent(db, merchant_id, intent_id)
    if row["status"] != "requires_action":
        raise ApiError(409, "invalid_state", "payment_intent is not awaiting authentication")
    na = json.loads(row["next_action"])
    pm = json.loads(row["payment_method"])
    if otp == OTP_CODE:
        return _apply(db, row, "success", pm)
    na["attempts"] += 1
    if na["attempts"] >= 3:
        return _apply(db, row, "otp_failed", pm)
    _save(db, row["id"], next_action=json.dumps(na))
    raise ApiError(422, "otp_incorrect", f"Incorrect OTP ({3 - na['attempts']} attempts left)")


def settle_intent(db, merchant_id: str, intent_id: str, outcome: str) -> dict:
    """Simulator: resolve an async (processing) payment."""
    row = get_intent(db, merchant_id, intent_id)
    if row["status"] != "processing":
        raise ApiError(409, "invalid_state", "Only 'processing' payments can be settled")
    pm = json.loads(row["payment_method"])
    if outcome == "succeeded":
        return _apply(db, row, "success", pm)
    return _apply(db, row, "bank_transfer_failed" if pm["type"] == "bank_transfer" else "timeout", pm)


def cancel_intent(db, merchant_id: str, intent_id: str) -> dict:
    row = get_intent(db, merchant_id, intent_id)
    if row["status"] in ("succeeded", "canceled"):
        raise ApiError(409, "invalid_state", f"Cannot cancel a payment_intent in status '{row['status']}'")
    new = _save(db, row["id"], status="canceled", next_action=None)
    obj = public_intent(new)
    emit(db, merchant_id, "payment.intent.canceled", obj)
    return obj


def create_refund(db, merchant_id: str, intent_id: str, amount: int | None = None, reason: str | None = None) -> dict:
    row = get_intent(db, merchant_id, intent_id)
    if row["status"] != "succeeded":
        raise ApiError(409, "invalid_state", "Only succeeded payments can be refunded")
    remaining = row["amount"] - row["amount_refunded"]
    amount = remaining if amount is None else amount
    if not 0 < amount <= remaining:
        raise ApiError(422, "invalid_amount", f"Refund must be between 1 and {remaining}")
    rid = new_id("re")
    db.execute("INSERT INTO refunds(id,merchant_id,intent_id,amount,status,reason) VALUES(?,?,?,?,?,?)",
               (rid, merchant_id, intent_id, amount, "succeeded", reason))
    new = _save(db, intent_id, amount_refunded=row["amount_refunded"] + amount)
    refund = public_refund(db.execute("SELECT * FROM refunds WHERE id=?", (rid,)).fetchone())
    refund["payment_intent_object"] = public_intent(new)
    emit(db, merchant_id, "refund.processed", refund)
    return refund
