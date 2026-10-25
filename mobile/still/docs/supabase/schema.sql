-- STILL mobile schema for Supabase
-- Project: onlkjdgqmhajflylppnp
--
-- Apply with the Supabase SQL editor, or:
--   supabase db push
--
-- The app reads: profiles, products, orders, order_items, payment_intents,
-- and refunds. Tables are RLS-enabled; the policies follow the app's current
-- access model (public catalogue, buyer-owned orders, seller-owned products,
-- merchant-owned payment records).
--
-- Auth and catalogue are decoupled in the app: EXPO_PUBLIC_AUTH_DEMO controls
-- auth, EXPO_PUBLIC_DATA_MODE controls whether screens read Supabase or the
-- on-device sandbox.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text not null,
  role text not null default 'customer'
    check (role in ('customer', 'shop_owner', 'superuser')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_minor integer not null check (price_minor > 0),
  currency text not null default 'NGN'
    check (currency in ('NGN', 'GHS', 'KES', 'USD')),
  stock integer not null default 0 check (stock >= 0),
  emoji text not null default '',
  image_url text not null default '',
  category text not null default 'Objects',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount >= 0),
  currency text not null default 'NGN'
    check (currency in ('NGN', 'GHS', 'KES', 'USD')),
  status text not null default 'requires_payment_method'
    check (status in (
      'requires_payment_method', 'requires_action', 'processing',
      'succeeded', 'failed', 'canceled'
    )),
  description text,
  metadata jsonb not null default '{}',
  payment_method jsonb,
  failure_code text,
  failure_message text,
  next_action jsonb,
  amount_refunded integer not null default 0 check (amount_refunded >= 0),
  client_secret text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  total_minor integer not null check (total_minor >= 0),
  currency text not null default 'NGN'
    check (currency in ('NGN', 'GHS', 'KES', 'USD')),
  status text not null default 'pending_payment'
    check (status in (
      'pending_payment', 'paid', 'payment_failed', 'canceled', 'refunded'
    )),
  intent_id uuid references public.payment_intents(id) on delete set null,
  shipping jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint primary key generated always as identity,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  unit_minor integer not null check (unit_minor >= 0),
  quantity integer not null check (quantity >= 1),
  emoji text not null default '',
  image_url text not null default ''
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  intent_id uuid not null references public.payment_intents(id) on delete cascade,
  amount integer not null check (amount >= 0),
  status text not null default 'succeeded',
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_products_seller_active
  on public.products(seller_id, active);
create index if not exists idx_products_category
  on public.products(category);
create index if not exists idx_orders_buyer
  on public.orders(buyer_id);
create index if not exists idx_orders_created_at
  on public.orders(created_at desc);
create index if not exists idx_orders_intent
  on public.orders(intent_id);
create index if not exists idx_order_items_order
  on public.order_items(order_id);
create index if not exists idx_order_items_seller
  on public.order_items(seller_id);
create index if not exists idx_order_items_product
  on public.order_items(product_id);
create index if not exists idx_payment_intents_merchant
  on public.payment_intents(merchant_id);
create index if not exists idx_refunds_merchant
  on public.refunds(merchant_id);
create index if not exists idx_refunds_intent
  on public.refunds(intent_id);
create index if not exists idx_profiles_username
  on public.profiles(username);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Authorization data lives in app_metadata (never user_metadata, which users
-- can edit). Claims can be stale until the JWT refreshes.
create or replace function public.is_superuser()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superuser',
    false
  );
$$;

create or replace function public.is_shop_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('shop_owner', 'superuser'),
    false
  );
$$;

-- Admin-only profile listing. SECURITY DEFINER lets this read email/role that
-- ordinary users cannot select, but the function refuses non-superusers.
-- It is intentionally executable by authenticated (the app calls it via RPC);
-- the anon role is explicitly revoked.
create or replace function public.admin_list_profiles()
returns table (
  id uuid,
  email text,
  username text,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email, p.username, p.role, p.created_at
  from public.profiles p
  where public.is_superuser()
  order by p.created_at desc
  limit 100;
$$;

revoke execute on function public.admin_list_profiles() from anon, public;
grant execute on function public.admin_list_profiles() to authenticated;

-- Create a profile row for every new auth user. The trigger runs as the
-- function owner, so it can insert even though clients cannot insert profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, username, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    ),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from anon, authenticated, public;
grant execute on function public.handle_new_user()
  to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.payment_intents enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.refunds enable row level security;

-- Profiles -------------------------------------------------------------------
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;

