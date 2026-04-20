-- 앱용 사용자 프로필: auth.users와 1:1. 가입 시 자동 생성 + 기존 auth 계정 백필.

create table public.users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default ''
);

comment on table public.users is 'Supabase Auth 사용자와 1:1. 표시 이름 등 앱 프로필.';
comment on column public.users.user_id is 'auth.users.id';
comment on column public.users.name is '표시 이름(가입 시 메타데이터·이메일에서 채움, 이후 수정 가능)';

alter table public.users enable row level security;

create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, update on public.users to authenticated;

create or replace function public.handle_auth_user_sync_public_users ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (user_id, name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      ''
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_auth_user_sync_public_users () is
  'auth.users INSERT 시 public.users에 대응 행 추가. security definer.';

drop trigger if exists on_auth_user_created_sync_public_users on auth.users;

create trigger on_auth_user_created_sync_public_users
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_sync_public_users ();

-- 기존 Auth 계정 백필
insert into public.users (user_id, name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(coalesce(u.email, ''), '@', 1)), ''),
    ''
  )
from auth.users as u
on conflict (user_id) do nothing;
