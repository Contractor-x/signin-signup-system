import json

import pytest

from app import webhooks
from app.security import sign_webhook

CARD = {"type": "card", "exp_month": 12, "exp_year": 2030, "cvc": "123"}


@pytest.fixture
def merchant(client, make_user):
    h, u = make_user("merch")
    key = client.post("/api/developer/keys", headers=h).json()["secret_key"]
    return {"Authorization": f"Bearer {key}"}


def pay(client, h, number, amount=500000, **extra):
    pi = client.post("/sandbox/v1/payment_intents", headers=h, json={"amount": amount}).json()
    r = client.post(f"/sandbox/v1/payment_intents/{pi['id']}/confirm", headers=h,
                    json={"payment_method": {**CARD, "number": number, **extra}})
    return pi["id"], r


def test_every_response_is_flagged_test_mode(client, merchant):
    r = client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 100000})
    assert r.status_code == 201 and r.headers["x-sandbox-mode"] == "test"
    assert r.json()["is_test_mode"] is True and r.json()["livemode"] is False


def test_live_keys_and_bad_keys_rejected(client):
    assert client.get("/sandbox/v1/payment_intents", headers={"Authorization": "Bearer live_abc"}).json()["error"]["code"] == "live_mode_unavailable"
    assert client.get("/sandbox/v1/payment_intents", headers={"Authorization": "Bearer sbx_sk_nope"}).status_code == 401


@pytest.mark.parametrize("number,status,code", [
    ("4242424242424242", "succeeded", None),
    ("5555555555554444", "succeeded", None),
    ("4000000000009995", "failed", "insufficient_funds"),
    ("4000000000000069", "failed", "expired_card"),
    ("4000000000009979", "failed", "stolen_card"),
    ("4000000000003220", "requires_action", None),
])
def test_test_cards(client, merchant, number, status, code):
    _, r = pay(client, merchant, number)
    assert r.status_code == 200 and r.json()["status"] == status and r.json()["failure_code"] == code


def test_past_expiry_fails_as_expired(client, merchant):
    pi = client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 100000}).json()
    r = client.post(f"/sandbox/v1/payment_intents/{pi['id']}/confirm", headers=merchant,
                    json={"payment_method": {**CARD, "number": "4242424242424242", "exp_year": 2020}})
    assert r.json()["failure_code"] == "expired_card"


def test_real_looking_cards_are_refused_and_never_stored(client, merchant):
    pid, r = pay(client, merchant, "4111111111111111")  # Luhn-valid, not a test card
    assert r.status_code == 422 and r.json()["error"]["code"] == "real_card_rejected"
    _, r = pay(client, merchant, "1234567890123456")
    assert r.json()["error"]["code"] == "invalid_card_number"
    stored = client.get(f"/sandbox/v1/payment_intents/{pid}", headers=merchant).text
    assert "4111" not in stored and "cvc" not in stored


def test_3ds_otp_flow(client, merchant):
    pid, _ = pay(client, merchant, "4000000000003220")
    bad = client.post(f"/sandbox/v1/payment_intents/{pid}/authenticate", headers=merchant, json={"otp": "000000"})
    assert bad.json()["error"]["code"] == "otp_incorrect"
    ok = client.post(f"/sandbox/v1/payment_intents/{pid}/authenticate", headers=merchant, json={"otp": "123456"})
    assert ok.json()["status"] == "succeeded"


def test_failed_payment_can_be_retried(client, merchant):
    pid, _ = pay(client, merchant, "4000000000009995")
    r = client.post(f"/sandbox/v1/payment_intents/{pid}/confirm", headers=merchant,
                    json={"payment_method": {**CARD, "number": "4242424242424242"}})
    assert r.json()["status"] == "succeeded"
    again = client.post(f"/sandbox/v1/payment_intents/{pid}/confirm", headers=merchant,
                        json={"payment_method": {**CARD, "number": "4242424242424242"}})
    assert again.status_code == 409


