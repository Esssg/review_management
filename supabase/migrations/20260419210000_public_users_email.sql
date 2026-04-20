-- public.users 에 auth 이메일 캐시 컬럼 추가 + 기존 행 백필 + 신규 가입 시 동기화

alter table public.users add column if not exists email text;

comment on column public.users.email is 'auth.users.email 복제. 변경은 Supabase Auth에서 하며, 클라이언트는 name 만 수정 가능.';

update public.users as u
set email = a.email
from auth.users as a
where a.id = u.user_id;

create or replace function public.handle_auth_user_sync_public_users ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (user_id, name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      ''
    ),
    new.email
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 이메일은 Auth 기준으로만 두고, 앱에서는 표시 이름만 수정
revoke update on public.users from authenticated;
grant update (name) on public.users to authenticated;
