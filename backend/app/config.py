"""Centralised configuration, loaded once from the environment.

Every value is read eagerly at import time so any misconfiguration
fails loudly at startup instead of halfway through a request.
"""

import os

from dotenv import load_dotenv

# Load backend/.env (if present) so the app runs locally without extra tooling.
load_dotenv()


class Settings:
    """All environment variables used by the backend."""

    # Google OAuth credentials (create at https://console.cloud.google.com/apis/credentials).
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # The URL Google redirects the browser to after the user consents.
    # Must be added to "Authorized redirect URIs" on the OAuth 2.0 Client.
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback"
    )

    # Supabase project credentials (https://supabase.com/dashboard/project/_/settings/api).
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Where the frontend lives. In production this is your Vercel deployment URL.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5500")


settings = Settings()