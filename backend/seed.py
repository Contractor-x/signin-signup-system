"""Seed the sandbox shop with a curated design-objects catalogue.

The catalogue is deliberately small and opinionated: twelve useful objects,
real photography and honest copy. Running this file more than once is safe:

* products are matched by name and updated in place, never duplicated;
* stock and prices are left alone after the first insert, so an admin edit is
  not silently reverted by a later seed;
* old demo-catalogue rows owned by the sandbox shop are retired, while
  products listed by real shop owners are never touched.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db import PLATFORM_ID, connect
from app.security import new_id

STUDIO_ID = "usr_studio"

# The demo catalogue is owned by a dedicated shop-owner account so the
# storefront can display a real seller name.
STUDIO = {
    "id": STUDIO_ID,
    "email": "studio@sandbox.local",
    "username": "Atelier Sandbox",
    "password_hash": "!disabled",  # cannot log in; catalogue account only
    "role": "shop_owner",
}

# (name, description, price_naira, stock, emoji, image_url, category)
PRODUCTS = [
    (
        "Arc Counter Stool",
        "Solid oak with a powder-coated steel footrest. 66 cm seat height, "
        "built for long mornings at the counter.",
        78000, 14, "🪑",
        "https://images.unsplash.com/photo-1503602642458-232111445657"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Furniture",
    ),
    (
        "Pivot Lounge Chair",
        "A moulded shell on a solid ash base. Low, wide and unexpectedly "
        "comfortable — the chair everyone reaches for.",
        145000, 9, "🪑",
        "https://images.unsplash.com/photo-1592078615290-033ee584e267"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Furniture",
    ),
    (
        "Moss Velvet Sofa",
        "Three generous seats in dense cotton velvet. Solid beech frame, "
        "feather-wrapped cushions, removable covers.",
        480000, 4, "🛋️",
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Furniture",
    ),
    (
        "Tan Leather Sofa",
        "Full-grain leather that softens with use. Three seats, low arms and "
        "solid oak feet. A piece that gets better with age.",
        520000, 3, "🛋️",
        "https://images.pexels.com/photos/1866149/pexels-photo-1866149.jpeg"
        "?auto=compress&cs=tinysrgb&w=900&h=1125&fit=crop",
        "Furniture",
    ),
    (
        "Studio Mug",
        "Stoneware mug with a generous handle and a satin glaze. 350 ml, "
        "dishwasher safe, made for the second cup.",
        12500, 36, "☕",
        "https://images.unsplash.com/photo-1544787219-7f47ccb76574"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Kitchen",
    ),
    (
        "Everyday Flask",
        "Double-wall stainless steel, 500 ml. Keeps coffee hot for six hours "
        "and fits the side pocket of almost any bag.",
        18000, 28, "🧴",
        "https://images.unsplash.com/photo-1602143407151-7111542de6e8"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Objects",
    ),
    (
        "Field Watch",
        "Brushed aluminium case, sapphire face and a soft silicone strap. "
        "Water-resistant to 50 m, quietly precise.",
        95000, 11, "⌚",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Objects",
    ),
    (
        "Instant Camera",
        "Point-and-shoot instant camera with a built-in flash. Uses standard "
        "instant film — the good kind of slow.",
        165000, 7, "📷",
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Objects",
    ),
    (
        "Knit Runner",
        "Lightweight knit upper on a cushioned sole. Made for the walk that "
        "turns into a run.",
        72000, 16, "👟",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Apparel",
    ),
    (
        "Leather Mini Bag",
        "Structured mini bag in pebbled leather. Fits a phone, cardholder and "
        "keys — nothing more, which is the point.",
        88000, 12, "👜",
        "https://images.unsplash.com/photo-1594223274512-ad4803739b7c"
        "?w=900&h=1125&fit=crop&crop=entropy&q=80&auto=format",
        "Carry",
    ),
    (
        "Single Origin Coffee",
        "Washed Ethiopian beans roasted for filter. Notes of peach, jasmine "
        "and brown sugar. 250 g, whole bean.",
        9500, 42, "☕",
        "https://images.pexels.com/photos/585750/pexels-photo-585750.jpeg"
        "?auto=compress&cs=tinysrgb&w=900&h=1125&fit=crop",
        "Kitchen",
    ),
    (
        "Botanical Face Oil",
        "Cold-pressed rosehip and squalane. Three drops, morning and night, "
        "and a minute that belongs to you.",
        24000, 25, "🧴",
        "https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg"
        "?auto=compress&cs=tinysrgb&w=900&h=1125&fit=crop",
        "Apothecary",
    ),
]


def _ensure_studio(db) -> None:
    db.execute(
        "INSERT OR IGNORE INTO users(id,email,username,password_hash,role) VALUES(?,?,?,?,?)",
        (STUDIO["id"], STUDIO["email"], STUDIO["username"],
         STUDIO["password_hash"], STUDIO["role"]),
    )


def main() -> None:
    with connect() as db:
        _ensure_studio(db)
        wanted = {p[0] for p in PRODUCTS}
        inserted = updated = 0

        for name, desc, price, stock, emoji, image, category in PRODUCTS:
            existing = db.execute(
                "SELECT id FROM products WHERE name=? AND seller_id IN (?,?) "
                "ORDER BY rowid LIMIT 1",
                (name, STUDIO_ID, PLATFORM_ID),
            ).fetchone()
            if existing:
                db.execute(
                    "UPDATE products SET seller_id=?, description=?, emoji=?, image_url=?, "
                    "category=?, active=1 WHERE id=?",
                    (STUDIO_ID, desc, emoji, image, category, existing["id"]),
                )
                updated += 1
            else:
                db.execute(
                    "INSERT INTO products(id,seller_id,name,description,price_minor,currency,"
                    "stock,emoji,image_url,category) VALUES(?,?,?,?,?,'NGN',?,?,?,?)",
                    (new_id("prd"), STUDIO_ID, name, desc, price * 100, stock,
                     emoji, image, category),
                )
                inserted += 1

        # Retire older demo rows, but never touch a real shop owner's products.
        marks = ",".join("?" for _ in wanted)
        retired = db.execute(
            f"UPDATE products SET active=0 WHERE seller_id IN (?,?) AND active=1 "
            f"AND name NOT IN ({marks})",
            (STUDIO_ID, PLATFORM_ID, *sorted(wanted)),
        ).rowcount
        db.commit()

    print(
        f"Seeded shop: {inserted} inserted, {updated} updated, "
        f"{retired} old demo products retired."
    )


if __name__ == "__main__":
    main()
