-- 주문 작성 흐름과 원장 보기 설정을 사용자별로 저장합니다.

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  default_platform_id uuid references public.platforms (id) on delete set null,
  default_payment_method_id uuid references public.payment_methods (id) on delete set null,
  default_buyer_account_id uuid references public.buyer_accounts (id) on delete set null,
  default_purchase_info_template_id uuid references public.purchase_info_templates (id) on delete set null,
  recent_platform_id uuid references public.platforms (id) on delete set null,
  recent_payment_method_id uuid references public.payment_methods (id) on delete set null,
  recent_buyer_account_id uuid references public.buyer_accounts (id) on delete set null,
  recent_purchase_info_template_id uuid references public.purchase_info_templates (id) on delete set null,
  order_save_action text not null default 'ledger'
    check (order_save_action in ('ledger', 'same', 'blank')),
  auto_advance_recommendations boolean not null default true,
  ledger_density text not null default 'compact'
    check (ledger_density in ('compact', 'comfortable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_order_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_order_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index saved_order_views_user_id_idx on public.saved_order_views (user_id);

-- 세 테이블의 수정 시각을 같은 방식으로 관리합니다.
create or replace function public.set_user_workflow_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row
  execute procedure public.set_user_workflow_updated_at();

create trigger user_order_drafts_set_updated_at
  before update on public.user_order_drafts
  for each row
  execute procedure public.set_user_workflow_updated_at();

create trigger saved_order_views_set_updated_at
  before update on public.saved_order_views
  for each row
  execute procedure public.set_user_workflow_updated_at();

alter table public.user_preferences enable row level security;
alter table public.user_order_drafts enable row level security;
alter table public.saved_order_views enable row level security;

create policy "user_preferences_select_own"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_preferences_insert_own"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_preferences_update_own"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_preferences_delete_own"
  on public.user_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_order_drafts_select_own"
  on public.user_order_drafts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "user_order_drafts_insert_own"
  on public.user_order_drafts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_order_drafts_update_own"
  on public.user_order_drafts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_order_drafts_delete_own"
  on public.user_order_drafts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_order_views_select_own"
  on public.saved_order_views for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "saved_order_views_insert_own"
  on public.saved_order_views for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "saved_order_views_update_own"
  on public.saved_order_views for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "saved_order_views_delete_own"
  on public.saved_order_views for delete to authenticated
  using ((select auth.uid()) = user_id);
