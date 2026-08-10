-- 첫 로그인 온보딩 튜토리얼을 계정별로 한 번만 표시하기 위한 완료 시각입니다.

alter table public.users
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.users.onboarding_completed_at is
  '첫 로그인 온보딩 튜토리얼을 완료하거나 건너뛴 시각.';
