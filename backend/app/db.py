"""Supabase client and helpers for the `profiles` table.

The `profiles` table keeps the email + username of every user.
Create it once in the Supabase dashboard (SQL editor), or via the
Supabase MCP:

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text,
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


def upsert_profile(email: str, username: str | None = None) -> dict:
    """Insert a new profile row, or update the username if the email exists."""
    existing = supabase.table(PROFILES_TABLE).select("*").eq("email", email).execute()
    if existing.data:
        # email already exists -> keep the row, refresh the username.
        updated = (
            supabase.table(PROFILES_TABLE)
            .update({"username": username})
            .eq("email", email)
            .execute()
        )
        return updated.data[0]

    row = {"email": email, "username": username}
    created = supabase.table(PROFILES_TABLE).insert(row).execute()
    return created.data[0]


def get_profile_by_email(email: str) -> dict | None:
    """Fetch the profile row (email + username) for a given email."""
    resp = supabase.table(PROFILES_TABLE).select("*").eq("email", email).execute()
    return resp.data[0] if resp.data else None