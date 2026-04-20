"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">주문 상세</h1>
        <p className="text-muted-foreground text-sm">주문을 찾을 수 없습니다.</p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit")}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (phase === "loading" || phase === "guest") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">주문 상세</h1>
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
    <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
      <div className="flex items-center justify-end">
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit shrink-0")}>
          목록으로
        </Link>
      </div>

      <OrderDetailForm
        key={order.id}
        order={order}
        platforms={master.platforms}
        paymentMethods={master.paymentMethods}
        buyerAccounts={master.buyerAccounts}
      />
    </div>
  );
}
