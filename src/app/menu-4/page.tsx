import { Suspense } from "react";

import { CrawlOrdersPage } from "@/components/pages/crawl-orders-page";

export default function Menu4Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        </div>
      }
    >
      <CrawlOrdersPage />
    </Suspense>
  );
}
