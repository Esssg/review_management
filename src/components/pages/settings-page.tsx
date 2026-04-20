"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { SettingsPanel } from "@/components/settings/settings-panel";
import { createClient } from "@/lib/supabase/client";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import type { Database } from "@/types/database";

type UserItemSetting = Database["public"]["Tables"]["user_item_settings"]["Row"];

export function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSettingsView = searchParams.get("view") === "account" ? "account" : "home";
  const [phase, setPhase] = useState<"loading" | "guest" | "ready">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    platforms: { id: string; name: string; user_id: string | null }[];
    paymentMethods: { id: string; name: string; user_id: string | null }[];
    buyerAccounts: { id: string; label: string }[];
    hidden: UserItemSetting[];
    purchaseTemplates: PurchaseTemplateRow[];
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
        aiProfileResult,
        publicUserResult,
      ] = await Promise.all([
        supabase
          .from("platforms")
          .select("id, name, user_id")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("payment_methods")
          .select("id, name, user_id")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .eq("is_active", true)
          .order("name"),
        supabase.from("buyer_accounts").select("id, label").eq("user_id", user.id).order("label"),
        supabase
          .from("user_item_settings")
          .select("user_id, target_id, item_type, is_hidden")
          .eq("user_id", user.id)
          .eq("is_hidden", true),
        supabase
          .from("purchase_info_templates")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("user_ai_review_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("users").select("name, email").eq("user_id", user.id).maybeSingle(),
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
        aiReviewProfile: aiProfileResult.data ?? null,
        displayName,
        displayEmail,
      });
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (phase === "loading" || !userId || !payload) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">설정</h1>

      <SettingsPanel
        userId={userId}
        initialView={initialSettingsView}
        initialDisplayName={payload.displayName}
        initialEmail={payload.displayEmail}
        initialPlatforms={payload.platforms}
        initialPaymentMethods={payload.paymentMethods}
        initialBuyerAccounts={payload.buyerAccounts}
        hiddenSettings={payload.hidden}
        initialPurchaseTemplates={payload.purchaseTemplates}
        initialAiReviewProfile={payload.aiReviewProfile}
      />
    </div>
  );
}
