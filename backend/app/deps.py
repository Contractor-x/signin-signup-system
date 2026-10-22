"""Shared request dependencies with role-based access control."""

import sqlite3
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from .config import settings, has_role, ROLES
from .db import get_db
from .security import sha256

DB = Annotated[sqlite3.Connection, Depends(get_db)]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


def user_from_session(db: sqlite3.Connection, token: str):
    row = db.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id "
        "WHERE s.token_hash=? AND s.expires_at>?",
        (sha256(token), now_iso()),
    ).fetchone()
    return row


def current_user(db: DB, authorization: Annotated[str | None, Header()] = None):
    user = user_from_session(db, bearer(authorization))
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


CurrentUser = Annotated[sqlite3.Row, Depends(current_user)]


def require_role(required: str):
    """Dependency factory: only allow users whose role >= ``required``."""

    def _checker(user: CurrentUser):
        user_role = user["role"]
        if not has_role(user_role, required):
            raise HTTPException(
                403,
                f"Insufficient privileges: role '{user_role}' cannot perform this action "
                f"(requires '{required}')",
            )
        return user

    return _checker


ShopOwner = Annotated[sqlite3.Row, Depends(require_role("shop_owner"))]
Superuser = Annotated[sqlite3.Row, Depends(require_role("superuser"))]
