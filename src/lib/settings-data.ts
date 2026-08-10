import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { getOrCreateUserPreferences, type UserPreferences } from "@/lib/user-preferences";
import type { Database } from "@/types/database";

export type SettingsAuthUser = Pick<User, "id" | "email" | "user_metadata">;

export type SettingsPayload = {
  view: string;
  user: SettingsAuthUser;
  platforms: { id: string; name: string; user_id: string | null; color: string }[];
  paymentMethods: { id: string; name: string; user_id: string | null; color: string }[];
  buyerAccounts: { id: string; label: string; color: string }[];
  hidden: Database["public"]["Tables"]["user_item_settings"]["Row"][];
  purchaseTemplates: PurchaseTemplateRow[];
  templateUsageCounts: Record<string, number>;
  trashCount: number;
  preferences: UserPreferences;
  aiReviewProfile: Database["public"]["Tables"]["user_ai_review_profiles"]["Row"] | null;
  displayName: string;
  displayEmail: string;
};

const TEMPLATE_USAGE_PAGE_SIZE = 1000;

export async function fetchTemplateUsageCounts(supabase: SupabaseClient<Database>) {
  const counts: Record<string, number> = {};

  // Supabase 기본 반환 제한을 넘는 주문도 템플릿 사용량에서 빠지지 않게 페이지별로 합산합니다.
  for (let from = 0; ; from += TEMPLATE_USAGE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("purchase_info_template_id")
      .is("deleted_at", null)
      .not("purchase_info_template_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + TEMPLATE_USAGE_PAGE_SIZE - 1);
    if (error) return counts;

    for (const row of data ?? []) {
      const templateId = row.purchase_info_template_id;
      if (!templateId) continue;
      counts[templateId] = (counts[templateId] ?? 0) + 1;
    }

    if ((data ?? []).length < TEMPLATE_USAGE_PAGE_SIZE) break;
  }

  return counts;
}

export async function fetchSettingsPayload(
  supabase: SupabaseClient<Database>,
  user: SettingsAuthUser,
  view: string,
): Promise<SettingsPayload> {
  const [
    platformsResult,
    methodsResult,
    accountsResult,
    hiddenResult,
    templatesResult,
    templateUsageCounts,
    aiProfileResult,
    publicUserResult,
    preferences,
    trashCountResult,
  ] = await Promise.all([
    supabase
      .from("platforms")
      .select("id, name, user_id, color")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("payment_methods")
      .select("id, name, user_id, color")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq("is_active", true)
      .order("name"),
    supabase.from("buyer_accounts").select("id, label, color").eq("user_id", user.id).order("label"),
    supabase
      .from("user_item_settings")
      .select("user_id, target_id, item_type, is_hidden")
      .eq("user_id", user.id)
      .eq("is_hidden", true),
    supabase
      .from("purchase_info_templates")
      .select("*")
      .order("created_at", { ascending: false }),
    view === "purchase-templates"
      ? fetchTemplateUsageCounts(supabase)
      : Promise.resolve<Record<string, number>>({}),
    supabase.from("user_ai_review_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("users").select("name, email").eq("user_id", user.id).maybeSingle(),
    getOrCreateUserPreferences(supabase, user.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("deleted_at", "is", null),
  ]);

  const queryError =
    platformsResult.error ??
    methodsResult.error ??
    accountsResult.error ??
    hiddenResult.error ??
    templatesResult.error ??
    aiProfileResult.error ??
    publicUserResult.error ??
    trashCountResult.error;
  if (queryError) throw new Error(queryError.message);

  const authEmail = user.email ?? "";
  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const publicUser = publicUserResult.data;
  const nameFromRow = publicUser?.name?.trim() ?? "";
  const displayName =
    nameFromRow ||
    metaName ||
    (typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "") ||
    (authEmail ? authEmail.split("@")[0] : "") ||
    "회원";

  return {
    view,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    platforms: platformsResult.data ?? [],
    paymentMethods: methodsResult.data ?? [],
    buyerAccounts: accountsResult.data ?? [],
    hidden: hiddenResult.data ?? [],
    purchaseTemplates: templatesResult.data ?? [],
    templateUsageCounts,
    trashCount: trashCountResult.count ?? 0,
    preferences,
    aiReviewProfile: aiProfileResult.data ?? null,
    displayName,
    displayEmail: publicUser?.email ?? authEmail,
  };
}
