-- Ledger + Phase 2 automation fields (spreadsheet columns + nullable extensions)

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),

  product_name text not null,
  is_processed boolean not null default false,
  purchase_date date not null,
  deposit_date date,
  purchase_price_krw numeric(12, 2) not null,
  deposit_amount_krw numeric(12, 2),
  profit_krw numeric(12, 2),
  is_item_delivered boolean not null default false,
  deposit_memo text,
  notes text,

  product_url text,
  review_fee_krw numeric(12, 2),
  scheduled_purchase_at timestamptz,
  order_number text,
  screenshot_storage_path text,
  order_status text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_purchase_date_idx on public.orders (purchase_date desc);
create index orders_scheduled_purchase_at_idx on public.orders (scheduled_purchase_at)
  where scheduled_purchase_at is not null;

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute procedure public.set_orders_updated_at();

alter table public.orders enable row level security;

create policy "orders_select_own"
  on public.orders
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "orders_insert_own"
  on public.orders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "orders_update_own"
  on public.orders
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "orders_delete_own"
  on public.orders
  for delete
  to authenticated
  using (auth.uid() = user_id);
