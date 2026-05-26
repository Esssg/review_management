-- 입금 내역에 입금 시각을 저장합니다. 기존 행 보존을 위해 nullable로 추가합니다.
alter table public.bank_account_deposit
  add column "time" time without time zone;

comment on column public.bank_account_deposit."time" is '입금 시각';
