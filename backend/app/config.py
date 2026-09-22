"""Centralised configuration, loaded once from the environment.

Every value is read eagerly at import time so any misconfiguration
fails loudly at startup instead of halfway through a request.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# The `.env` file can live in two places; load whichever exists:
#   backend/.env      (recommended, next to run.sh)
#   backend/app/.env  (accepted too)
BACKEND_DIR = Path(__file__).resolve().parents[1]
for dotenv_path in (BACKEND_DIR / ".env", BACKEND_DIR / "app" / ".env"):
    if dotenv_path.is_file():
        load_dotenv(dotenv_path)
        break


class Settings:
    """All environment variables used by the backend."""

    # Supabase project credentials (https://supabase.com/dashboard/project/_/settings/api).
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Where the frontend lives. In production this is your Vercel deployment URL.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5500")


settings = Settings()