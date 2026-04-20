-- Ledger → public.orders 일괄 삽입 (143건: 석진,혜미카드·구매자 석진혜미 행은 석진/혜미 각 절반으로 2행 분리)
-- 대상 user_id: 91ab7127-69f3-4da3-b670-ae08343f756f
--
-- 실행: Supabase SQL Editor (postgres) 또는 로컬에서 service_role로 실행.
-- RLS: 대시보드 postgres는 RLS 우회. anon/authenticated JWT로는 orders_insert_own 불가.
--
-- 선행 조건:
--   1) 해당 UUID가 auth.users 에 존재 (user_id FK)
--   2) platforms / payment_methods 의 name 이 아래 값과 일치 (시스템 user_id IS NULL 행 우선 매칭).
--      결제수단: 장부의「현금결제」는 DB에「현금」만 있어도 매칭되도록 서브쿼리에서 별칭 처리함.
--   3) buyer_accounts 에 같은 user_id 로 label 이 혜미 / 석진 인 행 존재 (없으면 buyer_account_id NULL). 분리 행은 석진·혜미만 사용.
--
-- title: deposit_memo(장부 끝 짧은 메모)가 있으면 동일 문자열, 없으면 '카톡방이름'.
--
-- 재실행 시 중복 방지: 필요하면 먼저 delete from public.orders where user_id = '91ab...';

