import { Suspense } from "react";

import { SettingsPage } from "@/components/pages/settings-page";
import { fetchSettingsPayload, type SettingsPayload } from "@/lib/settings-data";
import { createClient as createServerClient } from "@/lib/supabase/server";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SETTINGS_VIEWS = new Set([
  "home",
  "account",
  "nickname",
  "defaults",
  "purchase-templates",
  "ai",
  "platforms",
  "payment-methods",
  "buyer-accounts",
  "trash",
]);

export default async function Page({ searchParams }: SettingsPageProps) {
  const currentSearchParams = await searchParams;
  const requestedView = currentSearchParams.view;
  const view = Array.isArray(requestedView) ? requestedView[0] : requestedView;
  const initialView = view && SETTINGS_VIEWS.has(view) ? view : "home";
  let initialData: SettingsPayload | null = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // 템플릿 사용량은 해당 설정 화면에 들어왔을 때만 서버에서 계산합니다.
      initialData = await fetchSettingsPayload(supabase, user, initialView);
    }
  } catch {
    // 서버 초기 조회가 실패하면 기존 클라이언트 SWR 조회가 화면을 대신 채웁니다.
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        </div>
      }
    >
      <SettingsPage initialData={initialData} />
    </Suspense>
  );
}
