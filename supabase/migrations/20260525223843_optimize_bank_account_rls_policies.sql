-- 새 계좌 테이블 RLS 정책에서 auth.uid()를 initPlan으로 평가하게 조정합니다.
drop policy if exists "bank_account_select_own" on public.bank_account;
drop policy if exists "bank_account_insert_own" on public.bank_account;
drop policy if exists "bank_account_update_own" on public.bank_account;
drop policy if exists "bank_account_delete_own" on public.bank_account;

create policy "bank_account_select_own"
  on public.bank_account
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "bank_account_insert_own"
  on public.bank_account
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "bank_account_update_own"
  on public.bank_account
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "bank_account_delete_own"
  on public.bank_account
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 복합 인덱스가 bank_account_id FK 조회까지 커버하므로 중복 단일 인덱스는 제거합니다.
drop index if exists public.bank_account_deposit_bank_account_id_idx;

drop policy if exists "bank_account_deposit_select_own" on public.bank_account_deposit;
drop policy if exists "bank_account_deposit_insert_own" on public.bank_account_deposit;
drop policy if exists "bank_account_deposit_update_own" on public.bank_account_deposit;
drop policy if exists "bank_account_deposit_delete_own" on public.bank_account_deposit;

create policy "bank_account_deposit_select_own"
  on public.bank_account_deposit
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bank_account as ba
      where ba.id = bank_account_id
        and ba.user_id = (select auth.uid())
    )
  );

create policy "bank_account_deposit_insert_own"
  on public.bank_account_deposit
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.bank_account as ba
      where ba.id = bank_account_id
        and ba.user_id = (select auth.uid())
    )
  );

create policy "bank_account_deposit_update_own"
  on public.bank_account_deposit
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.bank_account as ba
      where ba.id = bank_account_id
        and ba.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.bank_account as ba
      where ba.id = bank_account_id
        and ba.user_id = (select auth.uid())
    )
  );

create policy "bank_account_deposit_delete_own"
  on public.bank_account_deposit
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.bank_account as ba
      where ba.id = bank_account_id
        and ba.user_id = (select auth.uid())
    )
  );
