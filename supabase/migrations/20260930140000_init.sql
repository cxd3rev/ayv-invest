-- AYV Invest schema
-- Run this file in the Supabase SQL editor for a new project.
-- Users can only read and write their own portfolio data. Assets are shared reference data.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default '',
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 40)
);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Main',
  base_currency text not null default 'EUR' check (base_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portfolios_user_id_idx on public.portfolios (user_id, created_at);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text not null,
  asset_type text not null check (asset_type in ('stock', 'etf', 'crypto')),
  exchange text,
  currency text not null,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  asset_id uuid not null references public.assets (id),
  transaction_type text not null check (transaction_type in ('buy', 'sell')),
  quantity numeric(20, 8) not null check (quantity > 0),
  price numeric(20, 8) not null check (price >= 0),
  fees numeric(20, 8) not null default 0 check (fees >= 0),
  currency text not null,
  transaction_date date not null,
  origin text not null default 'manual' check (origin in ('manual', 'sample')),
  created_at timestamptz not null default now()
);

create index transactions_portfolio_date_idx
  on public.transactions (portfolio_id, transaction_date desc, created_at desc);

create index transactions_portfolio_asset_idx
  on public.transactions (portfolio_id, asset_id);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  snapshot_date date not null,
  total_value numeric(20, 8) not null,
  total_invested numeric(20, 8) not null,
  created_at timestamptz not null default now(),
  unique (portfolio_id, snapshot_date)
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

create trigger assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Investor')
  );

  insert into public.portfolios (user_id, name, base_currency)
  values (new.id, 'Main', 'EUR');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.upsert_asset(
  p_symbol text,
  p_name text,
  p_asset_type text,
  p_exchange text,
  p_currency text,
  p_external_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_asset_type not in ('stock', 'etf', 'crypto') then
    raise exception 'Invalid asset type';
  end if;

  if char_length(trim(p_symbol)) < 1 or char_length(trim(p_symbol)) > 32 then
    raise exception 'Invalid symbol';
  end if;

  insert into public.assets (symbol, name, asset_type, exchange, currency, external_id)
  values (
    upper(trim(p_symbol)),
    left(trim(p_name), 160),
    p_asset_type,
    nullif(left(trim(coalesce(p_exchange, '')), 80), ''),
    upper(trim(p_currency)),
    nullif(left(trim(coalesce(p_external_id, '')), 80), '')
  )
  on conflict (symbol) do update
    set name = excluded.name,
        asset_type = excluded.asset_type,
        exchange = coalesce(excluded.exchange, public.assets.exchange),
        currency = excluded.currency,
        external_id = coalesce(excluded.external_id, public.assets.external_id),
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.enforce_position()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_portfolio uuid;
  v_asset uuid;
  v_qty numeric := 0;
  r record;
begin
  if tg_op = 'DELETE' then
    v_portfolio := old.portfolio_id;
    v_asset := old.asset_id;
  else
    v_portfolio := new.portfolio_id;
    v_asset := new.asset_id;
  end if;

  for r in
    select transaction_type, quantity
    from public.transactions
    where portfolio_id = v_portfolio
      and asset_id = v_asset
    order by transaction_date asc, created_at asc, id asc
  loop
    if r.transaction_type = 'buy' then
      v_qty := v_qty + r.quantity;
    else
      v_qty := v_qty - r.quantity;
    end if;

    if v_qty < -0.00000001 then
      raise exception 'SELL_EXCEEDS_POSITION';
    end if;
  end loop;

  return null;
end;
$$;

create trigger transactions_enforce_position
  after insert or delete on public.transactions
  for each row execute function public.enforce_position();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.assets enable row level security;
alter table public.transactions enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users read own portfolios"
  on public.portfolios for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users insert own portfolios"
  on public.portfolios for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own portfolios"
  on public.portfolios for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Authenticated users read assets"
  on public.assets for select
  to authenticated
  using (true);

create policy "Users read own transactions"
  on public.transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "Users insert own transactions"
  on public.transactions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "Users delete own transactions"
  on public.transactions for delete
  to authenticated
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = transactions.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "Users read own snapshots"
  on public.portfolio_snapshots for select
  to authenticated
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_snapshots.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "Users insert own snapshots"
  on public.portfolio_snapshots for insert
  to authenticated
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_snapshots.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

create policy "Users update own snapshots"
  on public.portfolio_snapshots for update
  to authenticated
  using (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_snapshots.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios
      where portfolios.id = portfolio_snapshots.portfolio_id
        and portfolios.user_id = auth.uid()
    )
  );

revoke all on public.profiles from anon;
revoke all on public.portfolios from anon;
revoke all on public.assets from anon;
revoke all on public.transactions from anon;
revoke all on public.portfolio_snapshots from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.portfolios to authenticated;
grant select on public.assets to authenticated;
grant select, insert, delete on public.transactions to authenticated;
grant select, insert, update on public.portfolio_snapshots to authenticated;
grant execute on function public.upsert_asset(text, text, text, text, text, text) to authenticated;
