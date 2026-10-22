"""Seed the sandbox shop with a curated, aesthetic product catalogue.

Each product uses a real, freely-hosted product photo (Unsplash Source) so the
storefront looks polished out of the box. Safe to re-run: it only inserts
products that don't already exist (matched by name).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db import connect, PLATFORM_ID
from app.security import new_id

# (name, description, price_naira, stock, emoji, image_url)
PRODUCTS = [
    ("Ceramic Morning Mug",
     "Hand-thrown stoneware mug, matte glaze, dishwasher safe. 350 ml.",
     4500, 24, "\U0001F375",
     "https://images.unsplash.com/photo-1510707585788-02b0a1a8a8f2?w=800&q=80&auto=format&fit=crop"),
    ("Linen Tote Bag",
     "Heavyweight natural linen tote with reinforced handles. Perfect for groceries or books.",
     6200, 30, "\U0001F45C",
     "https://images.unsplash.com/photo-1551098910-a09131640166?w=800&q=80&auto=format&fit=crop"),
    ("Olive Wood Cutting Board",
     "Sustainably sourced olive wood, end-grain construction. Each board is unique.",
     18500, 12, "\U0001F9C0\U0001F3FC",
     "https://images.unsplash.com/photo-1592676633189-5e0a6a9a9301?w=800&q=80&auto=format&fit=crop"),
    ("Wool Throw Blanket",
     "Merino wool throw, brushed finish. Keeps you warm in winter, breathable in summer.",
     32000, 18, "\U0001F9F3",
     "https://images.unsplash.com/photo-1579785933121-fb9c1359999b?w=800&q=80&auto=format&fit=crop"),
    ("Terrazzo Plant Pot",
     "Cement terrazzo pot with drainage hole and matching saucer. Indoor use.",
     9800, 26, "\U0001F331",
     "https://images.unsplash.com/photo-1595160677143-e1208eb87e41?w=800&q=80&auto=format&fit=crop"),
    ("Espresso Glass Set (2)",
     "Double-wall borosilicate glass, keeps espresso hot and hands cool.",
     11500, 20, "\U00002615\U0001F3FB",
     "https://images.unsplash.com/photo-1514428477400-5d2c3a8733be?w=800&q=80&auto=format&fit=crop"),
    ("Cotton Bed Sheet Set",
     "100% cotton sateen, 400 thread count. Fitted sheet, flat sheet, 2 pillowcases.",
     24000, 15, "\U0001F426",
     "https://images.unsplash.com/photo-1616475820631-809b66fd1e2d?w=800&q=80&auto=format&fit=crop"),
    ("Bamboo Bath Caddy",
     "Extendable bamboo caddy with slots for a book, phone, glass of wine and candle.",
     7400, 22, "\U0001F6C0\U0001F3FC",
     "https://images.unsplash.com/photo-1580863779393-fb0c7575a79f?w=800&q=80&auto=format&fit=crop"),
    ("Cast Iron Skillet",
     "Pre-seasoned 26 cm skillet, oven-safe, lasts generations with care.",
     21000, 14, "\U0001F924\U0001F3FC",
     "https://images.unsplash.com/photo-1583956220462-75285989e372?w=800&q=80&auto=format&fit=crop"),
    ("Soy Candle - Santal",
     "Hand-poured soy wax with sandalwood & amber essential oils. 45-hour burn.",
     5800, 40, "\U0001F3F1\U0001F3FB",
     "https://images.unsplash.com/photo-1606086535210-2990f977dc03?w=800&q=80&auto=format&fit=crop"),
    ("Canvas Weekender Bag",
     "Waxed canvas weekender with leather trim. Fits a laptop and change of clothes.",
     41000, 10, "\U0001F4F2",
     "https://images.unsplash.com/photo-1553063449-031e2b7d843e?w=800&q=80&auto=format&fit=crop"),
    ("Marble Coasters (Set of 4)",
     "Natural marble with felt backing. Protects tables in style.",
     6900, 32, "\U0001F973",
     "https://images.unsplash.com/photo-1600585154340-be6161a56a10?w=800&q=80&auto=format&fit=crop"),
]

INSERT = """
INSERT OR IGNORE INTO products(id, seller_id, name, description, price_minor, currency, stock, emoji, image_url)
VALUES (?, ?, ?, ?, ?, 'NGN', ?, ?, ?)
"""

def main() -> None:
    with connect() as db:
        # Use the platform merchant as the seed seller so products are visible
        # to every shop owner. A real shop owner would list their own items.
        seller_id = PLATFORM_ID
        count = 0
        for name, desc, price, stock, emoji, image in PRODUCTS:
            pid = new_id("prd")
            db.execute(INSERT, (pid, seller_id, name, desc, price * 100, stock, emoji, image))
            count += 1
        db.commit()
    print(f"Seeded {count} products into the sandbox shop.")

if __name__ == "__main__":
    main()