do $imp$
declare uid uuid := '91ab7127-69f3-4da3-b670-ae08343f756f'::uuid;
begin
  insert into public.orders (
    user_id,
    product_name,
    title,
    is_processed,
    platform_id,
    payment_method_id,
    buyer_account_id,
    purchase_date,
    deposit_date,
    purchase_price_krw,
    deposit_amount_krw,
    profit_krw,
    is_item_delivered,
    deposit_memo,
    notes
  )
  select
    uid,
    v.product_name,
    coalesce(v.deposit_memo, '카톡방이름'),
    v.is_processed,
    (select p.id from public.platforms p
       where p.name = v.platform_name
         and (p.user_id is null or p.user_id = uid)
       order by case when p.user_id is null then 0 else 1 end
       limit 1),
    (select m.id from public.payment_methods m
       where (m.user_id is null or m.user_id = uid)
         and (
           m.name = v.payment_name
           or (v.payment_name = '현금결제' and m.name = '현금')
         )
       order by
         case when m.user_id is null then 0 else 1 end,
         case when m.name = v.payment_name then 0 else 1 end
       limit 1),
    (select b.id from public.buyer_accounts b
       where b.user_id = uid and b.label = v.buyer_label
       limit 1),
    v.purchase_date,
    v.deposit_date,
    v.purchase_price_krw,
    v.deposit_amount_krw,
    v.profit_krw,
    v.is_item_delivered,
    v.deposit_memo,
    v.notes
  from (values
  ('한가득두릅', false, '네이버', '현금결제', '혜미', '2026-04-01'::date, NULL, 28900.00, NULL, 0.00, false, NULL, NULL::text),
  ('락티브커큐민', false, '네이버', '현금결제', '혜미', '2026-04-01'::date, NULL, 19000.00, NULL, 0.00, false, NULL, NULL::text),
  ('제이제이두피에센스', false, '쿠팡', '현금결제', '석진', '2026-04-02'::date, NULL, 19900.00, NULL, 0.00, true, NULL, NULL::text),
  ('JBK발마사지기1', false, '카카오', '현금결제', '혜미', '2026-04-02'::date, NULL, 39900.00, NULL, 0.00, false, NULL, NULL::text),
  ('올네스트세제', false, '쿠팡', '현금결제', '석진', '2026-04-02'::date, NULL, 8900.00, NULL, 0.00, false, NULL, NULL::text),
  ('데비아트무타공욕실걸이', false, '쿠팡', '현금결제', '석진', '2026-04-03'::date, NULL, 8500.00, NULL, 0.00, true, NULL, NULL::text),
  ('부이손풍기1', false, '카카오', '현금결제', '혜미', '2026-04-03'::date, NULL, 26900.00, NULL, 0.00, false, NULL, NULL::text),
  ('영글어버섯쌀1', false, '네이버', '현금결제', '혜미', '2026-04-03'::date, NULL, 13200.00, NULL, 0.00, true, NULL, NULL::text),
  ('JBK발마사지기2', false, '카카오', '현금결제', '혜미', '2026-04-04'::date, NULL, 39900.00, NULL, 0.00, false, NULL, NULL::text),
  ('봉이순대.돼지국밥', false, '카카오', '현금결제', '혜미', '2026-04-05'::date, NULL, 45800.00, NULL, 0.00, false, NULL, NULL::text),
  ('봉이LA갈비', false, '카카오', '현금결제', '혜미', '2026-04-05'::date, NULL, 41700.00, NULL, 0.00, false, NULL, NULL::text),
  ('오히어크림', false, '네이버', '현금결제', '혜미', '2026-04-06'::date, NULL, 39900.00, NULL, 0.00, false, NULL, NULL::text),
  ('일편단심실리콘얼음틀', false, '쿠팡', '석진카드', '석진', '2026-04-06'::date, NULL, 18700.00, NULL, 0.00, true, NULL, NULL::text),
  ('트롤리', false, '쿠팡', '현금결제', '석진', '2026-04-06'::date, NULL, 9700.00, NULL, 0.00, true, NULL, NULL::text),
  ('마켓몽아치깔창', false, '쿠팡', '석진카드', '석진', '2026-04-06'::date, NULL, 9900.00, NULL, 0.00, true, NULL, NULL::text),
  ('마켓몽아치깔창', false, '쿠팡', '혜미카드', '혜미', '2026-04-06'::date, NULL, 9900.00, NULL, 0.00, true, NULL, NULL::text),
  ('영글어버섯쌀2', false, '쿠팡', '현금결제', '혜미', '2026-04-06'::date, NULL, 12000.00, NULL, 0.00, true, NULL, NULL::text),
  ('gbh핸드워시', false, '카카오', '현금결제', '혜미', '2026-04-06'::date, NULL, 21000.00, NULL, 0.00, true, NULL, NULL::text),
  ('폼클렌징', false, '올리브영', '현금결제', '혜미', '2026-04-06'::date, NULL, 21400.00, NULL, 0.00, true, NULL, NULL::text),
  ('세탁조 클리너', false, '쿠팡', '현금결제', '혜미', '2026-04-06'::date, NULL, 8900.00, NULL, 0.00, true, NULL, NULL::text),
  ('삼백초추출물', false, '쿠팡', '현금결제', '석진', '2026-04-06'::date, NULL, 14900.00, NULL, 0.00, false, NULL, NULL::text),
  ('삼백초추출물', false, '쿠팡', '현금결제', '혜미', '2026-04-06'::date, NULL, 14900.00, NULL, 0.00, false, NULL, NULL::text),
  ('일원케어사과', false, '쿠팡', '현금결제', '석진', '2026-04-07'::date, NULL, 24900.00, NULL, 0.00, false, NULL, NULL::text),
  ('올바른곡물효소', false, '네이버', '현금결제', '혜미', '2026-04-07'::date, NULL, 27400.00, NULL, 0.00, false, NULL, NULL::text),
  ('무좀앰플', false, '네이버', '현금결제', '혜미', '2026-04-07'::date, NULL, 33000.00, NULL, 0.00, false, NULL, NULL::text),
  ('오아드틴트', false, '카카오', '현금결제', '혜미', '2026-04-07'::date, NULL, 26000.00, NULL, 0.00, false, NULL, NULL::text),
  ('JBK발마사지기3', false, '카카오', '현금결제', '혜미', '2026-04-07'::date, NULL, 39900.00, NULL, 0.00, false, NULL, NULL::text),
  ('무풍선풍기', false, '쿠팡', '석진카드', '석진', '2026-04-07'::date, NULL, 99000.00, NULL, 0.00, false, NULL, NULL::text),
  ('부이손풍기2', false, '카카오', '현금결제', '혜미', '2026-04-07'::date, NULL, 30900.00, NULL, 0.00, false, NULL, NULL::text),
  ('모달이불', false, '네이버', '현금결제', '혜미', '2026-04-08'::date, NULL, 79800.00, NULL, 0.00, false, NULL, NULL::text),
  ('하우스오브비페이스필름4입', false, '무신사', '현금결제', '혜미', '2026-04-08'::date, NULL, 27500.00, NULL, 0.00, false, NULL, NULL::text),
  ('케이엠크로스백', false, '쿠팡', '석진카드', '석진', '2026-04-09'::date, NULL, 25800.00, NULL, 0.00, false, NULL, NULL::text),
  ('하우스오브비PDRN마스크팩', false, '올리브영', '현금결제', '혜미', '2026-04-09'::date, NULL, 27500.00, NULL, 0.00, false, NULL, NULL::text),
  ('모란카노카메라보호필름', false, '쿠팡', '현금결제', '석진', '2026-04-09'::date, NULL, 6600.00, NULL, 0.00, false, NULL, NULL::text),
  ('트레블블리스참외', false, '쿠팡', '현금결제', '석진', '2026-04-10'::date, NULL, 12000.00, NULL, 0.00, false, NULL, NULL::text),
  ('트레블블리스참외', false, '쿠팡', '현금결제', '혜미', '2026-04-10'::date, NULL, 12000.00, NULL, 0.00, false, NULL, NULL::text),
  ('코코도르디퓨저', false, '카카오', '현금결제', '혜미', '2026-04-10'::date, NULL, 23900.00, NULL, 0.00, false, NULL, NULL::text),
  ('결하우스마스크팩3입', false, '무신사', '현금결제', '혜미', '2026-04-10'::date, NULL, 11940.00, NULL, 0.00, false, NULL, NULL::text),
  ('코드웨이카라비너', false, '쿠팡', '석진카드', '석진', '2026-04-10'::date, NULL, 6800.00, NULL, 0.00, false, NULL, NULL::text),
  ('코드웨이카라비너', false, '쿠팡', '혜미카드', '혜미', '2026-04-10'::date, NULL, 6800.00, NULL, 0.00, false, NULL, NULL::text),
  ('일자형팬티라이너', false, '쿠팡', '현금결제', '석진', '2026-04-10'::date, NULL, 7900.00, NULL, 0.00, true, NULL, NULL::text),
  ('소나엘임산부트리트먼트', false, '네이버', '현금결제', '혜미', '2026-04-10'::date, NULL, 33900.00, NULL, 0.00, false, NULL, NULL::text),
  ('영글어버섯쌀3', false, '쿠팡', '현금결제', '석진', '2026-04-11'::date, NULL, 12000.00, NULL, 0.00, false, NULL, NULL::text),
  ('엘로비아크랜베리영양제', false, '쿠팡', '현금결제', '석진', '2026-04-11'::date, NULL, 9900.00, NULL, 0.00, false, NULL, NULL::text),
  ('리브맘냉감패드', false, '카카오', '현금결제', '혜미', '2026-04-11'::date, NULL, 32900.00, NULL, 0.00, false, NULL, NULL::text),
  ('종합비타민', false, '카카오', '코드받기(카카오)', '혜미', '2026-04-11'::date, NULL, 0.00, NULL, 0.00, true, NULL, NULL::text),
  ('그레이블모자패드', false, '쿠팡', '현금결제', '석진', '2026-04-11'::date, NULL, 5700.00, NULL, 0.00, false, NULL, NULL::text),
  ('건조기시트2세트,2계', false, '쿠팡', '석진카드', '석진', '2026-04-11'::date, NULL, 17780.00, NULL, 0.00, false, NULL, NULL::text),
  ('건조기시트2세트,2계', false, '쿠팡', '혜미카드', '혜미', '2026-04-11'::date, NULL, 17780.00, NULL, 0.00, false, NULL, NULL::text),
  ('나드바디로션', false, '네이버', '현금결제', '혜미', '2026-04-14'::date, NULL, 19800.00, NULL, 0.00, false, NULL, NULL::text),
  ('영글어버섯쌀4', false, '쿠팡', '현금결제', '혜미', '2026-04-14'::date, NULL, 12000.00, NULL, 0.00, false, NULL, NULL::text),
  ('가쉬겔미스트', false, '올리브영', '현금결제', '혜미', '2026-04-14'::date, NULL, 26500.00, NULL, 0.00, true, NULL, NULL::text),
  ('마켓몽메이크업브러쉬세트', false, '쿠팡', '석진카드', '석진', '2026-04-14'::date, NULL, 12900.00, NULL, 0.00, true, NULL, NULL::text),
  ('화이테오라탄력크림', false, '네이버', '현금결제', '혜미', '2026-04-14'::date, NULL, 59500.00, NULL, 0.00, true, NULL, NULL::text),
  ('해가온고구마모종', false, '네이버', '현금결제', '혜미', '2026-04-14'::date, NULL, 7800.00, NULL, 0.00, false, NULL, NULL::text),
  ('볼륨워터트리트먼트', false, '카카오', '현금결제', '혜미', '2026-04-14'::date, NULL, 22900.00, NULL, 0.00, true, NULL, NULL::text),
  ('에버스하스카프베리', false, '쿠팡', '현금결제', '석진', '2026-04-14'::date, NULL, 19800.00, NULL, 0.00, false, NULL, NULL::text),
  ('아토워시캡슐세제', false, '쿠팡', '석진카드', '석진', '2026-04-14'::date, NULL, 10140.00, NULL, 0.00, false, NULL, NULL::text),
  ('아토워시캡슐세제', false, '쿠팡', '혜미카드', '혜미', '2026-04-14'::date, NULL, 10140.00, NULL, 0.00, false, NULL, NULL::text),
  ('베이킹소다', false, '쿠팡', '석진카드', '석진', '2026-04-14'::date, NULL, 7090.00, NULL, 0.00, false, NULL, NULL::text),
  ('베이킹소다', false, '쿠팡', '혜미카드', '혜미', '2026-04-14'::date, NULL, 7090.00, NULL, 0.00, false, NULL, NULL::text),
  ('와이디스탠드선풍기', false, '쿠팡', '혜미카드', '혜미', '2026-04-14'::date, NULL, 59900.00, NULL, 0.00, false, NULL, NULL::text),
  ('코드웨이CPU', false, '쿠팡', '석진카드', '석진', '2026-04-14'::date, NULL, 6000.00, NULL, 0.00, false, NULL, NULL::text),
  ('코드웨이CPU', false, '쿠팡', '혜미카드', '혜미', '2026-04-14'::date, NULL, 6000.00, NULL, 0.00, false, NULL, NULL::text),
  ('위글랜앰플', false, '네이버', '혜미카드', '혜미', '2026-04-14'::date, NULL, 29600.00, NULL, 0.00, false, NULL, NULL::text),
  ('캡슐세제맘스럽', false, '쿠팡', '석진카드', '석진', '2026-04-15'::date, NULL, 8630.00, NULL, 0.00, false, NULL, NULL::text),
  ('캡슐세제맘스럽', false, '쿠팡', '혜미카드', '혜미', '2026-04-15'::date, NULL, 8630.00, NULL, 0.00, false, NULL, NULL::text),
  ('푸룻타임망고', false, '네이버', '현금결제', '혜미', '2026-04-15'::date, NULL, 26500.00, NULL, 0.00, false, NULL, NULL::text),
  ('립밤오렌지오브제', false, '네이버', '현금결제', '혜미', '2026-04-15'::date, NULL, 12400.00, NULL, 0.00, false, NULL, NULL::text),
  ('본덱트리트먼트', false, '쿠팡', '현금결제', '석진', '2026-04-15'::date, NULL, 35100.00, NULL, 0.00, true, NULL, NULL::text),
  ('뷰티여성청결제폼', false, '쿠팡', '현금결제', '석진', '2026-04-15'::date, NULL, 8070.00, NULL, 0.00, true, NULL, NULL::text),
  ('뷰티여성청결제폼', false, '쿠팡', '현금결제', '혜미', '2026-04-15'::date, NULL, 8070.00, NULL, 0.00, true, NULL, NULL::text),
  ('뷰티여성청결제젤', false, '쿠팡', '현금결제', '석진', '2026-04-15'::date, NULL, 9400.00, NULL, 0.00, true, NULL, NULL::text),
  ('뷰티여성청결제젤', false, '쿠팡', '현금결제', '혜미', '2026-04-15'::date, NULL, 9400.00, NULL, 0.00, true, NULL, NULL::text),
  ('엔라이즈대마종자유', false, '쿠팡', '현금결제', '석진', '2026-04-15'::date, NULL, 10900.00, NULL, 0.00, true, NULL, NULL::text),
  ('차단안경체르니샵', false, '쿠팡', '현금결제', '석진', '2026-04-15'::date, NULL, 29900.00, NULL, 0.00, false, NULL, NULL::text),
  ('차단안경체르니샵', false, '쿠팡', '현금결제', '혜미', '2026-04-15'::date, NULL, 29900.00, NULL, 0.00, false, NULL, NULL::text),
  ('주방세제', true, '쿠팡', '석진카드', '석진', '2026-03-25'::date, '2026-03-27'::date, 7500.00, 8500.00, 1000.00, false, '0325주방세제', NULL::text),
  ('정제소금', true, '쿠팡', '석진카드', '석진', '2026-03-25'::date, '2026-03-28'::date, 6190.00, 7190.00, 1000.00, false, '0325정제소금', NULL::text),
  ('스컬프턴탈모앰플', true, '카카오', '현금결제', '혜미', '2026-03-25'::date, '2026-03-28'::date, 18360.00, 18360.00, 0.00, true, '0326스컬프턴', NULL::text),
  ('율무팩', true, '쿠팡', '석진카드', '석진', '2026-03-25'::date, NULL, 22630.00, 22630.00, 0.00, true, '0325율무팩', NULL::text),
  ('물병', true, '네이버', '현금결제', '혜미', '2026-03-26'::date, '2026-04-07'::date, 15800.00, 17800.00, 2000.00, false, '0326물병', NULL::text),
  ('틴트9개', true, '올리브영', '현금결제', '혜미', '2026-03-26'::date, '2026-04-03'::date, 121000.00, 121000.00, 0.00, true, '0326디어달리아', NULL::text),
  ('케이블', true, '쿠팡', '석진카드', '석진', '2026-03-26'::date, '2026-04-02'::date, 5010.00, 5510.00, 500.00, false, '0326코드웨이', NULL::text),
  ('팩트', true, '쿠팡', '석진카드', '석진', '2026-03-26'::date, '2026-04-01'::date, 15900.00, 15900.00, 0.00, true, '0326팩트', NULL::text),
  ('캡슐세제', true, '쿠팡', '석진카드', '석진', '2026-03-26'::date, '2026-03-30'::date, 11540.00, 11540.00, 0.00, true, '0326캡슐', NULL::text),
  ('주방세제', true, '쿠팡', '석진카드', '석진', '2026-03-26'::date, '2026-03-30'::date, 9400.00, 10400.00, 1000.00, false, '0327주방세제', NULL::text),
  ('다이어트보조제', true, '쿠팡', '현금결제', '석진', '2026-03-27'::date, '2026-04-02'::date, 33400.00, 33400.00, 0.00, true, '0327컷프로60', NULL::text),
  ('아르기닌 포', true, '카카오', '현금결제', '혜미', '2026-03-27'::date, '2026-03-30'::date, 45000.00, 45000.00, 0.00, true, '0327아르기닌', NULL::text),
  ('디톡스 주스', true, '마켓컬리', '현금결제', '혜미', '2026-03-27'::date, '2026-03-30'::date, 4500.00, 4500.00, 0.00, true, '0327미니주스', NULL::text),
  ('썬캡', true, '쿠팡', '석진카드', '석진', '2026-03-27'::date, '2026-03-30'::date, 14900.00, 14900.00, 0.00, true, '0327망고자판기', NULL::text),
  ('대저 토마토', true, '쿠팡', '석진카드', '석진', '2026-03-27'::date, '2026-04-01'::date, 14900.00, 15900.00, 1000.00, false, '대저토마토', NULL::text),
  ('런닝벨트', true, '쿠팡', '현금결제', '석진', '2026-03-27'::date, '2026-03-31'::date, 9800.00, 9800.00, 0.00, true, '러닝벨트', NULL::text),
  ('아르기닌 정', true, '카카오', '현금결제', '혜미', '2026-03-27'::date, '2026-03-31'::date, 29900.00, 29900.00, 0.00, true, '0329아르기닌정', NULL::text),
  ('헤어에센스', true, '카카오', '혜미카드', '혜미', '2026-03-29'::date, '2026-04-01'::date, 29800.00, 30300.00, 500.00, false, '0330이븐로엘', NULL::text),
  ('이지아이스메이커', true, '쿠팡', '석진카드', '석진', '2026-03-30'::date, '2026-04-04'::date, 21600.00, 22100.00, 500.00, false, '0330일편단심', NULL::text),
  ('선크림', true, '쿠팡', '현금결제', '석진', '2026-03-30'::date, '2026-04-02'::date, 17900.00, 17900.00, 0.00, true, '0331모이스처', NULL::text),
  ('라벨기', true, '쿠팡', '석진카드', '석진', '2026-03-31'::date, '2026-04-03'::date, 19900.00, 20400.00, 500.00, false, '0331더미라클', NULL::text),
  ('맘스럽캡슐세제', true, '쿠팡', '석진카드', '석진', '2026-03-31'::date, '2026-04-02'::date, 9900.00, 10900.00, 1000.00, false, '0331캡슐세제', NULL::text),
  ('다이어트유산균', true, '쿠팡', '현금결제', '석진', '2026-03-31'::date, '2026-04-02'::date, 27700.00, 27700.00, 0.00, true, '0331유산균', NULL::text),
  ('여성청결제', true, '쿠팡', '현금결제', '석진', '2026-03-31'::date, '2026-04-02'::date, 8450.00, 8950.00, 500.00, true, '0331뷰티', NULL::text),
  ('향수키트', true, '네이버', '혜미카드', '혜미', '2026-03-31'::date, '2026-04-02'::date, 15400.00, 15400.00, 0.00, true, '나나파인트', NULL::text),
  ('세탁조크리너', true, '쿠팡', '현금결제', '석진', '2026-03-31'::date, '2026-04-01'::date, 8900.00, 8900.00, 0.00, true, '0402이삼오구', NULL::text),
  ('버디즈고체레몬즙', true, '쿠팡', '현금결제', '석진', '2026-04-02'::date, '2026-04-15'::date, 9900.00, 9900.00, 0.00, true, '0402버디즈', NULL::text),
  ('정제소금', true, '쿠팡', '석진카드', '석진', '2026-04-02'::date, '2026-04-15'::date, 6190.00, 7190.00, 1000.00, false, '0402정제소금', NULL::text),
  ('액체세제', true, '쿠팡', '현금결제', '석진', '2026-04-02'::date, '2026-04-07'::date, 5960.00, 6960.00, 1000.00, false, '0402화이트젤', NULL::text),
  ('이너퍼퓸', true, '카카오', '현금결제', '혜미', '2026-04-02'::date, '2026-04-07'::date, 29800.00, 30800.00, 1000.00, false, '0402이너퍼퓸', NULL::text),
  ('다이어트보조제', true, '쿠팡', '현금결제', '석진', '2026-04-02'::date, '2026-04-08'::date, 54900.00, 55400.00, 500.00, true, '0402소우코우', NULL::text),
  ('사과', true, '쿠팡', '석진카드', '석진', '2026-04-02'::date, '2026-04-06'::date, 58500.00, 59500.00, 1000.00, false, '0403스위니', NULL::text),
  ('건조기시트', true, '쿠팡', '석진카드', '석진', '2026-04-03'::date, '2026-04-07'::date, 8890.00, 9890.00, 1000.00, false, '0403건조기시트', NULL::text),
  ('어려지다앰플', true, '네이버', '혜미카드', '혜미', '2026-04-03'::date, '2026-04-07'::date, 33000.00, 34000.00, 1000.00, false, '0404어려지다', NULL::text),
  ('맘스럽액체세제', true, '쿠팡', '석진카드', '석진', '2026-04-04'::date, '2026-04-10'::date, 7490.00, 8490.00, 1000.00, false, '0404액체세제', NULL::text),
  ('비오틴', true, '쿠팡', '현금결제', '석진', '2026-04-04'::date, '2026-04-09'::date, 9900.00, 9900.00, 0.00, true, '0406버디즈', NULL::text),
  ('클렌즈스틱포', true, '네이버', '현금결제', '혜미', '2026-04-06'::date, '2026-04-13'::date, 23800.00, 23800.00, 0.00, true, '0406네이버오일만', NULL::text),
  ('에어튠손풍기', true, '쿠팡', '현금결제', '석진', '2026-04-06'::date, '2026-04-09'::date, 22800.00, 24800.00, 2000.00, false, '0406에어튠', NULL::text),
  ('에어튠손풍기', true, '쿠팡', '현금결제', '혜미', '2026-04-06'::date, '2026-04-09'::date, 22800.00, 24800.00, 2000.00, false, '0406에어튠', NULL::text),
  ('루테인', true, '쿠팡', '현금결제', '석진', '2026-04-06'::date, '2026-04-10'::date, 26500.00, 28500.00, 2000.00, false, '0406프랑', NULL::text),
  ('루테인', true, '쿠팡', '현금결제', '혜미', '2026-04-06'::date, '2026-04-10'::date, 26500.00, 28500.00, 2000.00, false, '0406프랑', NULL::text),
  ('감사패', true, '네이버', '현금결제', '혜미', '2026-04-06'::date, '2026-04-10'::date, 62000.00, 64000.00, 2000.00, false, '0406월넛', NULL::text),
  ('베사메무초스티커', true, '네이버', '혜미카드', '혜미', '2026-04-06'::date, '2026-04-10'::date, 6400.00, 6900.00, 500.00, false, '0406베사메무쵸', NULL::text),
  ('써큘레이터', true, '네이버', '현금결제', '혜미', '2026-04-06'::date, '2026-04-09'::date, 108000.00, 109000.00, 1000.00, false, '0406yd컴퍼니', NULL::text),
  ('맘스럽블랙젤', true, '쿠팡', '석진카드', '석진', '2026-04-07'::date, '2026-04-10'::date, 6730.00, 7730.00, 1000.00, false, '0407블랙젤', NULL::text),
  ('맘스럽블랙젤', true, '쿠팡', '혜미카드', '혜미', '2026-04-07'::date, '2026-04-10'::date, 6730.00, 7730.00, 1000.00, false, '0407블랙젤', NULL::text),
  ('일편단심헤어밴드', true, '쿠팡', '석진카드', '석진', '2026-04-07'::date, '2026-04-10'::date, 12300.00, 12800.00, 500.00, false, '0407일편단심', NULL::text),
  ('일편단심헤어밴드', true, '쿠팡', '혜미카드', '혜미', '2026-04-07'::date, '2026-04-10'::date, 12300.00, 12800.00, 500.00, false, '0407일편단심', NULL::text),
  ('코드웨이워치커버', true, '쿠팡', '석진카드', '석진', '2026-04-07'::date, '2026-04-10'::date, 9100.00, 9600.00, 500.00, false, '0407코드웨이', NULL::text),
  ('코드웨이워치커버', true, '쿠팡', '혜미카드', '혜미', '2026-04-07'::date, '2026-04-10'::date, 9100.00, 9600.00, 500.00, false, '0407코드웨이', NULL::text),
  ('참외', true, '쿠팡', '석진카드', '석진', '2026-04-07'::date, '2026-04-09'::date, 44800.00, 45800.00, 1000.00, false, '0407과일팜', NULL::text),
  ('건조기시트', true, '쿠팡', '석진카드', '석진', '2026-04-08'::date, '2026-04-13'::date, 8890.00, 8890.00, 0.00, true, '0408맘스럽', NULL::text),
  ('건조기시트', true, '쿠팡', '혜미카드', '혜미', '2026-04-08'::date, '2026-04-13'::date, 8890.00, 8890.00, 0.00, true, '0408맘스럽', NULL::text),
  ('멜라토닌', true, '네이버', '현금결제', '혜미', '2026-04-09'::date, '2026-04-15'::date, 10900.00, 12900.00, 2000.00, false, '0409멜라토닌', NULL::text),
  ('에코센스밀폐용기', true, '네이버', '현금결제', '혜미', '2026-04-09'::date, '2026-04-14'::date, 87900.00, 88900.00, 1000.00, false, '0409에코센스', NULL::text),
  ('맘스럽주방세제', true, '쿠팡', '혜미카드', '혜미', '2026-04-09'::date, '2026-04-13'::date, 7820.00, 8820.00, 1000.00, false, '0409주방세제', NULL::text),
  ('코드웨이탁상용선풍기', true, '쿠팡', '석진카드', '석진', '2026-04-09'::date, '2026-04-13'::date, 32200.00, 32700.00, 500.00, false, '0409코드웨이', NULL::text),
  ('코드웨이탁상용선풍기', true, '쿠팡', '혜미카드', '혜미', '2026-04-09'::date, '2026-04-13'::date, 32200.00, 32700.00, 500.00, false, '0409코드웨이', NULL::text),
  ('현재파트너스손목보호대', true, '쿠팡', '석진카드', '석진', '2026-04-10'::date, '2026-04-15'::date, 7920.00, 7920.00, 0.00, true, '0410현재파트너스', NULL::text),
  ('현재파트너스요가매트', true, '쿠팡', '혜미카드', '혜미', '2026-04-10'::date, '2026-04-15'::date, 20470.00, 20470.00, 0.00, true, '0410현재파트너스', NULL::text),
  ('온해브샤워기헤드', true, '쿠팡', '석진카드', '석진', '2026-04-10'::date, '2026-04-13'::date, 9800.00, 9800.00, 0.00, true, '0410온해브', NULL::text),
  ('무신사에너지젤', true, '무신사', '현금결제', '혜미', '2026-04-11'::date, '2026-04-16'::date, 17770.00, 17770.00, 0.00, true, '0411에너지젤', NULL::text),
  ('와이디스탠드선풍기', true, '쿠팡', '석진카드', '석진', '2026-04-11'::date, '2026-04-13'::date, 59900.00, 61900.00, 2000.00, false, '0411와이디컴퍼니', NULL::text),
  ('소다워시액체세제', true, '쿠팡', '석진카드', '석진', '2026-04-13'::date, '2026-04-15'::date, 10230.00, 11230.00, 1000.00, false, '0413소다워시', NULL::text),
  ('소다워시액체세제', true, '쿠팡', '혜미카드', '혜미', '2026-04-13'::date, '2026-04-15'::date, 10230.00, 11230.00, 1000.00, false, '0413소다워시', NULL::text),
  ('감자튀김, 해쉬브라운', true, '쿠팡', '석진카드', '석진', '2026-04-13'::date, '2026-04-13'::date, 14780.00, 14780.00, 0.00, true, '권이연', NULL::text)
  ) as v (
    product_name,
    is_processed,
    platform_name,
    payment_name,
    buyer_label,
    purchase_date,
    deposit_date,
    purchase_price_krw,
    deposit_amount_krw,
    profit_krw,
    is_item_delivered,
    deposit_memo,
    notes
  );
end;
$imp$;
