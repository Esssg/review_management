-- 시드 시 payment_method_id 가 NULL 로 남은 경우 보정 (장부「현금결제」≠ DB「현금」 등)
-- 대상: user_id = 91ab7127-69f3-4da3-b670-ae08343f756f
--
-- 주의: payment_method_id IS NULL 인 행을 시스템「현금」에 연결합니다.
--       장부의「코드받기(카카오)」건(예: 종합비타민 0원)은 제외합니다. 그 외 NULL이 카드 등이면 수동으로 나눠 실행하세요.
--
-- 시드에만 쓰인 결제 이름: 현금결제, 석진카드, 혜미카드, 코드받기(카카오)
-- DB 마스터와 안 맞으면 NULL — 현금만 이 스크립트로 보정. 카드/코드는 payment_methods.name 을 맞추거나 시드 서브쿼리 확장.

-- 확인
-- select count(*) from public.orders
-- where user_id = '91ab7127-69f3-4da3-b670-ae08343f756f'::uuid and payment_method_id is null;

update public.orders o
set
  payment_method_id = pm.id,
  updated_at = now()
from public.payment_methods pm
where o.user_id = '91ab7127-69f3-4da3-b670-ae08343f756f'::uuid
  and o.payment_method_id is null
  and not (o.product_name = '종합비타민' and coalesce(o.purchase_price_krw, 0) = 0)
  and pm.user_id is null
  and pm.name = '현금'
  and pm.is_active is distinct from false;

-- 아래는 DB에 실제로 있는 name 으로 바꾼 뒤 필요 시만 주석 해제.
-- 「코드받기(카카오)」가 NULL 이면 마스터에 동일 이름이 있는지 먼저 확인:
--   select id, name from public.payment_methods where user_id is null and is_active is distinct from false;

-- update public.orders o
-- set payment_method_id = pm.id, updated_at = now()
-- from public.payment_methods pm
-- where o.user_id = '91ab7127-69f3-4da3-b670-ae08343f756f'::uuid
--   and o.payment_method_id is null
--   and pm.user_id is null
--   and pm.name = '코드받기(카카오)';
