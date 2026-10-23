"""Sandbox payments + marketplace backend (API-only).

The frontend lives in a separate `frontend/` directory and is served by its own
dev server. This process exposes the JSON API and nothing else (no templates,
no backend/ or DB exposure).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import auth, gateway, store
from .errors import ApiError
from .config import settings
from .db import init_db

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Sandbox Pay API", version="2.0.0", lifespan=lifespan)

# CORS: the frontend is a separate origin (dev server on :5173 by default).
# Only local origins are allowed so a random website cannot drive the sandbox.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        settings.FRONTEND_URL,
        "https://signin-signup-system.vercel.app",
    ],
    # Vercel preview deployments get a new *.vercel.app host each time.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def allow_private_network(request: Request, call_next):
    """Let a public HTTPS page (e.g. Vercel) call this loopback backend.

    Chrome's Local/Private Network Access sends a preflight carrying
    ``Access-Control-Request-Private-Network`` and requires this opt-in header.
    """
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

app.include_router(auth.router)
app.include_router(gateway.router)
app.include_router(gateway.dev)
app.include_router(store.router)


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status, content={
        "error": {"code": exc.code, "message": exc.message}, "detail": exc.message})


@app.middleware("http")
async def sandbox_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Sandbox-Mode"] = "test"  # every response says it is test mode
    return response


@app.get("/health")
def health():
    return {"status": "ok", "mode": "sandbox", "is_test_mode": True, "livemode": False}
