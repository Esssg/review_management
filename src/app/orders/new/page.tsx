import { Suspense } from "react";

import { NewOrderPage } from "@/components/pages/new-order-page";
import { fetchNewOrderData, type NewOrderInitialData } from "@/lib/new-order-data";
import { createClient as createServerClient } from "@/lib/supabase/server";

type NewOrderPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: NewOrderPageProps) {
  const currentSearchParams = await searchParams;
  const requestedCopyId = currentSearchParams.copy;
  const copyId = (Array.isArray(requestedCopyId) ? requestedCopyId[0] : requestedCopyId)?.trim() ?? "";
  let initialData: NewOrderInitialData | null = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const newOrderData = await fetchNewOrderData(supabase, user.id, copyId);
      initialData = {
        userId: user.id,
        email: user.email ?? user.id,
        copyId,
        ...newOrderData,
      };
    }
  } catch {
    // 서버 초기 조회가 실패하면 기존 클라이언트 조회가 화면을 대신 채웁니다.
  }

  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1440px] px-4 py-5 text-sm text-muted-foreground">불러오는 중…</div>}>
      <NewOrderPage key={copyId || "new-order"} initialData={initialData} />
    </Suspense>
  );
}
