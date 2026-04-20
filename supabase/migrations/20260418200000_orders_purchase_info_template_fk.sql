-- 주문에 연결된 구매 정보 템플릿 (선택)

alter table public.orders
  add column if not exists purchase_info_template_id uuid references public.purchase_info_templates (id) on delete set null;

create index if not exists orders_purchase_info_template_id_idx on public.orders (purchase_info_template_id)
  where purchase_info_template_id is not null;
