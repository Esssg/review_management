import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMasterData, type MasterData } from "@/lib/master-data";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import type { Database } from "@/types/database";
import { ORDER_LIST_SELECT, type OrderWithRelations } from "@/types/orders";

export type OrderDetailInitialData = {
  userId: string;
  orderId: string;
  order: OrderWithRelations | null;
  master: MasterData;
  purchaseTemplates: PurchaseTemplateRow[];
};

/** 주문 상세 첫 화면에 필요한 조회를 서버에서 병렬로 준비합니다. */
export async function fetchOrderDetailData(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
) {
  const [orderResult, master, templatesResult] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_LIST_SELECT)
      .eq("id", orderId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle(),
    fetchMasterData(supabase, userId),
    supabase
      .from("purchase_info_templates")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (orderResult.error) throw new Error(orderResult.error.message);
  if (templatesResult.error) throw new Error(templatesResult.error.message);

  return {
    order: (orderResult.data as OrderWithRelations | null) ?? null,
    master,
    purchaseTemplates: templatesResult.data ?? [],
  };
}
