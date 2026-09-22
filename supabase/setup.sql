create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_insert" on profiles
  for insert to anon, authenticated
  with check (true);

create policy "profiles_select" on profiles
  for select to anon, authenticated
  using (true);

create policy "profiles_update" on profiles
  for update to anon, authenticated
  using (true)
  with check (true);

create policy "profiles_delete" on profiles
  for delete to anon, authenticated
  using (true);