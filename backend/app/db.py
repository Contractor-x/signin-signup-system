"""SQLite persistence (offline replacement for the old Supabase layer).

Money is always stored as INTEGER minor units (kobo/cents) - never floats.
"""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from .config import settings, ROLES
from .security import new_id, hash_password

PLATFORM_ID = "usr_platform"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reset_tokens(
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS outbox(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT, subject TEXT, body TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS api_keys(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  key_hash TEXT UNIQUE NOT NULL, hint TEXT NOT NULL, revoked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS products(
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_minor INTEGER NOT NULL CHECK(price_minor>0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  stock INTEGER NOT NULL CHECK(stock>=0),
  emoji TEXT DEFAULT '📦',
  image_url TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Home',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id),
  total_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  intent_id TEXT,
  shipping TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  seller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_minor INTEGER NOT NULL,
  quantity INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS payment_intents(
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
  description TEXT, metadata TEXT DEFAULT '{}', payment_method TEXT,
  failure_code TEXT, failure_message TEXT, next_action TEXT,
  amount_refunded INTEGER DEFAULT 0, client_secret TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS refunds(
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, intent_id TEXT NOT NULL REFERENCES payment_intents(id),
  amount INTEGER NOT NULL, status TEXT NOT NULL, reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS idempotency(
  merchant_id TEXT, route TEXT, key TEXT, response TEXT,
  PRIMARY KEY(merchant_id, route, key));
CREATE TABLE IF NOT EXISTS webhook_endpoints(
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '*', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS events(
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL, type TEXT NOT NULL,
  payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS deliveries(
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id),
  endpoint_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0, response_code INTEGER, detail TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT, target TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
"""


def connect() -> sqlite3.Connection:
    Path(settings.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one transaction per request, rolled back on error."""
    with tx() as conn:
        yield conn


def audit(db: sqlite3.Connection, actor: str, action: str, target: str = "") -> None:
    db.execute("INSERT INTO audit_log(actor,action,target) VALUES(?,?,?)", (actor, action, target))


def init_db() -> None:
    with tx() as db:
        db.executescript(SCHEMA)
        # Backfill the role column for databases created before roles existed.
        cols = {r["name"] for r in db.execute("PRAGMA table_info(users)")}
        if "role" not in cols:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'")
        # Backfill image_url / category for older product schemas.
        pcols = {r["name"] for r in db.execute("PRAGMA table_info(products)")}
        if "image_url" not in pcols:
            db.execute("ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT ''")
        if "category" not in pcols:
            db.execute("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'Home'")
        # Internal platform merchant that owns the storefront's payments.
        # It cannot log in (password hash is a disabled marker).
        db.execute(
            "INSERT OR IGNORE INTO users(id,email,username,password_hash,role) "
            "VALUES(?,?,?,?,?)",
            (PLATFORM_ID, "platform@sandbox.local", "platform", "!disabled", "superuser"),
        )
        # Seed a default superuser so the platform can be administered out of
        # the box. In production this account must be rotated / protected.
        db.execute(
            "INSERT OR IGNORE INTO users(id,email,username,password_hash,role) "
            "VALUES(?,?,?,?,?)",
            (
                new_id("usr"),
                "admin@sandbox.local",
                "admin",
                hash_password("Admin1234!"),
                "superuser",
            ),
        )
