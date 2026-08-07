"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatKrw } from "@/lib/dashboard-stats";

import { OrderDetailForm } from "@/components/orders/order-detail-form";
import { buttonVariants } from "@/components/ui/button";
import { fetchMasterData } from "@/lib/master-data";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithRelations } from "@/components/orders/orders-table";
import { cn } from "@/lib/utils";

export function OrderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";

  const [phase, setPhase] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [master, setMaster] = useState<Awaited<ReturnType<typeof fetchMasterData>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

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

      const [orderResult, masterData] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "*, platforms(id, name, color), payment_methods(id, name, color), buyer_accounts(id, label, color), purchase_info_templates(*)",
          )
          .eq("id", id)
          .maybeSingle(),
        fetchMasterData(supabase, user.id),
      ]);

      if (cancelled) return;
      if (orderResult.error) {
        setErrorMessage(orderResult.error.message);
        setPhase("error");
        return;
      }
      if (!orderResult.data) {
        setPhase("error");
        setErrorMessage("주문을 찾을 수 없습니다.");
        return;
      }

      setOrder(orderResult.data as OrderWithRelations);
      setMaster(masterData);
      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    if (!id || phase !== "ready") return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        const supabase = createClient();
        const { data } = await supabase.from("orders").select("ai_review").eq("id", id).maybeSingle();
        if (!data) return;
        setOrder((prev) => (prev && prev.id === id ? { ...prev, ai_review: data.ai_review } : prev));
      })();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [id, phase]);

  if (!id) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight">주문 상세</h1>
        <p className="text-muted-foreground text-sm">주문을 찾을 수 없습니다.</p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit")}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (phase === "loading" || phase === "guest") {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight">주문 상세</h1>
        <p className="text-destructive text-sm">상세 조회 오류: {errorMessage}</p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit")}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (!order || !master) {
    return null;
  }

  return (
    <div className="text-foreground mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6 lg:px-8">
      <div className="flex items-center justify-end">
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit shrink-0")}>
          목록으로
        </Link>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <OrderDetailForm
          key={order.id}
          order={order}
          platforms={master.platforms}
          paymentMethods={master.paymentMethods}
          buyerAccounts={master.buyerAccounts}
        />
        {/* 상세 데이터는 별도 조회 없이 현재 주문 상태만 요약해 데스크톱의 보조 영역에 표시합니다. */}
        <aside className="h-fit min-w-0 rounded-xl border bg-card p-4 shadow-xs lg:sticky lg:top-5">
          <h2 className="text-base font-semibold">주문 요약</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">구매금액</span>
              <span className="font-semibold tabular-nums">{formatKrw(Number(order.purchase_price_krw) || 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">입금금액</span>
              <span className="font-semibold tabular-nums">{formatKrw(Number(order.deposit_amount_krw) || 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">주문 상태</span>
              <span className={order.is_processed ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-amber-600 dark:text-amber-400"}>
                {order.is_processed ? "완료" : "미완료"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">배송 상태</span>
              <span className={order.is_item_delivered ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-sky-600 dark:text-sky-400"}>
                {order.is_item_delivered ? "배송" : "미배송"}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
