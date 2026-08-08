-- 주문 삭제를 복구할 수 있도록 실제 삭제 전에 삭제 시각만 기록합니다.
alter table public.orders
  add column if not exists deleted_at timestamptz;

-- 일반 장부와 휴지통이 서로의 행을 훑지 않도록 사용 경로별 인덱스를 둡니다.
create index if not exists orders_user_active_processed_purchase_date_idx
  on public.orders (user_id, is_processed, purchase_date desc)
  where deleted_at is null;

create index if not exists orders_user_deleted_at_idx
  on public.orders (user_id, deleted_at desc)
  where deleted_at is not null;
