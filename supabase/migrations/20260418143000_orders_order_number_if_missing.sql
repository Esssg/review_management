-- 일부 환경에서 누락됐을 수 있는 선택 컬럼 보강
alter table public.orders add column if not exists order_number text;

comment on column public.orders.order_number is '외부(쇼핑몰 등) 주문번호. 비워도 저장 가능';
