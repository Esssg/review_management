import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];
export type OrderSaveAction = "ledger" | "same" | "blank";
export type LedgerDensity = "compact" | "comfortable";

/** 아직 설정 행이 없는 사용자에게 화면에서 바로 적용할 기본 동작입니다. */
export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, "user_id" | "created_at" | "updated_at"> = {
  default_platform_id: null,
  default_payment_method_id: null,
  default_buyer_account_id: null,
  default_purchase_info_template_id: null,
  recent_platform_id: null,
  recent_payment_method_id: null,
  recent_buyer_account_id: null,
  recent_purchase_info_template_id: null,
  order_save_action: "ledger",
  auto_advance_recommendations: true,
  ledger_density: "compact",
};

/** 설정 화면과 업무 화면이 같은 초기값을 쓰도록 사용자 설정 행을 한 번만 보장합니다. */
export async function getOrCreateUserPreferences(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserPreferences> {
  const { data: existing, error: readError } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
