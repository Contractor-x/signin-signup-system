"""Google OAuth 2.0 helpers.

Implements the "web server" (authorization code) flow:

  1. build_authorize_url()   -> send the browser to Google's consent screen
  2. exchange_code_for_token -> trade the code Google gives back for tokens
  3. verify_google_token()   -> verify the ID token and read the user profile
"""

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .config import settings

# Google's authorization endpoint -> user consent screen.
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

# Google's token endpoint -> exchanges the code for tokens.
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def build_authorize_url() -> str:
    """Build the URL that starts the Google login (step 1).

    The frontend "Continue with Google" button redirects the browser here.
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    }
    return GOOGLE_AUTH_URL + "?" + "&".join(f"{k}={v}" for k, v in params.items())


async def exchange_code_for_token(code: str) -> dict:
    """Exchange the authorization code for tokens (step 2).

    Returns a dict containing id_token, access_token and refresh_token.
    """
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()

    """Verify a Google ID token and return the user profile.

    Returns a dict with at least: sub (Google user id), email, and name (username).
    Raises google.auth.exceptions.GoogleAuthError if the token is invalid.
    """
    
def verify_google_token(id_token: str) -> dict:
    info = google_id_token.verify_oauth2_token(
        id_token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
    )
    return info