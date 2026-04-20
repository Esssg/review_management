-- AI 리뷰 생성 시 화면의「AI에게 전달할 추가 정보」를 주문 단위로 보관합니다.
-- (앱에서 저장하기 / AI리뷰 생성하기 시 함께 갱신하도록 연결 예정)

alter table public.orders
  add column if not exists ai_review_user_prompt text;

comment on column public.orders.ai_review_user_prompt is
  'AI 리뷰 생성에 Gemini 등에 추가로 전달하는 사용자 입력(주문별, nullable)';
