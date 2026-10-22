"""E-commerce API  ->  /api/store/*

The store is just another client of the payment engine: every order owns a payment
intent on the internal platform merchant, and order state follows payment events.

Roles:
  * customer — can browse, buy (not own products), view own orders.
  * shop_owner — can create/update/delete their own products, view/refund own sales.
  * superuser — can manage all products, orders, users.
"""

import json

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from . import payments, webhooks
from .db import PLATFORM_ID, audit
from .deps import DB, CurrentUser, ShopOwner, Superuser
from .errors import ApiError
from .gateway import PaymentMethod
from .security import new_id

router = APIRouter(prefix="/api/store", tags=["store"])


# ------------------------------------------------- order state follows payments
def _on_payment_event(db, merchant_id: str, etype: str, obj: dict) -> None:
    if merchant_id != PLATFORM_ID:
        return
    oid = (obj.get("metadata") or {}).get("order_id")
    if etype == "refund.processed":
        oid = (obj["payment_intent_object"].get("metadata") or {}).get("order_id")
        if oid and obj["payment_intent_object"]["amount_refunded"] >= obj["payment_intent_object"]["amount"]:
            db.execute("UPDATE orders SET status='refunded' WHERE id=?", (oid,))
        return
    new = {"payment.intent.succeeded": "paid", "payment.intent.failed": "payment_failed",
           "payment.intent.canceled": "canceled"}.get(etype)
    if not (oid and new):
        return
    order = db.execute("SELECT status FROM orders WHERE id=?", (oid,)).fetchone()
    if order and order["status"] != "canceled":
        db.execute("UPDATE orders SET status=? WHERE id=?", (new, oid))
        if new == "canceled":
            _restore_stock(db, oid)


def _restore_stock(db, oid: str) -> None:
    for it in db.execute("SELECT product_id,quantity FROM order_items WHERE order_id=?", (oid,)):
        db.execute("UPDATE products SET stock=stock+? WHERE id=?", (it["quantity"], it["product_id"]))


payments.HOOKS.append(_on_payment_event)


def _queue(db, bg: BackgroundTasks) -> None:
    db.commit()
    bg.add_task(webhooks.dispatch_pending)


# --------------------------------------------------------------------- models
class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field("", max_length=500)
    price_minor: int = Field(gt=0, le=payments.MAX_AMOUNT)
    stock: int = Field(ge=0, le=100000)
    emoji: str = Field("📦", max_length=8)
    image_url: str = Field("", max_length=500)
    category: str = Field("Home", min_length=1, max_length=40)
    currency: str = "NGN"


class Line(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=20)