def test_wallet_and_bank_async_states(client, merchant):
    mk = lambda: client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 250000}).json()["id"]
    for phone, expect in [("+2348000000001", "succeeded"), ("08000000002", "failed"), ("+2348000000004", "failed")]:
        pid = mk()
        r = client.post(f"/sandbox/v1/payment_intents/{pid}/confirm", headers=merchant,
                        json={"payment_method": {"type": "wallet", "phone": phone}})
        assert r.json()["status"] == expect
    pid = mk()
    r = client.post(f"/sandbox/v1/payment_intents/{pid}/confirm", headers=merchant, json={"payment_method": {"type": "wallet", "phone": "+2348000000003"}})
    assert r.json()["status"] == "processing"
    s = client.post(f"/sandbox/v1/simulate/payment_intents/{pid}/settle", headers=merchant, json={"outcome": "succeeded"})
    assert s.json()["status"] == "succeeded"
    pid = mk()
    r = client.post(f"/sandbox/v1/payment_intents/{pid}/confirm", headers=merchant, json={"payment_method": {"type": "bank_transfer"}})
    assert r.json()["status"] == "processing" and r.json()["next_action"]["account_number"]
    s = client.post(f"/sandbox/v1/simulate/payment_intents/{pid}/settle", headers=merchant, json={"outcome": "failed"})
    assert s.json()["failure_code"] == "bank_transfer_failed"


def test_refunds_partial_full_and_limits(client, merchant):
    pid, _ = pay(client, merchant, "4242424242424242", amount=100000)
    r1 = client.post("/sandbox/v1/refunds", headers=merchant, json={"payment_intent": pid, "amount": 40000})
    assert r1.status_code == 201 and r1.json()["status"] == "succeeded"
    too_much = client.post("/sandbox/v1/refunds", headers=merchant, json={"payment_intent": pid, "amount": 70000})
    assert too_much.json()["error"]["code"] == "invalid_amount"
    client.post("/sandbox/v1/refunds", headers=merchant, json={"payment_intent": pid})  # rest
    assert client.get(f"/sandbox/v1/payment_intents/{pid}", headers=merchant).json()["amount_refunded"] == 100000


def test_idempotency_key_replays(client, merchant):
    h = {**merchant, "Idempotency-Key": "order-42"}
    a = client.post("/sandbox/v1/payment_intents", headers=h, json={"amount": 100000}).json()
    b = client.post("/sandbox/v1/payment_intents", headers=h, json={"amount": 100000}).json()
    assert a["id"] == b["id"]


def test_amount_validation_and_merchant_isolation(client, merchant, make_user):
    assert client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 5}).status_code == 422
    assert client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 1000, "currency": "XXX"}).status_code == 422
    pid = client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 100000}).json()["id"]
    h2, _ = make_user("other")
    assert client.get(f"/sandbox/v1/payment_intents/{pid}", headers=h2).status_code == 404


def test_webhooks_signed_and_public_hosts_blocked(client, merchant, monkeypatch):
    blocked = client.post("/sandbox/v1/webhook_endpoints", headers=merchant, json={"url": "http://93.184.216.34/hook"})
    assert blocked.json()["error"]["code"] == "public_host_blocked"
    ep = client.post("/sandbox/v1/webhook_endpoints", headers=merchant, json={"url": "http://127.0.0.1:9999/hook", "events": ["payment.intent.succeeded"]}).json()
    seen = []
    monkeypatch.setattr(webhooks, "_post", lambda url, headers, body: (seen.append((headers, body)) or (200, "ok")))
    pay(client, merchant, "4242424242424242")
    assert len(seen) == 1  # only the subscribed event type was delivered
    headers, body = seen[0]
    ts = int(headers["Sandbox-Signature"].split(",")[0][2:])
    assert headers["Sandbox-Signature"] == sign_webhook(ep["secret"], ts, body)  # HMAC verifies
    assert json.loads(body)["type"] == "payment.intent.succeeded"


def test_webhook_failure_is_recorded_and_resendable(client, merchant, monkeypatch):
    client.post("/sandbox/v1/webhook_endpoints", headers=merchant, json={"url": "http://127.0.0.1:9999/hook"})
    monkeypatch.setattr(webhooks, "_post", lambda *a: (500, "boom"))
    client.post("/sandbox/v1/payment_intents", headers=merchant, json={"amount": 100000})
    ev = client.get("/sandbox/v1/events", headers=merchant).json()["data"][0]
    assert ev["deliveries"][0]["response_code"] == 500 and ev["deliveries"][0]["status"] == "pending"
    monkeypatch.setattr(webhooks, "_post", lambda *a: (200, "ok"))
    client.post(f"/sandbox/v1/events/{ev['id']}/resend", headers=merchant)
    assert client.get("/sandbox/v1/events", headers=merchant).json()["data"][0]["deliveries"][0]["status"] == "delivered"


def test_public_test_data(client):
    d = client.get("/sandbox/v1/test-cards").json()
    assert len(d["cards"]) == 6 and d["otp"] == "123456"
