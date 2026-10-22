"""Centralised configuration, read from the environment (no network needed).

Every value is read eagerly at import time so any misconfiguration fails
loudly at startup instead of halfway through a request.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    """All environment variables used by the backend."""

    DB_PATH: str = os.getenv("DB_PATH", str(BASE_DIR / "data" / "sandbox.db"))
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
    SESSION_TTL_HOURS: int = int(os.getenv("SESSION_TTL_HOURS", "24"))
    SANDBOX_DEV: bool = os.getenv("SANDBOX_DEV", "1") == "1"
    # The frontend lives in a sibling directory, served by its own dev server.
    # CORS must allow that origin.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")


settings = Settings()

# User roles in ascending privilege.
ROLES = ("customer", "shop_owner", "superuser")


def has_role(user_role: str, required: str) -> bool:
    """Return True if ``user_role`` meets or exceeds ``required``."""
    return ROLES.index(user_role) >= ROLES.index(required)
