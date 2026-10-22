import os
import tempfile

import pytest

# Point the sandbox DB at a temp file before the app imports settings/db.
os.environ["DB_PATH"] = os.path.join(tempfile.gettempdir(), "sandbox_test.db")
os.environ["SANDBOX_DEV"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def init_database():
    init_db()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def make_user(client):
    """Sign up a user and return (auth_headers, user_dict)."""

    def _make(name: str, password: str = "longenough1"):
        email = f"{name}@example.com"
        username = name
        r = client.post(
            "/api/auth/signup",
            json={"email": email, "password": password, "username": username},
        )
        if r.status_code not in (200, 201):
            # user may already exist from a previous test in the same DB; log in instead
            r = client.post("/api/auth/login", json={"email": email, "password": password})
            assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        user = r.json()["user"]
        return {"Authorization": "Bearer " + token}, user

    return _make
