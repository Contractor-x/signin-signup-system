"""Webhook delivery with HMAC signatures. Targets are restricted to local/private hosts."""

import ipaddress
import json
import socket
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

from .db import tx
from .errors import ApiError
from .security import sign_webhook

MAX_ATTEMPTS = 3


def validate_url(url: str) -> None:
    """Ethics/safety: the sandbox must never POST payment data to the public internet."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ApiError(422, "invalid_url", "Webhook URL must be http(s)://host[:port]/path")
    try:
        ip = ipaddress.ip_address(socket.gethostbyname(p.hostname))
    except OSError:
        raise ApiError(422, "invalid_url", "Webhook host could not be resolved")
    if not (ip.is_loopback or ip.is_private or ip.is_link_local):
        raise ApiError(422, "public_host_blocked", "Sandbox webhooks may only target localhost or private-network hosts")


def _post(url: str, headers: dict, body: str) -> tuple[int, str]:
    req = urllib.request.Request(url, data=body.encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:  # noqa: S310 (host validated)
            return r.status, r.read(500).decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read(500).decode(errors="replace")
    except Exception:  # connection refused, timeout...
        return 0, "connection failed"


def dispatch_pending() -> int:
    """Send every pending delivery once. Run as a background task after each request."""
    with tx() as db:
        jobs = db.execute(
            "SELECT d.id did, d.attempts, e.id eid, e.payload, w.url, w.secret FROM deliveries d "
            "JOIN events e ON e.id=d.event_id JOIN webhook_endpoints w ON w.id=d.endpoint_id "
            "WHERE d.status='pending'"
        ).fetchall()
    sent = 0
    for j in jobs:
        ts = int(time.time())
        headers = {
            "Content-Type": "application/json", "Sandbox-Event-Id": j["eid"],
            "Sandbox-Signature": sign_webhook(j["secret"], ts, j["payload"]),
        }
        code, detail = _post(j["url"], headers, j["payload"])
        attempts = j["attempts"] + 1
        ok = 200 <= code < 300
        status = "delivered" if ok else ("pending" if attempts < MAX_ATTEMPTS else "failed")
        with tx() as db:
            db.execute("UPDATE deliveries SET status=?,attempts=?,response_code=?,detail=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
                       (status, attempts, code, detail, j["did"]))
        sent += 1
    return sent


def payload_dict(payload: str) -> dict:
    return json.loads(payload)
