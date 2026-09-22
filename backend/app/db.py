import logging

from supabase import Client, create_client

from .config import settings

logger = logging.getLogger("auth_api")

# Everyday client. The anon key is enough for auth + reads/writes that RLS allows.
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Server-side client. When a service-role key is present it bypasses RLS, so
# profile rows are saved regardless of table policies. Never expose this key
# to the browser.
_service: Client | None = None
if settings.SUPABASE_SERVICE_ROLE_KEY:
    _service = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

PROFILES_TABLE = "profiles"


def _client() -> Client:
    """Prefer the service-role client (bypasses RLS) when configured."""
    return _service or supabase


def upsert_profile(email: str, username: str | None = None) -> dict | None:
    """Inserting a profile row for the email and refreshing the username if it exists.
    then returning the row, or None is called,the database rejected the write
    """
    try:
        table = _client().table(PROFILES_TABLE)
        existing = table.select("*").eq("email", email).execute()
        if existing.data:
            updated = (
                table.update({"username": username}).eq("email", email).execute()
            )
            return updated.data[0]
        created = table.insert({"email": email, "username": username}).execute()
        return created.data[0]
    except Exception as exc:
        logger.warning("profiles write skipped (%s)", exc)
        return None


def get_profile_by_email(email: str) -> dict | None:
    """Fetch the profile row (email + username) for a given email."""
    try:
        resp = _client().table(PROFILES_TABLE).select("*").eq("email", email).execute()
        return resp.data[0] if resp.data else None
    except Exception as exc:
        logger.warning("profiles read skipped (%s)", exc)
        return None