"""The seed script must be safe to run repeatedly.

A re-run used to insert another copy of every product. This test runs the real
seed twice against an isolated database and asserts the active catalogue stays
at exactly one row per product.
"""

from app.config import settings
from app.db import connect, init_db


def test_seed_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DB_PATH", str(tmp_path / "seed.db"))
    init_db()

    import seed

    seed.main()
    seed.main()

    with connect() as db:
        active = db.execute("SELECT COUNT(*) FROM products WHERE active=1").fetchone()[0]
        all_rows = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        categories = {
            r["category"] for r in db.execute("SELECT DISTINCT category FROM products WHERE active=1")
        }

    assert active == len(seed.PRODUCTS) == 12
    assert all_rows == 12  # no duplicates were inserted on the second run
    assert categories == {
        "Furniture", "Kitchen", "Objects", "Apparel", "Carry", "Apothecary",
    }


def test_seed_retires_old_demo_catalogue(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DB_PATH", str(tmp_path / "old.db"))
    init_db()

    import seed
    from app.db import PLATFORM_ID
    from app.security import new_id

    with connect() as db:
        db.execute(
            "INSERT INTO products(id,seller_id,name,description,price_minor,currency,stock,active) "
            "VALUES(?,?,?,?,?,'NGN',?,1)",
            (new_id("prd"), PLATFORM_ID, "Old Demo Mug", "legacy", 1000, 5),
        )
        db.commit()

    seed.main()

    with connect() as db:
        old = db.execute("SELECT active FROM products WHERE name='Old Demo Mug'").fetchone()
        active = db.execute("SELECT COUNT(*) FROM products WHERE active=1").fetchone()[0]

    assert old["active"] == 0
    assert active == len(seed.PRODUCTS)
