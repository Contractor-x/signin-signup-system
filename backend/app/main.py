"""FastAPI backend for the sign-in / sign-up system.

Endpoints:
    GET  /api/auth/google           Start Google OAuth (frontend "Continue with Google" button)
    GET  /api/auth/callback         Google callback: build Supabase session, save profile, back to frontend
    POST /api/auth/login            Email + password login
    POST /api/auth/signup           Email + password signup (API-only; the UI sign-up is Google-only)
    POST /api/auth/forgot-password  Send a password reset email
    POST /api/auth/reset-password   Set a new password
    GET  /api/auth/me               Current user (email + username from Supabase)
    POST /api/auth/logout           Invalidate the session

Run locally:
    uvicorn app.main:app --reload --port 8000
"""

from typing import Annotated

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from .auth import build_authorize_url, exchange_code_for_token, verify_google_token
from .config import settings
from .db import get_profile_by_email, supabase, upsert_profile

app = FastAPI(title="Auth API")

# Allow the browser frontend to call these endpoints.
# Add every frontend origin here (local dev + your Vercel deployment).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request / response models ----------
class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    username: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str  # the access token emailed by Supabase
    new_password: str


# ---------- Google OAuth ----------
@app.get("/api/auth/google")
async def auth_google():
    """Step 1 — start the Google OAuth flow.

    The frontend "Continue with Google" button redirects the browser to this
    URL, which in turn redirects on to Google's consent screen.
    """
    return RedirectResponse(build_authorize_url())


@app.get("/api/auth/callback")
async def auth_callback(code: str):
    """Step 2 — Google redirects the browser back with ?code=... after consent.

    - Exchange the code for a Google ID token.
    - Verify the token and read email + username from the Google profile.
    - Create a Supabase auth session for that identity.
    - Persist email + username in the `profiles` table.
    - Redirect to the frontend with the access token, which stores it and
      greets the user (see js/script.js -> handleGoogleCallback).
    """
    tokens = await exchange_code_for_token(code)
    info = verify_google_token(tokens["id_token"])

    email = info["email"]
    username = info.get("name")

    # Turn the verified Google identity into a Supabase session.
    auth_response = supabase.auth.sign_in_with_id_token(
        provider="google", token=tokens["id_token"]
    )
    access_token = auth_response.session.access_token

    # Store email + username in Supabase (our profile table).
    upsert_profile(sub=info["sub"], email=email, username=username)

    # Send the user back to the frontend with the token embedded in the URL.
    return RedirectResponse(f"{settings.FRONTEND_URL}?token={access_token}&email={email}")


# ---------- Email + password ----------
@app.post("/api/auth/login")
async def auth_login(req: LoginRequest):
    """Sign in with email + password via Supabase Auth.

    Returns the Supabase session; the frontend keeps the access token and sends
    it as `Authorization: Bearer <token>` on authenticated requests.
    """
    try:
        data = supabase.auth.sign_in_with_password(
            {"email": req.email, "password": req.password}
        )
    except Exception as exc:
        # Never reveal whether the email or the password was wrong.
        raise HTTPException(status_code=401, detail="Invalid email or password") from exc

    session = data.session
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": {
            "id": data.user.id,
            "email": data.user.email,
            "username": data.user.user_metadata.get("username"),
        },
    }


@app.post("/api/auth/signup")
async def auth_signup(req: SignupRequest):
    """Create a password account (API-only; the UI sign-up is Google-only).

    Kept available for seeding test accounts, admin tooling or mobile clients.
    """
    try:
        data = supabase.auth.sign_up(
            {
                "email": req.email,
                "password": req.password,
                "options": {"data": {"username": req.username}},
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not create account") from exc

    return {"user": {"id": data.user.id, "email": data.user.email}}


# ---------- Password reset ----------
@app.post("/api/auth/forgot-password")
async def auth_forgot_password(req: ForgotPasswordRequest):
    """Ask Supabase to email a password reset link.

    Always returns success, even for unknown emails, so we don't leak
    which accounts exist.
    """
    try:
        supabase.auth.reset_password_for_email(req.email)
    except Exception:
        pass  # swallow deliberately: same response either way
    return {"message": "If an account exists, a reset link has been sent."}


@app.post("/api/auth/reset-password")
async def auth_reset_password(req: ResetPasswordRequest):
    """Set a new password using the reset token delivered by Supabase."""
    try:
        supabase.auth.update_user({"password": req.new_password}, req.token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Reset link invalid or expired") from exc
    return {"message": "Password updated."}


# ---------- Current user ----------
@app.get("/api/auth/me")
async def auth_me(authorization: Annotated[str | None, Header()] = None):
    """Return the logged-in user (email + username from Supabase)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        user = supabase.auth.get_user(token).user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    profile = get_profile_by_email(user.email)
    return {
        "id": user.id,
        "email": user.email,
        "username": (profile or {}).get("username"),
    }


@app.post("/api/auth/logout")
async def auth_logout(authorization: Annotated[str | None, Header()] = None):
    """Invalidate the current session in Supabase."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        supabase.auth.sign_out(token)
    return {"message": "Signed out"}