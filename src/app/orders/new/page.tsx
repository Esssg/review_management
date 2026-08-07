import { Suspense } from "react";

import { NewOrderPage } from "@/components/pages/new-order-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-[1440px] px-4 py-5 text-sm text-muted-foreground">불러오는 중…</div>}>
      <NewOrderPage />
    </Suspense>
  );
}
