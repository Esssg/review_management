-- 기존 users 테이블의 이름 수정 권한에 온보딩 완료 시각 수정 권한을 추가합니다.

grant update (name, onboarding_completed_at) on public.users to authenticated;
