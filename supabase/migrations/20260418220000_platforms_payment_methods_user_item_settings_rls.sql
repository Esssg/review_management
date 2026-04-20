-- Security advisor: PostgREST-exposed public tables need RLS.
-- platforms / payment_methods: 시스템 행(user_id IS NULL)은 전원 조회, 쓰기는 본인 소유 행만.

alter table public.platforms enable row level security;

create policy "platforms_select_visible"
  on public.platforms
  for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "platforms_insert_own"
  on public.platforms
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "platforms_delete_own"
  on public.platforms
  for delete
  to authenticated
  using (user_id = auth.uid());

alter table public.payment_methods enable row level security;

create policy "payment_methods_select_visible"
  on public.payment_methods
  for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "payment_methods_insert_own"
  on public.payment_methods
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "payment_methods_delete_own"
  on public.payment_methods
  for delete
  to authenticated
  using (user_id = auth.uid());

alter table public.user_item_settings enable row level security;

create policy "user_item_settings_select_own"
  on public.user_item_settings
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_item_settings_insert_own"
  on public.user_item_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_item_settings_update_own"
  on public.user_item_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_item_settings_delete_own"
  on public.user_item_settings
  for delete
  to authenticated
  using (user_id = auth.uid());
