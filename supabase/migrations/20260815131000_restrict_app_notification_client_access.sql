-- 앱 알림은 서버 발송 함수가 생성하고, 브라우저는 조회와 읽음 처리만 합니다.

revoke all on public.app_notifications from authenticated;
grant select on public.app_notifications to authenticated;
grant update (read_at) on public.app_notifications to authenticated;
