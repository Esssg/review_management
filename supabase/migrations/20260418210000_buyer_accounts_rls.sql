-- Security advisor: expose via PostgREST requires RLS on public tables.

alter table public.buyer_accounts enable row level security;

create policy "buyer_accounts_select_own"
  on public.buyer_accounts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "buyer_accounts_insert_own"
  on public.buyer_accounts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "buyer_accounts_update_own"
  on public.buyer_accounts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "buyer_accounts_delete_own"
  on public.buyer_accounts
  for delete
  to authenticated
  using (auth.uid() = user_id);
