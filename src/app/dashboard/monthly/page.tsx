import { Suspense } from "react";

import { MonthlyDashboardDetailPage } from "@/components/pages/monthly-dashboard-detail-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-screen-md flex-1 flex-col gap-4 p-6">
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        </div>
      }
    >
      <MonthlyDashboardDetailPage />
    </Suspense>
  );
}
