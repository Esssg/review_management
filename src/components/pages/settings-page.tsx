"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";

import { SettingsPanel, type SettingsPanelView } from "@/components/settings/settings-panel";
import { GlobalSearchTrigger } from "@/components/navigation/global-search-trigger";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  fetchSettingsPayload,
  fetchTemplateUsageCounts,
  type SettingsAuthUser,
  type SettingsPayload,
} from "@/lib/settings-data";
import { createClient } from "@/lib/supabase/client";

type SettingsSWRKey = readonly ["settings", string, SettingsPanelView];

export function SettingsPage({ initialData = null }: { initialData?: SettingsPayload | null }) {
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
  const [phase, setPhase] = useState<"loading" | "guest" | "ready">(initialData ? "ready" : "loading");
  const [userId, setUserId] = useState<string | null>(initialData?.user.id ?? null);
  const [authUser, setAuthUser] = useState<SettingsAuthUser | null>(initialData?.user ?? null);
  const [isInitialDataActive, setIsInitialDataActive] = useState(Boolean(initialData));

  const settingsFetcher = useCallback(async () => {
    if (!authUser) throw new Error("로그인이 필요합니다.");
    return fetchSettingsPayload(createClient(), authUser, initialSettingsView);
  }, [authUser, initialSettingsView]);
  const {
    data: payload,
    error: payloadError,
  } = useSWR<SettingsPayload>(
    userId && authUser ? ["settings", userId, initialSettingsView] satisfies SettingsSWRKey : null,
    settingsFetcher,
    {
      fallbackData:
        initialData &&
        initialData.user.id === userId &&
        initialData.view === initialSettingsView
          ? initialData
          : undefined,
      revalidateOnMount:
        !isInitialDataActive ||
        !initialData ||
        initialData.user.id !== userId ||
        initialData.view !== initialSettingsView,
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setIsInitialDataActive(false);
        router.replace("/");
        return;
      }

      if (cancelled) return;
      setUserId(user.id);
      setAuthUser(user);
      setIsInitialDataActive(initialData?.user.id === user.id && initialData?.view === initialSettingsView);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [initialData, initialSettingsView, router]);

  if (payloadError) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {payloadError instanceof Error ? payloadError.message : String(payloadError)}</p>
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          <GlobalSearchTrigger />
          <NotificationBell />
        </div>
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
