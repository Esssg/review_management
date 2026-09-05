-- 자동추천 RPC는 로그인한 사용자만 호출할 수 있게 권한을 제한합니다.
REVOKE EXECUTE ON FUNCTION public.complete_deposit_recommendation(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_deposit_recommendation(bigint, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.import_crawl_order(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_crawl_order(text, jsonb) TO authenticated;
