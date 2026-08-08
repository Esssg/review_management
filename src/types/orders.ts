import type { Database } from "@/types/database";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

/** 화면마다 같은 주문 조인 구조를 사용하도록 UI 컴포넌트 밖에서 관리합니다. */
export type OrderWithRelations = OrderRow & {
  platforms: { id: string; name: string; color: string } | null;
  payment_methods: { id: string; name: string; color: string } | null;
  buyer_accounts: { id: string; label: string; color: string } | null;
  purchase_info_templates?: Database["public"]["Tables"]["purchase_info_templates"]["Row"] | null;
};

/** 원장·상세·대시보드가 공유하는 주문 조회 컬럼입니다. */
export const ORDER_LIST_SELECT = `
  id,
  user_id,
  product_name,
  is_processed,
  purchase_date,
  deposit_date,
  purchase_price_krw,
  deposit_amount_krw,
  profit_krw,
  is_item_delivered,
  deposit_memo,
  notes,
  product_url,
  scheduled_purchase_at,
  order_number,
  screenshot_storage_path,
  order_status,
  created_at,
  updated_at,
  title,
  platform_id,
  payment_method_id,
  buyer_account_id,
  review_photo_count,
  review_char_count,
  purchase_info_template_id,
  ai_review,
  ai_review_user_prompt,
  deleted_at,
  platforms(id, name, color),
  payment_methods(id, name, color),
  buyer_accounts(id, label, color),
  purchase_info_templates(
    id,
    user_id,
    title,
    buyer_name,
    recipient_name,
    login_id,
    phone,
    address,
    bank_account_number,
    account_holder,
    created_at,
    updated_at
  )
` as const;
