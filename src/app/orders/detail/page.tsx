import { Suspense } from "react";

import { OrderDetailPage } from "@/components/pages/order-detail-page";
import { fetchOrderDetailData, type OrderDetailInitialData } from "@/lib/order-detail-data";
import { createClient as createServerClient } from "@/lib/supabase/server";

type OrderDetailPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: OrderDetailPageProps) {
  const currentSearchParams = await searchParams;
  const requestedId = currentSearchParams.id;
  const orderId = (Array.isArray(requestedId) ? requestedId[0] : requestedId)?.trim() ?? "";
  let initialData: OrderDetailInitialData | null = null;

  if (orderId) {
    try {
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const detailData = await fetchOrderDetailData(supabase, user.id, orderId);
        initialData = { userId: user.id, orderId, ...detailData };
      }
    } catch {
      // 서버 초기 조회가 실패하면 기존 클라이언트 조회가 오류를 표시하도록 넘깁니다.
    }
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        </div>
      }
    >
      <OrderDetailPage key={orderId || "missing-order"} initialData={initialData} />
    </Suspense>
  );
}
