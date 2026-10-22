import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.gettempdir(), "sandbox_test.db")
os.environ["SANDBOX_DEV"] = "1"


def auth(client, email, password="Pass1234!"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def signup(client, email, password="Pass1234!", username="user", role="customer"):
    if role == "customer":
        r = client.post("/api/auth/signup", json={"email": email, "password": password, "username": username})
    else:
        admin_tok = auth(client, "admin@sandbox.local", "Admin1234!")
        r = client.post(
            "/api/auth/signup-as",
            json={"email": email, "password": password, "username": username, "role": role},
            headers={"Authorization": "Bearer " + admin_tok},
        )
    assert r.status_code in (200, 201), r.text
    return r.json()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "sandbox"
    assert body["is_test_mode"] is True
    assert r.headers.get("x-sandbox-mode") == "test"


def test_customer_signup_and_login(client):
    signup(client, "cust@example.com", username="cust")
    r = client.post("/api/auth/login", json={"email": "cust@example.com", "password": "Pass1234!"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "customer"


def test_customer_cannot_create_role(client):
    signup(client, "cust2@example.com", username="cust2")
    r = client.post(
        "/api/auth/signup-as",
        json={"email": "x@example.com", "password": "Pass1234!", "username": "x", "role": "shop_owner"},
        headers={"Authorization": "Bearer " + auth(client, "cust2@example.com")},
    )
    assert r.status_code == 403


def test_superuser_creates_shop_owner(client):
    admin_tok = auth(client, "admin@sandbox.local", "Admin1234!")
    r = client.post(
        "/api/auth/signup-as",
        json={"email": "owner@example.com", "password": "Pass1234!", "username": "owner", "role": "shop_owner"},
        headers={"Authorization": "Bearer " + admin_tok},
    )
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "shop_owner"


def test_products_and_order_flow(client):
    owner = signup(client, "owner2@example.com", username="owner2", role="shop_owner")
    ot = owner["access_token"]

    r = client.get("/api/store/my/products", headers={"Authorization": "Bearer " + ot})
    assert r.status_code == 200
    assert r.json()["data"] == []

    r = client.post(
        "/api/store/products",
        json={"name": "Test Item", "description": "desc", "price_minor": 5000, "stock": 5, "emoji": "📦"},
        headers={"Authorization": "Bearer " + ot},
    )
    assert r.status_code == 201
    pid = r.json()["id"]

    cust = signup(client, "cust3@example.com", username="cust3")
    r = client.post(
        "/api/store/products",
        json={"name": "Nope", "description": "x", "price_minor": 100, "stock": 1},
        headers={"Authorization": "Bearer " + cust["access_token"]},
    )
    assert r.status_code == 403

    ct = cust["access_token"]
    r = client.post(
        "/api/store/orders",
        json={"items": [{"product_id": pid, "quantity": 2}],
              "shipping": {"name": "Customer", "address": "1 Street", "phone": "08012345678"}},
        headers={"Authorization": "Bearer " + ct},
    )
    assert r.status_code == 201
    oid = r.json()["id"]
    assert r.json()["status"] == "pending_payment"

    r = client.post(
        "/api/store/orders",
        json={"items": [{"product_id": pid, "quantity": 1}],
              "shipping": {"name": "O", "address": "x", "phone": "1"}},
        headers={"Authorization": "Bearer " + ot},
    )
    assert r.status_code == 422

    r = client.post(
        f"/api/store/orders/{oid}/pay",
        json={"payment_method": {"type": "card", "number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123"}},
        headers={"Authorization": "Bearer " + ct},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "paid"

    r = client.get("/api/store/seller/summary", headers={"Authorization": "Bearer " + ot})
    assert r.status_code == 200
    assert r.json()["paid_minor"] == 10000

    r = client.post(f"/api/store/orders/{oid}/refund", json={}, headers={"Authorization": "Bearer " + ot})
    assert r.status_code == 200
    assert r.json()["status"] == "refunded"


def test_superuser_admin(client):
    admin_tok = auth(client, "admin@sandbox.local", "Admin1234!")
    r = client.get("/api/auth/users", headers={"Authorization": "Bearer " + admin_tok})
    assert r.status_code == 200
    roles = {u["role"] for u in r.json()["data"]}
    assert "superuser" in roles

    r = client.get("/api/store/admin/products", headers={"Authorization": "Bearer " + admin_tok})
    assert r.status_code == 200

    # superuser manages all orders
    r = client.get("/api/store/admin/orders", headers={"Authorization": "Bearer " + admin_tok})
    assert r.status_code == 200
