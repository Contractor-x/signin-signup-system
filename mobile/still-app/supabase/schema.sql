-- Supabase schema for STILL app (React Native + Expo)
-- This replaces the SQLite schema from the FastAPI backend.
-- Run once in the Supabase SQL Editor, or via `supabase db push`.

-- ------------------------------------------------------------------
-- Enable extensions
-- ------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Profiles (replaces `users` from SQLite)
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text not null,
  role text not null default 'customer' check (role in ('customer','shop_owner','superuser')),
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- ------------------------------------------------------------------
-- Products
-- ------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text default '',
  price_minor integer not null check (price_minor > 0),
  currency text not null default 'NGN' check (currency in ('NGN','GHS','KES','USD')),
  stock integer not null check (stock >= 0),
  emoji text default '📦',
  image_url text default '',
  category text not null default 'Home',
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.products enable row level security;

-- ------------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  total_minor integer not null,
  currency text not null default 'NGN',
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','payment_failed','canceled','refunded')),
  intent_id uuid,
  shipping jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.orders enable row level security;

-- ------------------------------------------------------------------
-- Order items
-- ------------------------------------------------------------------
create table if not exists public.order_items (
  id bigint primary key generated always as identity,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  unit_minor integer not null,
  quantity integer not null check (quantity >= 1)
);

alter table public.order_items enable row level security;

-- ------------------------------------------------------------------
-- Payment intents (sandbox)
-- ------------------------------------------------------------------
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  currency text not null default 'NGN',
  status text not null default 'requires_payment_method' check (status in ('requires_payment_method','requires_action','processing','succeeded','failed','canceled')),
  description text,
  metadata jsonb not null default '{}',
  payment_method jsonb,
  failure_code text,
  failure_message text,
  next_action jsonb,
  amount_refunded integer not null default 0,
  client_secret text,
  created_at timestamptz default now()
);

alter table public.payment_intents enable row level security;

-- ------------------------------------------------------------------
-- Refunds
-- ------------------------------------------------------------------
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  intent_id uuid not null references public.payment_intents(id) on delete cascade,
  amount integer not null,
  status text not null default 'succeeded',
  reason text,
  created_at timestamptz default now()
);

alter table public.refunds enable row level security;

-- ------------------------------------------------------------------
-- API keys (sandbox developer keys)
-- ------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key_hash text unique not null,
  hint text not null,
  revoked boolean not null default false,
  created_at timestamptz default now()
);

alter table public.api_keys enable row level security;

-- ------------------------------------------------------------------
-- Webhook endpoints
-- ------------------------------------------------------------------
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  secret text not null,
  events text not null default '*',
  created_at timestamptz default now()
);

alter table public.webhook_endpoints enable row level security;

-- ------------------------------------------------------------------
-- Events
-- ------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.events enable row level security;

-- ------------------------------------------------------------------
-- Deliveries (webhook)
-- ------------------------------------------------------------------
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempts integer not null default 0,
  response_code integer,
  detail text,
  updated_at timestamptz default now()
);

alter table public.deliveries enable row level security;

-- ------------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint primary key generated always as identity,
  actor uuid references public.profiles(id) on delete set null,
  action text not null,
  target text,
  created_at timestamptz default now()
);

alter table public.audit_log enable row level security;

-- ------------------------------------------------------------------
-- Reset tokens (password reset via Supabase Auth - kept for reference;
-- Supabase Auth handles password reset natively. This table is kept
-- for compatibility with the dev outbox flow.)
-- ------------------------------------------------------------------
create table if not exists public.reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz default now()
);

alter table public.reset_tokens enable row level security;

-- ------------------------------------------------------------------
-- RLS Policies
-- ------------------------------------------------------------------

-- Profiles: public read, self write
create policy "profiles_select_public" on public.profiles for select using (true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id);

-- Products: public read active, seller write
create policy "products_select_public" on public.products for select using (active = true);
create policy "products_insert_seller" on public.products for insert with check (auth.uid() = seller_id);
create policy "products_update_seller" on public.products for update using (auth.uid() = seller_id);
create policy "products_delete_seller" on public.products for delete using (auth.uid() = seller_id);

-- Orders: buyer read/write own
create policy "orders_select_buyer" on public.orders for select using (auth.uid() = buyer_id);
create policy "orders_insert_buyer" on public.orders for insert with check (auth.uid() = buyer_id);
create policy "orders_update_buyer" on public.orders for update using (auth.uid() = buyer_id);

-- Order items: readable by order buyer or item seller
create policy "order_items_select_related" on public.order_items for select
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
    or auth.uid() = seller_id
  );

-- Payment intents: merchant read/write own
create policy "payment_intents_select_merchant" on public.payment_intents for select using (auth.uid() = merchant_id);
create policy "payment_intents_insert_merchant" on public.payment_intents for insert with check (auth.uid() = merchant_id);
create policy "payment_intents_update_merchant" on public.payment_intents for update using (auth.uid() = merchant_id);

-- Refunds: merchant read/write own
create policy "refunds_select_merchant" on public.refunds for select using (auth.uid() = merchant_id);
create policy "refunds_insert_merchant" on public.refunds for insert with check (auth.uid() = merchant_id);

-- API keys: owner read/write
create policy "api_keys_select_owner" on public.api_keys for select using (auth.uid() = user_id);
create policy "api_keys_insert_owner" on public.api_keys for insert with check (auth.uid() = user_id);
create policy "api_keys_update_owner" on public.api_keys for update using (auth.uid() = user_id);
create policy "api_keys_delete_owner" on public.api_keys for delete using (auth.uid() = user_id);

-- Webhook endpoints: merchant read/write own
create policy "webhook_endpoints_select_merchant" on public.webhook_endpoints for select using (auth.uid() = merchant_id);
create policy "webhook_endpoints_insert_merchant" on public.webhook_endpoints for insert with check (auth.uid() = merchant_id);
create policy "webhook_endpoints_update_merchant" on public.webhook_endpoints for update using (auth.uid() = merchant_id);
create policy "webhook_endpoints_delete_merchant" on public.webhook_endpoints for delete using (auth.uid() = merchant_id);

-- Events: merchant read own
create policy "events_select_merchant" on public.events for select using (auth.uid() = merchant_id);

-- Deliveries: readable via endpoint ownership
create policy "deliveries_select_related" on public.deliveries for select
  using (
    exists (select 1 from public.webhook_endpoints w where w.id = deliveries.endpoint_id and w.merchant_id = auth.uid())
  );

-- Audit log: public read, service insert only
create policy "audit_log_select_public" on public.audit_log for select using (true);

-- Reset tokens: owner read/write
create policy "reset_tokens_select_owner" on public.reset_tokens for select using (auth.uid() = user_id);
create policy "reset_tokens_insert_owner" on public.reset_tokens for insert with check (auth.uid() = user_id);
create policy "reset_tokens_update_owner" on public.reset_tokens for update using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------
create index if not exists idx_products_seller_active on public.products(seller_id, active);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_orders_buyer on public.orders(buyer_id);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_payment_intents_merchant on public.payment_intents(merchant_id);
create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
