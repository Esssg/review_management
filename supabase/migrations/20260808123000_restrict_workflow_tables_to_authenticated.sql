-- 사용자 업무 설정과 초안은 로그인 전 GraphQL/REST 역할에서 조회할 필요가 없습니다.
revoke all privileges on table public.user_preferences from anon;
revoke all privileges on table public.user_order_drafts from anon;
revoke all privileges on table public.saved_order_views from anon;

grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.user_order_drafts to authenticated;
grant select, insert, update, delete on table public.saved_order_views to authenticated;
