-- 주문완료와 입금완료를 구분하고, 입금완료가 주문완료를 포함하도록 저장합니다.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_order_completed boolean NOT NULL DEFAULT false;

UPDATE public.orders
SET is_order_completed = true
WHERE is_processed = true
  AND is_order_completed = false;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_is_processed_requires_order_completed_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_is_processed_requires_order_completed_check
  CHECK (is_processed = false OR is_order_completed = true);

CREATE INDEX IF NOT EXISTS orders_user_active_order_completed_purchase_date_idx
  ON public.orders (user_id, is_order_completed, purchase_date DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- 자동 입금 매핑을 완료하면 주문완료도 함께 확정합니다.
CREATE OR REPLACE FUNCTION public.complete_deposit_recommendation(
  p_deposit_id bigint,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  deposit_date_value date;
  deposit_amount_value numeric;
  deposit_counterparty_value text;
  purchase_price_value numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '28000';
  END IF;

  SELECT d.date, d.amount, d.counterparty
    INTO deposit_date_value, deposit_amount_value, deposit_counterparty_value
  FROM public.bank_account_deposit AS d
  JOIN public.bank_account AS account ON account.id = d.bank_account_id
  WHERE d.id = p_deposit_id
    AND d.bank_account_deposit_status = 0
    AND account.user_id = auth.uid()
  FOR UPDATE OF d;

  IF NOT FOUND THEN
    RAISE EXCEPTION '입금 내역이 없거나 이미 처리됐습니다.' USING ERRCODE = 'P0001';
  END IF;

  SELECT o.purchase_price_krw
    INTO purchase_price_value
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.user_id = auth.uid()
    AND o.deleted_at IS NULL
    AND o.is_processed = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '주문이 없거나 이미 완료 처리됐습니다.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET
    is_order_completed = true,
    is_processed = true,
    deposit_date = deposit_date_value,
    deposit_amount_krw = deposit_amount_value,
    deposit_memo = NULLIF(btrim(deposit_counterparty_value), ''),
    profit_krw = deposit_amount_value - purchase_price_value
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
    AND is_processed = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION '주문 상태가 바뀌어 처리할 수 없습니다.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bank_account_deposit
  SET bank_account_deposit_status = 1
  WHERE id = p_deposit_id
    AND bank_account_deposit_status = 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION '입금 내역 상태가 바뀌어 처리할 수 없습니다.' USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$$;

-- 크롤링 등록 주문은 실제 주문이 확인된 상태이므로 주문완료로 시작합니다.
CREATE OR REPLACE FUNCTION public.import_crawl_order(
  p_crawl_order_id text,
  p_order_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inserted_order_id uuid;
  crawl_order_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE = '28000';
  END IF;

  BEGIN
    crawl_order_id := p_crawl_order_id::bigint;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION '크롤링 주문 번호가 올바르지 않습니다.' USING ERRCODE = '22P02';
  END;

  PERFORM 1
  FROM public.crawl_orders
  WHERE id = crawl_order_id
    AND user_id = auth.uid()
    AND crawl_order_status = 0
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '처리 대기 중인 크롤링 주문이 없거나 이미 처리됐습니다.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.orders (
    user_id,
    title,
    order_number,
    product_name,
    platform_id,
    payment_method_id,
    buyer_account_id,
    purchase_info_template_id,
    purchase_date,
    deposit_date,
    purchase_price_krw,
    review_photo_count,
    review_char_count,
    deposit_amount_krw,
    is_item_delivered,
    is_order_completed,
    is_processed,
    deposit_memo,
    notes,
    product_url,
    scheduled_purchase_at,
    order_status,
    screenshot_storage_path,
    ai_review_user_prompt
  )
  SELECT
    auth.uid(),
    payload.title,
    payload.order_number,
    payload.product_name,
    payload.platform_id,
    payload.payment_method_id,
    payload.buyer_account_id,
    payload.purchase_info_template_id,
    payload.purchase_date,
    payload.deposit_date,
    payload.purchase_price_krw,
    payload.review_photo_count,
    payload.review_char_count,
    payload.deposit_amount_krw,
    COALESCE(payload.is_item_delivered, false),
    true,
    COALESCE(payload.is_processed, false),
    payload.deposit_memo,
    payload.notes,
    payload.product_url,
    payload.scheduled_purchase_at,
    payload.order_status,
    payload.screenshot_storage_path,
    payload.ai_review_user_prompt
  FROM jsonb_to_record(COALESCE(p_order_payload, '{}'::jsonb)) AS payload(
    title text,
    order_number text,
    product_name text,
    platform_id uuid,
    payment_method_id uuid,
    buyer_account_id uuid,
    purchase_info_template_id uuid,
    purchase_date date,
    deposit_date date,
    purchase_price_krw numeric,
    review_photo_count integer,
    review_char_count integer,
    deposit_amount_krw numeric,
    is_item_delivered boolean,
    is_processed boolean,
    deposit_memo text,
    notes text,
    product_url text,
    scheduled_purchase_at timestamptz,
    order_status text,
    screenshot_storage_path text,
    ai_review_user_prompt text
  )
  RETURNING id INTO inserted_order_id;

  UPDATE public.crawl_orders
  SET crawl_order_status = 1
  WHERE id = crawl_order_id
    AND user_id = auth.uid()
    AND crawl_order_status = 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION '크롤링 주문 상태가 바뀌어 처리할 수 없습니다.' USING ERRCODE = 'P0001';
  END IF;

  RETURN inserted_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_deposit_recommendation(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_deposit_recommendation(bigint, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.import_crawl_order(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_crawl_order(text, jsonb) TO authenticated;
