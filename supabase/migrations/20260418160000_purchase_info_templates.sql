-- 카톡 등에 붙여넣을 구매 정보 템플릿 (사용자별)

create table public.purchase_info_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),

  title text not null,
  buyer_name text,
  recipient_name text,
  login_id text,
  phone text,
  address text,
  bank_account_number text,
  account_holder text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_info_templates_user_id_idx on public.purchase_info_templates (user_id);
create index purchase_info_templates_created_at_idx on public.purchase_info_templates (created_at desc);

create or replace function public.set_purchase_info_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger purchase_info_templates_set_updated_at
  before update on public.purchase_info_templates
  for each row
  execute procedure public.set_purchase_info_templates_updated_at();

alter table public.purchase_info_templates enable row level security;

create policy "purchase_info_templates_select_own"
  on public.purchase_info_templates
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "purchase_info_templates_insert_own"
  on public.purchase_info_templates
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "purchase_info_templates_update_own"
  on public.purchase_info_templates
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "purchase_info_templates_delete_own"
  on public.purchase_info_templates
  for delete
  to authenticated
  using (auth.uid() = user_id);