-- All rows are readable, but column grants below limit anonymous/authenticated
-- reads to id, username, avatar_url and created_at. Email and role are not
-- exposed. The admin RPC is the only way to read email/role.
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated
  using (true);

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Supabase grants ALL on new public tables by default. Revoke that baseline
-- before granting the narrow set the app needs.
revoke all on public.profiles from anon, authenticated;

grant select (id, username, avatar_url, created_at)
  on public.profiles to anon, authenticated;
grant update (username, avatar_url)
  on public.profiles to authenticated;

-- Products -------------------------------------------------------------------
drop policy if exists "products_select_public" on public.products;
drop policy if exists "products_insert_seller" on public.products;
drop policy if exists "products_update_seller" on public.products;
drop policy if exists "products_delete_seller" on public.products;

create policy "products_select_public" on public.products
  for select to anon, authenticated
  using (
    active = true
    or (select auth.uid()) = seller_id
    or (select public.is_superuser())
  );

create policy "products_insert_seller" on public.products
  for insert to authenticated
  with check ((select auth.uid()) = seller_id or (select public.is_superuser()));

create policy "products_update_seller" on public.products
  for update to authenticated
  using ((select auth.uid()) = seller_id or (select public.is_superuser()))
  with check ((select auth.uid()) = seller_id or (select public.is_superuser()));

create policy "products_delete_seller" on public.products
  for delete to authenticated
  using ((select auth.uid()) = seller_id or (select public.is_superuser()));

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Payment intents ------------------------------------------------------------
drop policy if exists "payment_intents_select_merchant" on public.payment_intents;
drop policy if exists "payment_intents_select_buyer" on public.payment_intents;
drop policy if exists "payment_intents_select_related" on public.payment_intents;
drop policy if exists "payment_intents_insert_merchant" on public.payment_intents;
drop policy if exists "payment_intents_update_merchant" on public.payment_intents;

-- One SELECT policy keeps the buyer and merchant checks in a single pass.
create policy "payment_intents_select_related" on public.payment_intents
  for select to authenticated
  using (
    (select auth.uid()) = merchant_id
    or (select public.is_superuser())
    or exists (
      select 1
      from public.orders o
      where o.intent_id = payment_intents.id
        and o.buyer_id = (select auth.uid())
    )
  );

create policy "payment_intents_insert_merchant" on public.payment_intents
  for insert to authenticated
  with check ((select auth.uid()) = merchant_id or (select public.is_superuser()));

create policy "payment_intents_update_merchant" on public.payment_intents
  for update to authenticated
  using ((select auth.uid()) = merchant_id or (select public.is_superuser()))
  with check ((select auth.uid()) = merchant_id or (select public.is_superuser()));

-- client_secret is deliberately not granted to clients. Buyers can see the
-- payment record attached to their order, but never the secret. Revoke the
-- default ALL grant first so INSERT/UPDATE cannot bypass this column list.
revoke all on public.payment_intents from anon, authenticated;
grant select (
  id, merchant_id, amount, currency, status, description, metadata,
  payment_method, failure_code, failure_message, next_action,
  amount_refunded, created_at
) on public.payment_intents to authenticated;
grant insert (
  id, merchant_id, amount, currency, status, description, metadata,
  payment_method, failure_code, failure_message, next_action,
  amount_refunded, created_at
) on public.payment_intents to authenticated;
grant update (
  amount, currency, status, description, metadata, payment_method,
  failure_code, failure_message, next_action, amount_refunded
) on public.payment_intents to authenticated;

-- Orders ---------------------------------------------------------------------
drop policy if exists "orders_select_buyer" on public.orders;
drop policy if exists "orders_insert_buyer" on public.orders;
drop policy if exists "orders_update_buyer" on public.orders;

create policy "orders_select_buyer" on public.orders
  for select to authenticated
  using ((select auth.uid()) = buyer_id or (select public.is_superuser()));

create policy "orders_insert_buyer" on public.orders
  for insert to authenticated
  with check ((select auth.uid()) = buyer_id);

-- Status changes are intentionally service-role only. The mobile app keeps
-- sandbox orders on-device; remote order writes are a later migration.
revoke all on public.orders from anon, authenticated;
grant select, insert on public.orders to authenticated;

-- Order items ----------------------------------------------------------------
drop policy if exists "order_items_select_related" on public.order_items;
drop policy if exists "order_items_insert_buyer" on public.order_items;

create policy "order_items_select_related" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.buyer_id = (select auth.uid())
    )
    or (select auth.uid()) = seller_id
    or (select public.is_superuser())
  );

create policy "order_items_insert_buyer" on public.order_items
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.buyer_id = (select auth.uid())
    )
  );

