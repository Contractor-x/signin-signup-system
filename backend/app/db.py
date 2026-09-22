"""Supabase client and helpers for the `profiles` table.

The `profiles` table keeps the email + username of every user.
Populate it once from the Supabase dashboard (SQL editor):

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  sub text unique not null,          -- Google subject ID
  email text unique not null,
  username text,
  avatar_url text,
  created_at timestamptz default now()
);
```
"""

from supabase import Client, create_client

from .config import settings

# Authenticated client. The anon key is enough for everyday auth operations;
# enable RLS on `profiles` so users only ever read/write their own row.
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

PROFILES_TABLE = "profiles"


def upsert_profile(sub: str, email: str, username: str | None = None) -> dict:
    """Insert a new profile row, or return the existing row for that email.

    Google auth is not idempotent on Supabase sessions, so this helper keeps
    email + username in sync (email -> thrown away if it already exists).
    """
    existing = supabase.table(PROFILES_TABLE).select("*").eq("email", email).execute()
    if existing.data:
        return existing.data[0]

    row = {"sub": sub, "email": email, "username": username}
    created = supabase.table(PROFILES_TABLE).insert(row).execute()
    return created.data[0]


def get_profile_by_email(email: str) -> dict | None:
    """Fetch the profile row (email + username) for a given email."""
    resp = supabase.table(PROFILES_TABLE).select("*").eq("email", email).execute()
    return resp.data[0] if resp.data else None