class Shipping(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    address: str = Field(min_length=5, max_length=200)
    phone: str = Field(min_length=7, max_length=20)


class OrderIn(BaseModel):
    items: list[Line] = Field(min_length=1, max_length=20)
    shipping: Shipping


class PayIn(BaseModel):
    payment_method: PaymentMethod


class OtpIn(BaseModel):
    otp: str


# ------------------------------------------------------------------- products
def _product(r) -> dict:
    return {k: r[k] for k in ("id", "seller_id", "name", "description", "price_minor", "currency",
                              "stock", "emoji", "image_url", "category", "active")}


PRODUCT_SORTS = {
    "featured": "p.rowid ASC",
    "newest": "p.rowid DESC",
    "price_asc": "p.price_minor ASC, p.rowid ASC",
    "price_desc": "p.price_minor DESC, p.rowid ASC",
    "name_asc": "p.name COLLATE NOCASE ASC",
}


@router.get("/products")
def list_products(db: DB, q: str = "", category: str = "", sort: str = "featured"):
    """Public catalogue. Supports free-text search, category filter and sorting.

    ``category=All`` is treated as no filter so the storefront can use one code
    path for its "All" chip.
    """
    where, args = ["p.active=1"], []
    if q.strip():
        where.append("(p.name LIKE ? OR p.description LIKE ?)")
        args.extend([f"%{q.strip()}%", f"%{q.strip()}%"])
    if category.strip() and category.strip().lower() != "all":
        where.append("LOWER(p.category)=LOWER(?)")
        args.append(category.strip())
    order = PRODUCT_SORTS.get(sort, PRODUCT_SORTS["featured"])
    rows = db.execute(
        "SELECT p.*, u.username seller FROM products p JOIN users u ON u.id=p.seller_id "
        f"WHERE {' AND '.join(where)} ORDER BY {order} LIMIT 100",
        args,
    ).fetchall()
    return {"data": [{**_product(r), "seller": r["seller"]} for r in rows]}


@router.get("/categories")
def list_categories(db: DB):
    rows = db.execute(
        "SELECT category, COUNT(*) AS count FROM products WHERE active=1 "
        "GROUP BY category ORDER BY category COLLATE NOCASE"
    ).fetchall()
    return {"data": [dict(r) for r in rows]}


@router.get("/my/products")
def my_products(db: DB, user: ShopOwner):
    rows = db.execute("SELECT * FROM products WHERE seller_id=? ORDER BY rowid DESC", (user["id"],)).fetchall()
    return {"data": [_product(r) for r in rows]}


@router.post("/products", status_code=201)
def create_product(body: ProductIn, db: DB, user: ShopOwner):
    if body.currency.upper() not in payments.CURRENCIES:
        raise ApiError(422, "invalid_currency", "Unsupported currency")
    pid = new_id("prd")
    db.execute(
        "INSERT INTO products(id,seller_id,name,description,price_minor,currency,stock,emoji,image_url,category) "
        "VALUES(?,?,?,?,?,?,?,?,?,?)",
        (pid, user["id"], body.name.strip(), body.description, body.price_minor,
         body.currency.upper(), body.stock, body.emoji, body.image_url, body.category.strip()),
    )
    audit(db, user["id"], "product.create", pid)
    return _product(db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone())


def _own_product(db, user, pid: str):
    row = db.execute("SELECT * FROM products WHERE id=? AND seller_id=? AND active=1", (pid, user["id"])).fetchone()
    if not row:
        raise ApiError(404, "resource_missing", "No such product")
    return row


@router.put("/products/{pid}")
def update_product(pid: str, body: ProductIn, db: DB, user: CurrentUser):
    if user["role"] != "shop_owner":
        raise ApiError(404, "resource_missing", "No such product")
    _own_product(db, user, pid)
    db.execute(
        "UPDATE products SET name=?,description=?,price_minor=?,stock=?,emoji=?,image_url=?,category=? WHERE id=?",
        (body.name.strip(), body.description, body.price_minor, body.stock, body.emoji,
         body.image_url, body.category.strip(), pid),
    )
    return _product(db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone())


@router.delete("/products/{pid}")
def delete_product(pid: str, db: DB, user: CurrentUser):
    if user["role"] != "shop_owner":
        raise ApiError(404, "resource_missing", "No such product")
    _own_product(db, user, pid)
    db.execute("UPDATE products SET active=0 WHERE id=?", (pid,))  # soft delete keeps order history valid
    return {"id": pid, "deleted": True}


# --------------------------------------------------------------------- orders
def _order(db, row) -> dict:
    items = db.execute("SELECT product_id,name,unit_minor,quantity FROM order_items WHERE order_id=?", (row["id"],)).fetchall()
    pay = None
    if row["intent_id"]:
        pi = payments.public_intent(payments.get_intent(db, PLATFORM_ID, row["intent_id"]))
        pi.pop("client_secret", None)
        pay = pi
    return {"id": row["id"], "status": row["status"], "total_minor": row["total_minor"], "currency": row["currency"],
            "created_at": row["created_at"], "items": [dict(i) for i in items],
            "shipping": json.loads(row["shipping"]) if row["shipping"] else None, "payment": pay}


def _my_order(db, user, oid: str):
    row = db.execute("SELECT * FROM orders WHERE id=? AND buyer_id=?", (oid, user["id"])).fetchone()
    if not row:
        raise ApiError(404, "resource_missing", "No such order")
    return row


@router.post("/orders", status_code=201)
def create_order(body: OrderIn, db: DB, user: CurrentUser):
    lines, total, currency = [], 0, None
    for ln in body.items:
        p = db.execute("SELECT * FROM products WHERE id=? AND active=1", (ln.product_id,)).fetchone()
        if not p:
            raise ApiError(404, "resource_missing", f"Product {ln.product_id} not found")
        if p["seller_id"] == user["id"]:
            raise ApiError(422, "own_product", "You cannot buy your own product")
        if currency and p["currency"] != currency:
            raise ApiError(422, "mixed_currency", "All items in one order must share a currency")
        currency = p["currency"]
        lines.append((p, ln.quantity))
        total += p["price_minor"] * ln.quantity
    oid = new_id("ord")
    for p, qty in lines:  # atomic stock reservation
        cur = db.execute("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?", (qty, p["id"], qty))
        if not cur.rowcount:
            raise ApiError(409, "out_of_stock", f"Not enough stock for '{p['name']}'")
    intent = payments.create_intent(db, PLATFORM_ID, total, currency, f"Order {oid}", {"order_id": oid, "buyer_id": user["id"]})
    db.execute("INSERT INTO orders(id,buyer_id,total_minor,currency,status,intent_id,shipping) VALUES(?,?,?,?,?,?,?)",
               (oid, user["id"], total, currency, "pending_payment", intent["id"], body.shipping.model_dump_json()))
    for p, qty in lines:
        db.execute("INSERT INTO order_items(order_id,product_id,seller_id,name,unit_minor,quantity) VALUES(?,?,?,?,?,?)",
                   (oid, p["id"], p["seller_id"], p["name"], p["price_minor"], qty))
    audit(db, user["id"], "order.create", oid)
    return _order(db, db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())


@router.get("/orders")
def my_orders(db: DB, user: CurrentUser):
    rows = db.execute("SELECT * FROM orders WHERE buyer_id=? ORDER BY rowid DESC LIMIT 50", (user["id"],)).fetchall()
    return {"data": [_order(db, r) for r in rows]}


@router.get("/orders/{oid}")
def get_order(oid: str, db: DB, user: CurrentUser):
    return _order(db, _my_order(db, user, oid))


@router.post("/orders/{oid}/pay")
def pay_order(oid: str, body: PayIn, db: DB, user: CurrentUser, bg: BackgroundTasks):
    o = _my_order(db, user, oid)
    if o["status"] not in ("pending_payment", "payment_failed"):
        raise ApiError(409, "invalid_state", f"Order is '{o['status']}'")
    payments.confirm_intent(db, PLATFORM_ID, o["intent_id"], body.payment_method.model_dump())
    _queue(db, bg)
    return _order(db, db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())


@router.post("/orders/{oid}/authenticate")
def authenticate_order(oid: str, body: OtpIn, db: DB, user: CurrentUser, bg: BackgroundTasks):
    o = _my_order(db, user, oid)
    payments.authenticate_intent(db, PLATFORM_ID, o["intent_id"], body.otp)
    _queue(db, bg)
    return _order(db, db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())


@router.post("/orders/{oid}/cancel")
def cancel_order(oid: str, db: DB, user: CurrentUser, bg: BackgroundTasks):
    o = _my_order(db, user, oid)
    if o["status"] not in ("pending_payment", "payment_failed"):
        raise ApiError(409, "invalid_state", f"Order is '{o['status']}' and cannot be canceled")
    payments.cancel_intent(db, PLATFORM_ID, o["intent_id"])  # hook restores stock
    _queue(db, bg)
    return _order(db, db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())


@router.post("/orders/{oid}/simulate-settle")
def settle_order(oid: str, body: dict, db: DB, user: CurrentUser, bg: BackgroundTasks):
    """Buyer-side shortcut for async (wallet/bank) payments - sandbox only."""
    o = _my_order(db, user, oid)
    outcome = body.get("outcome", "succeeded")
    if outcome not in ("succeeded", "failed"):
        raise ApiError(422, "invalid_outcome", "outcome must be succeeded or failed")
    payments.settle_intent(db, PLATFORM_ID, o["intent_id"], outcome)
    _queue(db, bg)
    return _order(db, db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())


# --------------------------------------------------------------------- seller
@router.get("/seller/orders")
def seller_orders(db: DB, user: ShopOwner):
    rows = db.execute(
        "SELECT oi.order_id, oi.name, oi.quantity, oi.unit_minor, o.status, o.currency, o.created_at, o.shipping, u.username buyer "
        "FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.buyer_id "
        "WHERE oi.seller_id=? ORDER BY oi.id DESC LIMIT 100", (user["id"],)).fetchall()
    return {"data": [{**{k: r[k] for k in ("order_id", "name", "quantity", "unit_minor", "status", "currency",
                                                  "created_at", "buyer")},
                      "ship_to": json.loads(r["shipping"])["name"] if r["status"] == "paid" else None} for r in rows]}


@router.get("/seller/summary")
def seller_summary(db: DB, user: ShopOwner):
    def total(status):
        return db.execute(
            "SELECT COALESCE(SUM(oi.unit_minor*oi.quantity),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id "
            "WHERE oi.seller_id=? AND o.status=?", (user["id"], status)).fetchone()[0]
    return {"currency": "NGN", "paid_minor": total("paid"), "refunded_minor": total("refunded"),
            "awaiting_payment_minor": total("pending_payment")}


@router.post("/orders/{oid}/refund")
def refund_order(oid: str, db: DB, user: CurrentUser, bg: BackgroundTasks):
    """A shop owner may fully refund an order only if every item in it is theirs."""
    if user["role"] != "shop_owner":
        raise ApiError(404, "resource_missing", "No such order")
    o = db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
    owners = {r["seller_id"] for r in db.execute("SELECT seller_id FROM order_items WHERE order_id=?", (oid,))}
    if not o or owners != {user["id"]}:
        raise ApiError(404, "resource_missing", "No such order")
    if o["status"] != "paid":
        raise ApiError(409, "invalid_state", "Only paid orders can be refunded")
    payments.create_refund(db, PLATFORM_ID, o["intent_id"], None, "seller_refund")
    _restore_stock(db, oid)
    audit(db, user["id"], "order.refund", oid)
    _queue(db, bg)
    return _order(db, db.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone())


# --------------------------------------------------------------------- superuser admin
@router.get("/admin/orders")
def admin_orders(db: DB, _admin: Superuser):
    rows = db.execute("SELECT * FROM orders ORDER BY rowid DESC LIMIT 100").fetchall()
    return {"data": [_order(db, r) for r in rows]}


@router.get("/admin/products")
def admin_products(db: DB, _admin: Superuser):
    rows = db.execute(
        "SELECT p.*, u.username seller FROM products p JOIN users u ON u.id=p.seller_id ORDER BY p.rowid DESC LIMIT 200").fetchall()
    return {"data": [{**_product(r), "seller": r["seller"]} for r in rows]}


@router.put("/admin/products/{pid}")
def admin_update_product(pid: str, body: ProductIn, db: DB, _admin: Superuser):
    row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    if not row:
        raise ApiError(404, "resource_missing", "No such product")
    if body.currency.upper() not in payments.CURRENCIES:
        raise ApiError(422, "invalid_currency", "Unsupported currency")
    db.execute(
        "UPDATE products SET name=?,description=?,price_minor=?,stock=?,emoji=?,image_url=?,category=? WHERE id=?",
        (body.name.strip(), body.description, body.price_minor, body.stock, body.emoji,
         body.image_url, body.category.strip(), pid),
    )
    return _product(db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone())


@router.delete("/admin/products/{pid}")
def admin_delete_product(pid: str, db: DB, _admin: Superuser):
    row = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    if not row:
        raise ApiError(404, "resource_missing", "No such product")
    db.execute("UPDATE products SET active=0 WHERE id=?", (pid,))
    return {"id": pid, "deleted": True}
