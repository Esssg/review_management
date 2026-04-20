-- Add color configuration to master entities.
-- Values are stored as #RRGGBB and used by UI badges/icons.

alter table public.platforms
  add column if not exists color text;

alter table public.payment_methods
  add column if not exists color text;

alter table public.buyer_accounts
  add column if not exists color text;

update public.platforms
set color = case
  when lower(name) like '%쿠팡%' or lower(name) like '%coupang%' then '#f97316'
  when lower(name) like '%네이버%' or lower(name) like '%naver%' then '#16a34a'
  when lower(name) like '%카카오%' then '#ca8a04'
  when lower(name) like '%11번가%' then '#dc2626'
  when lower(name) like '%지마켓%' then '#2563eb'
  else '#64748b'
end
where color is null;

update public.payment_methods
set color = case
  when lower(name) like '%현금%' or lower(name) like '%cash%' then '#16a34a'
  when lower(name) like '%카드%' or lower(name) like '%card%' then '#2563eb'
  when lower(name) like '%페이%' or lower(name) like '%pay%' then '#0ea5e9'
  else '#7c3aed'
end
where color is null;

with palette as (
  select
    idx,
    color
  from (
    values
      (0, '#e11d48'),
      (1, '#ea580c'),
      (2, '#d97706'),
      (3, '#65a30d'),
      (4, '#059669'),
      (5, '#0d9488'),
      (6, '#0891b2'),
      (7, '#0284c7'),
      (8, '#2563eb'),
      (9, '#4f46e5'),
      (10, '#7c3aed'),
      (11, '#c026d3'),
      (12, '#db2777')
  ) as p(idx, color)
)
update public.buyer_accounts b
set color = p.color
from palette p
where b.color is null
  and p.idx = (get_byte(decode(md5(b.id::text), 'hex'), 0) % 13);

update public.platforms set color = '#64748b' where color is null;
update public.payment_methods set color = '#7c3aed' where color is null;
update public.buyer_accounts set color = '#64748b' where color is null;

alter table public.platforms
  alter column color set not null,
  alter column color set default '#64748b';

alter table public.payment_methods
  alter column color set not null,
  alter column color set default '#7c3aed';

alter table public.buyer_accounts
  alter column color set not null,
  alter column color set default '#64748b';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platforms_color_hex_check'
      and conrelid = 'public.platforms'::regclass
  ) then
    alter table public.platforms
      add constraint platforms_color_hex_check
      check (color ~* '^#[0-9a-f]{6}$');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_color_hex_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_color_hex_check
      check (color ~* '^#[0-9a-f]{6}$');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'buyer_accounts_color_hex_check'
      and conrelid = 'public.buyer_accounts'::regclass
  ) then
    alter table public.buyer_accounts
      add constraint buyer_accounts_color_hex_check
      check (color ~* '^#[0-9a-f]{6}$');
  end if;
end
$$;

drop policy if exists "platforms_update_own" on public.platforms;
create policy "platforms_update_visible"
  on public.platforms
  for update
  to authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "payment_methods_update_own" on public.payment_methods;
create policy "payment_methods_update_visible"
  on public.payment_methods
  for update
  to authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());
