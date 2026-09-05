import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { ORDER_LIST_SELECT, type OrderWithRelations } from "@/types/orders";
import type { HomeOrderCounts } from "@/types/home";
import { fetchAllPages } from "@/lib/pagination";

export const HOME_ORDER_PAGE_SIZE = 1000;

/** 장부 목록은 1,000건 이후의 주문도 빠짐없이 읽습니다. */
export async function fetchAllHomeOrders(
  supabase: SupabaseClient<Database>,
  userId: string,
  isProcessed: boolean,
) {
  const result = await fetchAllPages<OrderWithRelations>(async (from, to) => {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_LIST_SELECT)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_processed", isProcessed)
      .order("purchase_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    return {
      data: (data ?? []) as OrderWithRelations[],
      error,
    };
  }, HOME_ORDER_PAGE_SIZE);

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

/**
 * 구매장부 첫 화면에 필요한 인증 사용자와 미완료 데이터를 서버에서 함께 준비합니다.
 */
export async function fetchHomeInitialData(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const [totalResult, pendingCountResult, completedCountResult, pendingOrdersResult] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_processed", false),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_processed", true),
    fetchAllHomeOrders(supabase, userId, false),
  ]);

  const error = totalResult.error ?? pendingCountResult.error ?? completedCountResult.error;
  if (error) throw new Error(error.message);

  const orderCounts: HomeOrderCounts = {
    total: totalResult.count ?? 0,
    pending: pendingCountResult.count ?? 0,
    completed: completedCountResult.count ?? 0,
  };

  return {
    orderCounts,
    pendingOrders: pendingOrdersResult,
  };
}
