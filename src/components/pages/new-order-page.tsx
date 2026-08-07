"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { OrderDetailForm } from "@/components/orders/order-detail-form";
import { fetchMasterData } from "@/lib/master-data";
import { createClient } from "@/lib/supabase/client";

export function NewOrderPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [master, setMaster] = useState<Awaited<ReturnType<typeof fetchMasterData>> | null>(null);

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
      setEmail(user.email ?? user.id);
      const data = await fetchMasterData(supabase, user.id);
      if (cancelled) return;
      setMaster(data);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready || !master) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="text-foreground mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-3 px-4 pb-6 pt-5 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="text-2xl font-bold tracking-tight">주문 추가</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug break-words">
            필수 항목 입력 {"->"} 저장 가능
          </p>
          <p className="text-muted-foreground/90 mt-0.5 text-[11px] leading-snug break-words">
            입금 완료 정보까지 입력 {"->"} 완료처리 가능
          </p>
        </div>
        <UserAccountMenu email={email ?? "?"} className="shrink-0 self-start" />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <OrderDetailForm
          platforms={master.platforms}
          paymentMethods={master.paymentMethods}
          buyerAccounts={master.buyerAccounts}
        />
        {/* 입력 화면 옆에 저장 전에 확인할 운영 규칙을 고정해 데스크톱 빈 공간을 안내 영역으로 활용합니다. */}
        <aside className="h-fit min-w-0 rounded-xl border bg-card p-4 shadow-xs lg:sticky lg:top-5">
          <h2 className="text-base font-semibold">등록 체크리스트</h2>
          <ol className="mt-3 grid gap-3 text-sm text-muted-foreground">
            <li><span className="font-semibold text-foreground">1.</span> 구매일과 상품 정보를 먼저 입력하세요.</li>
            <li><span className="font-semibold text-foreground">2.</span> 구매금액과 배송 여부를 확인하세요.</li>
            <li><span className="font-semibold text-foreground">3.</span> 입금 정보가 있으면 완료 처리할 수 있습니다.</li>
          </ol>
          <div className="mt-4 border-t pt-4">
            <Link href="/settings?view=purchase-templates" className="text-sm font-medium text-primary hover:underline">
              구매 정보 템플릿 관리 →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
