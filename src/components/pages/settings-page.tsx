"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SettingsPanel, type SettingsPanelView } from "@/components/settings/settings-panel";
import { GlobalSearchTrigger } from "@/components/navigation/global-search-trigger";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateUserPreferences, type UserPreferences } from "@/lib/user-preferences";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import type { Database } from "@/types/database";

type UserItemSetting = Database["public"]["Tables"]["user_item_settings"]["Row"];
const TEMPLATE_USAGE_PAGE_SIZE = 1000;

async function fetchTemplateUsageCounts(supabase: ReturnType<typeof createClient>) {
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

export function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const initialSettingsView: SettingsPanelView =
    requestedView === "account" ||
    requestedView === "nickname" ||
    requestedView === "defaults" ||
    requestedView === "purchase-templates" ||
    requestedView === "ai" ||
    requestedView === "platforms" ||
    requestedView === "payment-methods" ||
    requestedView === "buyer-accounts" ||
    requestedView === "trash"
      ? requestedView
      : "home";
  const loadTemplateUsageCounts = useCallback(
    () => fetchTemplateUsageCounts(createClient()),
    [],
  );
  const [phase, setPhase] = useState<"loading" | "guest" | "ready">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    platforms: { id: string; name: string; user_id: string | null; color: string }[];
    paymentMethods: { id: string; name: string; user_id: string | null; color: string }[];
    buyerAccounts: { id: string; label: string; color: string }[];
    hidden: UserItemSetting[];
    purchaseTemplates: PurchaseTemplateRow[];
    templateUsageCounts: Record<string, number>;
    trashCount: number;
    preferences: UserPreferences;
    aiReviewProfile: Database["public"]["Tables"]["user_ai_review_profiles"]["Row"] | null;
    displayName: string;
    displayEmail: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/");
        return;
      }

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
        initialSettingsView === "purchase-templates"
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

      if (cancelled) return;
      setUserId(user.id);
      const authEmail = user.email ?? "";
      const metaName =
        typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
      const publicUser = publicUserResult.data;
      const nameFromRow = publicUser?.name?.trim() ?? "";
      const displayName =
        nameFromRow ||
        metaName ||
        (typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "") ||
        (authEmail ? authEmail.split("@")[0] : "") ||
        "회원";
      const displayEmail = publicUser?.email ?? authEmail;

      setPayload({
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
        displayEmail,
      });
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSettingsView, router]);

  if (phase === "loading" || !userId || !payload) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <GlobalSearchTrigger />
      </div>

      <SettingsPanel
        key={initialSettingsView}
        userId={userId}
        initialView={initialSettingsView}
        initialDisplayName={payload.displayName}
        initialEmail={payload.displayEmail}
        initialPlatforms={payload.platforms}
        initialPaymentMethods={payload.paymentMethods}
        initialBuyerAccounts={payload.buyerAccounts}
        hiddenSettings={payload.hidden}
        initialPurchaseTemplates={payload.purchaseTemplates}
        templateUsageCounts={payload.templateUsageCounts}
        initialTemplateUsageCountsLoaded={initialSettingsView === "purchase-templates"}
        onLoadTemplateUsageCounts={loadTemplateUsageCounts}
        initialTrashCount={payload.trashCount}
        initialPreferences={payload.preferences}
        initialAiReviewProfile={payload.aiReviewProfile}
      />
    </div>
  );
}
