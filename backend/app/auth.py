"""Account endpoints (same contract as the original Supabase version).

Roles: ``customer`` (default on signup), ``shop_owner``, ``superuser``.
Only a superuser can grant ``shop_owner`` / ``superuser`` roles.
"""

import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from .config import settings, ROLES
from .db import PLATFORM_ID, audit
from .deps import DB, CurrentUser, bearer, now_iso, Superuser
from .security import hash_password, new_id, new_token, sha256, verify_password

log = logging.getLogger("auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_fails: dict[str, list[float]] = {}  # in-memory brute-force limiter (per email)
MAX_FAILS, WINDOW = 5, 300


class SignupRequest(BaseModel):
    email: str
    password: str
    username: str = Field(min_length=3, max_length=30)


class SignupAsRequest(BaseModel):
    """Superuser-only: create an account with a specific role."""
    email: str
    password: str
    username: str = Field(min_length=3, max_length=30)
    role: str = "customer"


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _future(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _start_session(db, user_id: str) -> str:
    token = new_token()
    db.execute(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
        (sha256(token), user_id, _future(settings.SESSION_TTL_HOURS)),
    )
    return token


def _check_password_rules(pw: str) -> None:
    if len(pw) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if len(pw) > 128:
        raise HTTPException(400, "Password is too long")


@router.post("/signup")
def signup(req: SignupRequest, db: DB):
    """Anyone can create a customer account. Role is always ``customer``."""
    email = req.email.strip().lower()
    username = req.username.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address")
    _check_password_rules(req.password)
    if db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        raise HTTPException(400, "Email already registered")
    uid = new_id("usr")
    db.execute(
        "INSERT INTO users(id,email,username,password_hash,role) VALUES(?,?,?,?,?)",
        (uid, email, username, hash_password(req.password), "customer"),
    )
    audit(db, uid, "signup")
    return {
        "access_token": _start_session(db, uid),
        "user": {"id": uid, "email": email, "username": username, "role": "customer"},
    }


@router.post("/login")
def login(req: LoginRequest, db: DB):
    email = req.email.strip().lower()
    recent = [t for t in _fails.get(email, []) if time.time() - t < WINDOW]
    if len(recent) >= MAX_FAILS:
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    # Always run the hash so response time doesn't reveal whether the email exists.
    ok = verify_password(req.password, user["password_hash"] if user else "scrypt$00$00")
    if not (user and ok):
        _fails[email] = recent + [time.time()]
        raise HTTPException(401, "Invalid email or password")
    _fails.pop(email, None)
    audit(db, user["id"], "login")
    return {
        "access_token": _start_session(db, user["id"]),
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "role": user["role"],
        },
    }


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: DB):
    """Offline: the 'email' is written to the outbox table instead of sent."""
    user = db.execute("SELECT * FROM users WHERE email=?", (req.email.strip().lower(),)).fetchone()
    if user and user["id"] != PLATFORM_ID:
        token = new_token()
        db.execute(
            "INSERT INTO reset_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)",
            (sha256(token), user["id"], _future(0.5)),
        )
        db.execute(
            "INSERT INTO outbox(to_email,subject,body) VALUES(?,?,?)",
            (user["email"], "Reset your password", f"Reset token (valid 30 min): {token}"),
        )
        log.info("Password reset queued in outbox for %s", user["email"])
    return {"message": "If an account exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: DB):
    _check_password_rules(req.new_password)
    row = db.execute(
        "SELECT * FROM reset_tokens WHERE token_hash=? AND used=0 AND expires_at>?",
        (sha256(req.token), now_iso()),
    ).fetchone()
    if not row:
        raise HTTPException(400, "Reset link invalid or expired")
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(req.new_password), row["user_id"]))
    db.execute("UPDATE reset_tokens SET used=1 WHERE token_hash=?", (row["token_hash"],))
    db.execute("DELETE FROM sessions WHERE user_id=?", (row["user_id"],))  # kill old sessions
    audit(db, row["user_id"], "password_reset")
    return {"message": "Password updated."}


@router.get("/me")
def me(user: CurrentUser):
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "role": user["role"],
    }


@router.post("/logout")
def logout(db: DB, authorization: Annotated[str | None, Header()] = None):
    try:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (sha256(bearer(authorization)),))
    except HTTPException:
        pass
    return {"message": "Signed out"}


@router.get("/dev/outbox")
def dev_outbox(db: DB):
    """Dev-only: read the fake mailbox so password reset works offline."""
    if not settings.SANDBOX_DEV:
        raise HTTPException(404, "Not found")
    rows = db.execute("SELECT to_email,subject,body,created_at FROM outbox ORDER BY id DESC LIMIT 20").fetchall()
    return [dict(r) for r in rows]


# ------------------------------------------------------------------- superuser user management
@router.post("/signup-as", status_code=201)
def signup_as(req: SignupAsRequest, db: DB, _admin: Superuser):
    """Create an account with a chosen role (superuser only)."""
    if req.role not in ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(ROLES)}")
    email = req.email.strip().lower()
    username = req.username.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address")
    _check_password_rules(req.password)
    if db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        raise HTTPException(400, "Email already registered")
    uid = new_id("usr")
    db.execute(
        "INSERT INTO users(id,email,username,password_hash,role) VALUES(?,?,?,?,?)",
        (uid, email, username, hash_password(req.password), req.role),
    )
    audit(db, _admin["id"], "user.create", uid)
    return {
        "access_token": _start_session(db, uid),
        "user": {"id": uid, "email": email, "username": username, "role": req.role},
    }


@router.get("/users")
def list_users(db: DB, _admin: Superuser):
    rows = db.execute(
        "SELECT id,email,username,role,created_at FROM users WHERE id!=? ORDER BY created_at DESC",
        (PLATFORM_ID,),
    ).fetchall()
    return {"data": [dict(r) for r in rows]}


@router.patch("/users/{uid}/role")
def set_user_role(uid: str, body: dict, db: DB, _admin: Superuser):
    new_role = body.get("role")
    if new_role not in ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(ROLES)}")
    if uid == PLATFORM_ID:
        raise HTTPException(403, "Cannot change the platform account's role")
    cur = db.execute("UPDATE users SET role=? WHERE id=? AND id!=?", (new_role, uid, PLATFORM_ID))
    if not cur.rowcount:
        raise HTTPException(404, "resource_missing", "No such user")
    audit(db, _admin["id"], "user.role_change", uid)
    return {"id": uid, "role": new_role}
