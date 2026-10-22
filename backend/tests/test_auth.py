def test_signup_login_me_logout(client):
    body = {"email": "Ada@Example.com", "password": "longenough1", "username": "ada"}
    assert client.post("/api/auth/signup", json=body).status_code == 200
    assert client.post("/api/auth/signup", json=body).status_code == 400  # duplicate (case-insensitive)
    r = client.post("/api/auth/login", json={"email": "ada@example.com", "password": "longenough1"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/auth/me", headers=h).json()["username"] == "ada"
    client.post("/api/auth/logout", headers=h)
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_bad_login_is_generic_and_rate_limited(client):
    for _ in range(5):
        r = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
        assert r.status_code == 401 and r.json()["detail"] == "Invalid email or password"
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"}).status_code == 429


def test_weak_password_rejected(client):
    r = client.post("/api/auth/signup", json={"email": "w@example.com", "password": "short", "username": "weak"})
    assert r.status_code == 400


def test_password_reset_offline(client, make_user):
    h, u = make_user("reset")
    client.post("/api/auth/forgot-password", json={"email": u["email"]})
    token = client.get("/api/auth/dev/outbox").json()[0]["body"].split(": ")[1]
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "brand-new-pass1"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "another-pass12"}).status_code == 400  # single use
    assert client.get("/api/auth/me", headers=h).status_code == 401  # old sessions revoked
    assert client.post("/api/auth/login", json={"email": u["email"], "password": "brand-new-pass1"}).status_code == 200
