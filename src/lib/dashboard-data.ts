import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { DASHBOARD_ORDER_SELECT, type DashboardOrder } from "@/types/orders";

export const DASHBOARD_ORDER_PAGE_SIZE = 1000;

type DashboardOrderRange = {
  from?: string;
  toExclusive?: string;
};

/** Supabase 기본 1,000건 제한을 넘겨도 대시보드 주문을 모두 읽습니다. */
export async function fetchAllDashboardOrders(
  supabase: SupabaseClient<Database>,
  range: DashboardOrderRange = {},
) {
  const rows: DashboardOrder[] = [];

  for (let from = 0; ; from += DASHBOARD_ORDER_PAGE_SIZE) {
    let query = supabase
      .from("orders")
      .select(DASHBOARD_ORDER_SELECT)
      .is("deleted_at", null)
      .order("purchase_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + DASHBOARD_ORDER_PAGE_SIZE - 1);

    if (range.from) query = query.gte("purchase_date", range.from);
    if (range.toExclusive) query = query.lt("purchase_date", range.toExclusive);

    const { data, error } = await query;
    if (error) return { data: null, error };

    const page = (data ?? []) as DashboardOrder[];
    rows.push(...page);
    if (page.length < DASHBOARD_ORDER_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}
