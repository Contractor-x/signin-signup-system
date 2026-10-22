import pytest

SHIP = {"name": "Ada Obi", "address": "12 Marina Road, Lagos", "phone": "08012345678"}
CARD = {"type": "card", "number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123"}


@pytest.fixture
def shop(client, make_user):
    seller, su = make_user("seller")
    buyer, bu = make_user("buyer")
    # Promote seller to shop_owner so they can create products
    import sqlite3
    from app.config import settings
    conn = sqlite3.connect(settings.DB_PATH)
    conn.execute("UPDATE users SET role='shop_owner' WHERE id=?", (su["id"],))
    conn.commit()
    conn.close()
    p = client.post("/api/store/products", headers=seller, json={"name": "Ankara Tote", "price_minor": 1500000, "stock": 3}).json()
    return seller, buyer, p


def order(client, buyer, p, qty=1):
    return client.post("/api/store/orders", headers=buyer, json={"items": [{"product_id": p["id"], "quantity": qty}], "shipping": SHIP})


def test_checkout_happy_path_and_seller_summary(client, shop):
    seller, buyer, p = shop
    o = order(client, buyer, p, 2).json()
    assert o["status"] == "pending_payment" and o["total_minor"] == 3000000
    paid = client.post(f"/api/store/orders/{o['id']}/pay", headers=buyer, json={"payment_method": CARD}).json()
    assert paid["status"] == "paid" and paid["payment"]["payment_method"]["last4"] == "4242"
    assert "client_secret" not in paid["payment"]
    assert client.get("/api/store/seller/summary", headers=seller).json()["paid_minor"] == 3000000
    assert client.get("/api/store/seller/orders", headers=seller).json()["data"][0]["buyer"].startswith("buyer")


def test_stock_reserved_restored_and_oversell_blocked(client, shop):
    seller, buyer, p = shop
    o = order(client, buyer, p, 3).json()
    assert order(client, buyer, p, 1).json()["error"]["code"] == "out_of_stock"
    client.post(f"/api/store/orders/{o['id']}/cancel", headers=buyer)
    assert client.get("/api/store/my/products", headers=seller).json()["data"][0]["stock"] == 3


def test_failed_payment_then_retry(client, shop):
    _, buyer, p = shop
    o = order(client, buyer, p).json()
    bad = client.post(f"/api/store/orders/{o['id']}/pay", headers=buyer, json={"payment_method": {**CARD, "number": "4000000000009995"}}).json()
    assert bad["status"] == "payment_failed"
    good = client.post(f"/api/store/orders/{o['id']}/pay", headers=buyer, json={"payment_method": CARD}).json()
    assert good["status"] == "paid"


def test_3ds_and_async_wallet_orders(client, shop):
    _, buyer, p = shop
    o = order(client, buyer, p).json()
    r = client.post(f"/api/store/orders/{o['id']}/pay", headers=buyer, json={"payment_method": {**CARD, "number": "4000000000003220"}}).json()
    assert r["payment"]["status"] == "requires_action"
    assert client.post(f"/api/store/orders/{o['id']}/authenticate", headers=buyer, json={"otp": "123456"}).json()["status"] == "paid"
    o2 = order(client, buyer, p).json()
    r = client.post(f"/api/store/orders/{o2['id']}/pay", headers=buyer, json={"payment_method": {"type": "wallet", "phone": "+2348000000003"}}).json()
    assert r["payment"]["status"] == "processing"
    assert client.post(f"/api/store/orders/{o2['id']}/simulate-settle", headers=buyer, json={"outcome": "succeeded"}).json()["status"] == "paid"


def test_refund_by_seller_only(client, shop, make_user):
    seller, buyer, p = shop
    o = order(client, buyer, p).json()
    client.post(f"/api/store/orders/{o['id']}/pay", headers=buyer, json={"payment_method": CARD})
    stranger, _ = make_user("stranger")
    assert client.post(f"/api/store/orders/{o['id']}/refund", headers=stranger).status_code == 404
    assert client.post(f"/api/store/orders/{o['id']}/refund", headers=seller).json()["status"] == "refunded"


def test_access_control_and_rules(client, shop, make_user):
    seller, buyer, p = shop
    assert order(client, seller, p).json()["error"]["code"] == "own_product"
    o = order(client, buyer, p).json()
    other, _ = make_user("snoop")
    assert client.get(f"/api/store/orders/{o['id']}", headers=other).status_code == 404
    assert client.put(f"/api/store/products/{p['id']}", headers=other, json={"name": "Hacked", "price_minor": 1, "stock": 1}).status_code == 404
    assert client.post("/api/store/orders", json={"items": [], "shipping": SHIP}).status_code == 401
    assert client.get("/api/store/products").status_code == 200  # catalog is public


def test_catalog_category_filter_sort_and_shipping(client, shop):
    seller, buyer, p = shop
    for name, price, category in (
        ("Test Kettle", 900000, "TestKitchen"),
        ("Test Bench", 2500000, "TestFurniture"),
        ("Test Spoon", 450000, "TestKitchen"),
    ):
        r = client.post(
            "/api/store/products",
            headers=seller,
            json={"name": name, "price_minor": price, "stock": 2, "category": category},
        )
        assert r.status_code == 201, r.text

    kitchen = client.get("/api/store/products?category=TestKitchen&sort=price_asc").json()["data"]
    assert [p["name"] for p in kitchen] == ["Test Spoon", "Test Kettle"]
    assert all(p["category"] == "TestKitchen" for p in kitchen)

    categories = client.get("/api/store/categories").json()["data"]
    by_name = {c["category"]: c["count"] for c in categories}
    assert by_name["TestKitchen"] == 2
    assert by_name["TestFurniture"] == 1

    o = order(client, buyer, p).json()
    assert o["shipping"]["name"] == SHIP["name"]
    assert o["shipping"]["address"] == SHIP["address"]
