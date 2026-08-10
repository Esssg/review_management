import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Platform = { id: string; name: string; user_id: string | null; color: string };
export type PaymentMethod = { id: string; name: string; user_id: string | null; color: string };
export type BuyerAccount = { id: string; label: string; color: string };

export type MasterData = {
  platforms: Platform[];
  paymentMethods: PaymentMethod[];
  buyerAccounts: BuyerAccount[];
};

/**
 * 현재 유저에게 보여야 할 마스터 데이터를 조회합니다.
 * - platforms / payment_methods: 시스템 기본값(user_id IS NULL) + 유저 추가값 중 숨기지 않은 항목
 * - buyer_accounts: 유저 소유 계정만
 */
export async function fetchMasterData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<MasterData> {
  const [hiddenResult, platformsResult, methodsResult, accountsResult] = await Promise.all([
    supabase
      .from("user_item_settings")
      .select("target_id, item_type")
      .eq("user_id", userId)
      .eq("is_hidden", true),

    supabase
      .from("platforms")
      .select("id, name, user_id, color")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("payment_methods")
      .select("id, name, user_id, color")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("buyer_accounts")
      .select("id, label, color")
      .eq("user_id", userId)
      .order("label"),
  ]);

  const hidden = hiddenResult.data ?? [];
  const hiddenPlatformIds = new Set<string>();
  const hiddenMethodIds = new Set<string>();
  for (const setting of hidden) {
    if (setting.item_type === "platform") hiddenPlatformIds.add(setting.target_id);
    if (setting.item_type === "payment_method") hiddenMethodIds.add(setting.target_id);
  }

  const platforms = (platformsResult.data ?? []).filter((p) => !hiddenPlatformIds.has(p.id));
  const paymentMethods = (methodsResult.data ?? []).filter((m) => !hiddenMethodIds.has(m.id));
  const buyerAccounts = accountsResult.data ?? [];

  return { platforms, paymentMethods, buyerAccounts };
}
