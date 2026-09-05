import type { SupabaseClient, User } from "@supabase/supabase-js";

import { fetchMasterData, type MasterData } from "@/lib/master-data";
import { fetchAllPages } from "@/lib/pagination";
import { getOrCreateUserPreferences } from "@/lib/user-preferences";
import type { Database } from "@/types/database";

export type RecommendationAuthUser = Pick<User, "id" | "email" | "user_metadata">;
export type CrawlOrderRow = Database["public"]["Tables"]["crawl_orders"]["Row"];
type BankAccountDepositRow = Database["public"]["Tables"]["bank_account_deposit"]["Row"];
type BankAccountRow = Database["public"]["Tables"]["bank_account"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type DepositBankAccount = Pick<BankAccountRow, "bank_account_name" | "bank" | "bank_account_number">;
export type DepositBankAccountSummary = Pick<BankAccountRow, "id" | "bank_account_name" | "bank" | "bank_account_number">;
export type DepositWithAccount = BankAccountDepositRow & {
  bank_account: DepositBankAccount | null;
};
export type PendingDepositOrder = Pick<
  OrderRow,
  | "id"
  | "title"
  | "product_name"
  | "purchase_date"
  | "purchase_price_krw"
  | "deposit_date"
  | "deposit_amount_krw"
  | "is_processed"
  | "is_item_delivered"
  | "platform_id"
  | "buyer_account_id"
>;

export type DepositRecommendationData = {
  bankAccounts: DepositBankAccountSummary[];
  deposits: DepositWithAccount[];
  orders: PendingDepositOrder[];
};

export type RecoveryData = {
  crawlOrders: CrawlOrderRow[];
  deposits: DepositWithAccount[];
};

export type RecommendationInitialData = {
  user: RecommendationAuthUser;
  selectedId: string;
  crawlOrders: CrawlOrderRow[];
  selectedCrawlOrder: CrawlOrderRow | null;
  master: MasterData;
  autoAdvanceRecommendations: boolean;
};

export async function fetchRecommendationCrawlOrders(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const result = await fetchAllPages<CrawlOrderRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("crawl_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("crawl_order_status", 0)
      .order("purchase_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, to);

    return { data: (data ?? []) as CrawlOrderRow[], error };
  });

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
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

export async function fetchRecommendationDepositData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DepositRecommendationData> {
  const [bankAccountsResult, depositsResult, pendingOrdersResult] = await Promise.all([
    // 입금 자동추천 화면에는 민감 인증값을 빼고 운영자가 확인할 계좌 정보만 가져옵니다.
    supabase
      .from("bank_account")
      .select("id, bank_account_name, bank, bank_account_number")
      .eq("user_id", userId)
      .order("id", { ascending: true }),
    // 미완료 입금 내역은 오래된 순서를 유지하며 모든 페이지를 가져옵니다.
    fetchAllPages<DepositWithAccount>(async (from, to) => {
      const result = await supabase
        .from("bank_account_deposit")
        .select(`
          id,
          bank_account_id,
          date,
          time,
          counterparty,
          amount,
          bank_account_deposit_status,
          bank_account:bank_account_id (
            bank_account_name,
            bank,
            bank_account_number
          )
        `)
        .eq("bank_account_deposit_status", 0)
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);

      return {
        data: (result.data ?? []) as DepositWithAccount[],
        error: result.error,
      };
    }),
    // 주문도 구매일과 ID 순서로 끝까지 가져와 최근 주문이 추천에서 누락되지 않게 합니다.
    fetchAllPages<PendingDepositOrder>(async (from, to) => {
      const result = await supabase
        .from("orders")
        .select(
          "id, title, product_name, purchase_date, purchase_price_krw, deposit_date, deposit_amount_krw, is_processed, is_item_delivered, platform_id, buyer_account_id",
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("purchase_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);

      return {
        data: (result.data ?? []) as PendingDepositOrder[],
        error: result.error,
      };
    }),
  ]);

  const error = bankAccountsResult.error ?? depositsResult.error ?? pendingOrdersResult.error;
  if (error) throw new Error(error.message);

  return {
    bankAccounts: (bankAccountsResult.data ?? []) as DepositBankAccountSummary[],
    deposits: depositsResult.data ?? [],
    orders: pendingOrdersResult.data ?? [],
  };
}

export async function fetchRecommendationRecoveryData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RecoveryData> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const [crawlResult, depositResult] = await Promise.all([
    // 복구 탭은 최근 30일 중 화면에 표시할 최신 100건만 읽습니다.
    supabase
      .from("crawl_orders")
      .select("*")
      .eq("user_id", userId)
      .in("crawl_order_status", [1, 99])
      .gte("updated_at", cutoff.toISOString())
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("bank_account_deposit")
      .select(`
        id,
        bank_account_id,
        date,
        time,
        counterparty,
        amount,
        bank_account_deposit_status,
        bank_account:bank_account_id (
          bank_account_name,
          bank,
          bank_account_number
        )
      `)
      .in("bank_account_deposit_status", [1, 99])
      .gte("date", cutoffDate)
      .order("date", { ascending: false })
      .order("time", { ascending: false })
      .limit(100),
  ]);

  const error = crawlResult.error ?? depositResult.error;
  if (error) throw new Error(error.message);

  return {
    crawlOrders: crawlResult.data ?? [],
    deposits: (depositResult.data ?? []) as DepositWithAccount[],
  };
}

export async function fetchRecommendationInitialData(
  supabase: SupabaseClient<Database>,
  user: RecommendationAuthUser,
  selectedId: string,
): Promise<RecommendationInitialData> {
  const [crawlOrders, selectedCrawlOrder, master, preferences] = await Promise.all([
    fetchRecommendationCrawlOrders(supabase, user.id),
    fetchSelectedRecommendationCrawlOrder(supabase, user.id, selectedId),
    fetchMasterData(supabase, user.id),
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
    autoAdvanceRecommendations: preferences.auto_advance_recommendations,
  };
}
