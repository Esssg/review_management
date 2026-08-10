import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMasterData, type MasterData } from "@/lib/master-data";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { getOrCreateUserPreferences, type UserPreferences } from "@/lib/user-preferences";
import type { Database } from "@/types/database";
import { ORDER_LIST_SELECT, type OrderWithRelations } from "@/types/orders";

export type NewOrderInitialData = {
  userId: string;
  email: string;
  copyId: string;
  master: MasterData;
  copyOrder: OrderWithRelations | null;
  purchaseTemplates: PurchaseTemplateRow[];
  preferences: UserPreferences;
  draftData: Database["public"]["Tables"]["user_order_drafts"]["Row"]["draft_data"] | null;
};

const PURCHASE_TEMPLATE_PAGE_SIZE = 1000;

async function fetchAllPurchaseTemplates(
  supabase: SupabaseClient<Database>,
): Promise<PurchaseTemplateRow[]> {
  const rows: PurchaseTemplateRow[] = [];

  // Supabase 기본 반환 제한을 넘는 템플릿도 새 주문 입력란에서 빠지지 않게 페이지별로 읽습니다.
  for (let from = 0; ; from += PURCHASE_TEMPLATE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("purchase_info_templates")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PURCHASE_TEMPLATE_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PURCHASE_TEMPLATE_PAGE_SIZE) return rows;
  }
}

/** 신규 주문 첫 화면에 필요한 데이터를 서버에서 병렬로 준비합니다. */
export async function fetchNewOrderData(
  supabase: SupabaseClient<Database>,
  userId: string,
  copyId: string,
) {
  const copyOrderPromise = copyId
    ? supabase
        .from("orders")
        .select(ORDER_LIST_SELECT)
        .eq("id", copyId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [master, copyOrderResult, purchaseTemplates, preferences, draftResult] = await Promise.all([
    fetchMasterData(supabase, userId),
    copyOrderPromise,
    fetchAllPurchaseTemplates(supabase),
    getOrCreateUserPreferences(supabase, userId),
    supabase.from("user_order_drafts").select("draft_data").eq("user_id", userId).maybeSingle(),
  ]);

  if (copyOrderResult.error) throw new Error(copyOrderResult.error.message);
  if (draftResult.error) throw new Error(draftResult.error.message);

  return {
    master,
    copyOrder: (copyOrderResult.data as OrderWithRelations | null) ?? null,
    purchaseTemplates,
    preferences,
    draftData: draftResult.data?.draft_data ?? null,
  };
}
