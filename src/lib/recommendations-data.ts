import type { SupabaseClient, User } from "@supabase/supabase-js";

import { fetchMasterData, type MasterData } from "@/lib/master-data";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";
import type { Database } from "@/types/database";

export type RecommendationAuthUser = Pick<User, "id" | "email" | "user_metadata">;
export type CrawlOrderRow = Database["public"]["Tables"]["crawl_orders"]["Row"];
export type RecommendationPlatformAccountRow = Pick<
  Database["public"]["Tables"]["platform_accounts"]["Row"],
  "id" | "name" | "status"
>;

export type RecommendationInitialData = {
  user: RecommendationAuthUser;
  selectedId: string;
  crawlOrders: CrawlOrderRow[];
  selectedCrawlOrder: CrawlOrderRow | null;
  master: MasterData;
  platformAccounts: RecommendationPlatformAccountRow[];
  autoAdvanceRecommendations: boolean;
};

const CRAWL_ORDER_PAGE_SIZE = 1000;

export async function fetchRecommendationCrawlOrders(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const rows: CrawlOrderRow[] = [];

  // Supabase 기본 반환 제한을 넘는 대기 주문도 목록에서 누락되지 않게 페이지별로 읽습니다.
  for (let from = 0; ; from += CRAWL_ORDER_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("crawl_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("crawl_order_status", 0)
      .order("purchase_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, from + CRAWL_ORDER_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < CRAWL_ORDER_PAGE_SIZE) return rows;
  }
}

export async function fetchSelectedRecommendationCrawlOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  selectedId: string,
) {
  if (!selectedId) return null;

  const { data, error } = await supabase
    .from("crawl_orders")
    .select("*")
    .eq("id", selectedId)
    .eq("user_id", userId)
    .eq("crawl_order_status", 0)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchRecommendationPlatformAccounts(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("platform_accounts")
    .select("id, name, status")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchRecommendationInitialData(
  supabase: SupabaseClient<Database>,
  user: RecommendationAuthUser,
  selectedId: string,
): Promise<RecommendationInitialData> {
  const [crawlOrders, selectedCrawlOrder, master, platformAccounts, preferences] = await Promise.all([
    fetchRecommendationCrawlOrders(supabase, user.id),
    fetchSelectedRecommendationCrawlOrder(supabase, user.id, selectedId),
    fetchMasterData(supabase, user.id),
    fetchRecommendationPlatformAccounts(supabase, user.id),
    getOrCreateUserPreferences(supabase, user.id),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    selectedId,
    crawlOrders,
    selectedCrawlOrder,
    master,
    platformAccounts,
    autoAdvanceRecommendations: preferences.auto_advance_recommendations,
  };
}