revoke all on public.order_items from anon, authenticated;
grant select, insert on public.order_items to authenticated;

-- Refunds --------------------------------------------------------------------
drop policy if exists "refunds_select_merchant" on public.refunds;
drop policy if exists "refunds_insert_merchant" on public.refunds;

create policy "refunds_select_merchant" on public.refunds
  for select to authenticated
  using ((select auth.uid()) = merchant_id or (select public.is_superuser()));

create policy "refunds_insert_merchant" on public.refunds
  for insert to authenticated
  with check ((select auth.uid()) = merchant_id or (select public.is_superuser()));

revoke all on public.refunds from anon, authenticated;
grant select, insert on public.refunds to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill profiles for auth users created before the trigger
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, username, role)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    split_part(u.email, '@', 1)
  ),
  'customer'
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed the demo seller and catalogue
-- ---------------------------------------------------------------------------
-- These image URLs point at an immutable commit in the public repository.
-- Move them to Supabase Storage when the catalogue is managed remotely.
insert into public.profiles (id, email, username, role)
values (
  '00000000-0000-4000-8000-000000000001',
  'studio@still.local',
  'Atelier Sandbox',
  'shop_owner'
)
on conflict do nothing;

insert into public.products (
  id, seller_id, name, description, price_minor, currency, stock,
  emoji, image_url, category, active
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Arc Counter Stool',
    'Solid oak with a powder-coated steel footrest. 66 cm seat height, built for long mornings at the counter.',
    7800000, 'NGN', 14, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/arc-counter-stool.jpg',
    'Furniture', true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'Pivot Lounge Chair',
    'A moulded shell on a solid ash base. Low, wide and unexpectedly comfortable — the chair everyone reaches for.',
    14500000, 'NGN', 9, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/pivot-lounge-chair.jpg',
    'Furniture', true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'Moss Velvet Sofa',
    'Three generous seats in dense cotton velvet. Solid beech frame, feather-wrapped cushions, removable covers.',
    48000000, 'NGN', 4, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/moss-velvet-sofa.jpg',
    'Furniture', true
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'Tan Leather Sofa',
    'Full-grain leather that softens with use. Three seats, low arms and solid oak feet. A piece that gets better with age.',
    52000000, 'NGN', 3, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/tan-leather-sofa.jpg',
    'Furniture', true
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'Studio Mug',
    'Stoneware mug with a generous handle and a satin glaze. 350 ml, dishwasher safe, made for the second cup.',
    1250000, 'NGN', 36, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/studio-mug.jpg',
    'Kitchen', true
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    'Everyday Flask',
    'Double-wall stainless steel, 500 ml. Keeps coffee hot for six hours and fits the side pocket of almost any bag.',
    1800000, 'NGN', 28, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/everyday-flask.jpg',
    'Objects', true
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000001',
    'Field Watch',
    'Brushed aluminium case, sapphire face and a soft silicone strap. Water-resistant to 50 m, quietly precise.',
    9500000, 'NGN', 11, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/field-watch.jpg',
    'Objects', true
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000001',
    'Instant Camera',
    'Point-and-shoot instant camera with a built-in flash. Uses standard instant film — the good kind of slow.',
    16500000, 'NGN', 7, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/instant-camera.jpg',
    'Objects', true
  ),
  (
    '10000000-0000-4000-8000-000000000009',
    '00000000-0000-4000-8000-000000000001',
    'Knit Runner',
    'Lightweight knit upper on a cushioned sole. Made for the walk that turns into a run.',
    7200000, 'NGN', 16, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/knit-runner.jpg',
    'Apparel', true
  ),
  (
    '10000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    'Leather Mini Bag',
    'Structured mini bag in pebbled leather. Fits a phone, cardholder and keys — nothing more, which is the point.',
    8800000, 'NGN', 12, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/leather-mini-bag.jpg',
    'Carry', true
  ),
  (
    '10000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'Single Origin Coffee',
    'Washed Ethiopian beans roasted for filter. Notes of peach, jasmine and brown sugar. 250 g, whole bean.',
    950000, 'NGN', 42, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/single-origin-coffee.jpg',
    'Kitchen', true
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000001',
    'Botanical Face Oil',
    'Cold-pressed rosehip and squalane. Three drops, morning and night, and a minute that belongs to you.',
    2400000, 'NGN', 25, '',
    'https://raw.githubusercontent.com/Contractor-x/signin-signup-system/0c96b78/mobile/still/assets/products/botanical-face-oil.jpg',
    'Apothecary', true
  )
on conflict (id) do nothing;
