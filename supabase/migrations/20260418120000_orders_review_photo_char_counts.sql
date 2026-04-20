-- Optional review metadata: photo count and written review character count
alter table public.orders
  add column if not exists review_photo_count integer,
  add column if not exists review_char_count integer;

comment on column public.orders.review_photo_count is '리뷰에 첨부한 사진 개수(선택)';
comment on column public.orders.review_char_count is '리뷰 본문 글자 수(선택)';
