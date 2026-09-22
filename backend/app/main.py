"""FastAPI backend for the sign-in / sign-up system.

Endpoints:
    POST /api/auth/signup           Create an account with email + password
    POST /api/auth/login            Sign in with email + password
    POST /api/auth/forgot-password  Send a password reset email
    POST /api/auth/reset-password   Set a new password
    GET  /api/auth/me               Current user (email + username from Supabase)
    POST /api/auth/logout           Invalidate the session

Run locally:
    uvicorn app.main:app --reload --port 8000
"""

import logging
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .db import get_profile_by_email, supabase, upsert_profile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auth_api")

app = FastAPI(title="Auth API")

# The server still boots without keys so you can work on the frontend,
# but auth endpoints will fail until Supabase credentials are set.
if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
    logger.warning(
        "SUPABASE_URL / SUPABASE_ANON_KEY are not set. "
        "Fill backend/.env (or backend/app/.env) to use the auth endpoints."
    )

# Allow the browser frontend to call these endpoints.
# Add every frontend origin here (local dev + your Vercel deployment).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        settings.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Request / response models ----------
class SignupRequest(BaseModel):
    email: str
    password: str
    username: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str  # the access token emailed by Supabase
    new_password: str


# ---------- Sign up ----------
@app.post("/api/auth/signup")
async def auth_signup(req: SignupRequest):
    """Create an account with email + password via Supabase Auth.

    Stores the username alongside the email in the `profiles` table.
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
        # Surface Supabase's reason (already registered, weak password,
        # rate limited, invalid email...) so the frontend can show it.
        reason = getattr(exc, "message", None) or str(exc)
        raise HTTPException(status_code=400, detail=reason) from exc

    # Persist email + username in our profile table.
    upsert_profile(email=req.email, username=req.username)

    session = data.session
    return {
        "access_token": session.access_token if session else None,
        "user": {"id": data.user.id, "email": data.user.email, "username": req.username},
    }


# ---------- Sign in ----------
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


# ---------- Health check ----------
@app.get("/health")
async def health():
    """Confirm the backend is up and that Supabase is reachable."""
    db_ok = True
    try:
        supabase.table("profiles").select("id").limit(1).execute()
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "supabase": "connected" if db_ok else "unreachable",
        "service_role_key_set": bool(settings.SUPABASE_SERVICE_ROLE_KEY),
    }


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
        "username": (
            (profile or {}).get("username")
            or user.user_metadata.get("username")
        ),
    }


@app.post("/api/auth/logout")
async def auth_logout(authorization: Annotated[str | None, Header()] = None):
    """Invalidate the current session in Supabase.

    This is best-effort: Supabase auth tokens expire on their own and the
    frontend discards the token, so a failed revocation must never 500.
    """
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            supabase.auth.set_session(token, token)
            supabase.auth.sign_out()
        except Exception:
            pass
    return {"message": "Signed out"}