import { Suspense } from "react";

import { CrawlOrdersPage } from "@/components/pages/crawl-orders-page";
import { fetchRecommendationInitialData, type RecommendationInitialData } from "@/lib/recommendations-data";
import { createClient as createServerClient } from "@/lib/supabase/server";

type RecommendationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecommendationsPage({ searchParams }: RecommendationsPageProps) {
  const currentSearchParams = await searchParams;
  const requestedId = currentSearchParams.id;
  const selectedId = (Array.isArray(requestedId) ? requestedId[0] : requestedId)?.trim() ?? "";
  let initialData: RecommendationInitialData | null = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      initialData = await fetchRecommendationInitialData(supabase, user, selectedId);
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
      <CrawlOrdersPage initialData={initialData} />
    </Suspense>
  );
}
