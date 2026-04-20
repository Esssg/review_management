"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 px-4 pb-6 pt-5 sm:px-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="text-2xl font-semibold tracking-tight">주문 추가</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug break-words">
            필수 항목 입력 {"->"} 저장 가능
          </p>
          <p className="text-muted-foreground/90 mt-0.5 text-[11px] leading-snug break-words">
            입금 완료 정보까지 입력 {"->"} 완료처리 가능
          </p>
        </div>
        <UserAccountMenu email={email ?? "?"} className="shrink-0 self-start" />
      </div>

      <OrderDetailForm
        platforms={master.platforms}
        paymentMethods={master.paymentMethods}
        buyerAccounts={master.buyerAccounts}
      />
    </div>
  );
}
