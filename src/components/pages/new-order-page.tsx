"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Copy, WalletCards } from "lucide-react";

import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { GlobalSearchTrigger } from "@/components/navigation/global-search-trigger";
import { OrderDetailForm, type OrderFormSummary } from "@/components/orders/order-detail-form";
import { fetchMasterData } from "@/lib/master-data";
import { getKoreaDateInputValue } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithRelations } from "@/types/orders";

export function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams.get("copy")?.trim() ?? "";
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [master, setMaster] = useState<Awaited<ReturnType<typeof fetchMasterData>> | null>(null);
  const [copyOrder, setCopyOrder] = useState<OrderWithRelations | null>(null);
  const [summary, setSummary] = useState<OrderFormSummary | null>(null);

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
      setUserId(user.id);
      const [data, copyResult] = await Promise.all([
        fetchMasterData(supabase, user.id),
        copyId
          ? supabase
              .from("orders")
              .select("*, platforms(id, name, color), payment_methods(id, name, color), buyer_accounts(id, label, color), purchase_info_templates(*)")
              .eq("id", copyId)
              .is("deleted_at", null)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      setMaster(data);
      setCopyOrder((copyResult.data as OrderWithRelations | null) ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [copyId, router]);

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
          <h1 className="text-2xl font-bold tracking-tight">{copyOrder ? "주문 복제" : "주문 추가"}</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug break-words">
            필수 항목 입력 {"->"} 저장 가능
          </p>
          <p className="text-muted-foreground/90 mt-0.5 text-[11px] leading-snug break-words">
            입금 완료 정보까지 입력 {"->"} 완료처리 가능
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <GlobalSearchTrigger />
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <OrderDetailForm
          key={copyOrder?.id ?? "new-order"}
          userId={userId}
          draftOrder={copyOrder ? {
            ...copyOrder,
            id: `copy-${copyOrder.id}`,
            order_number: null,
            purchase_date: getKoreaDateInputValue(),
            deposit_date: null,
            deposit_amount_krw: null,
            profit_krw: null,
            deposit_memo: null,
            notes: null,
            scheduled_purchase_at: null,
            screenshot_storage_path: null,
            order_status: null,
            is_processed: false,
            ai_review: null,
            ai_review_user_prompt: null,
          } : undefined}
          onSummaryChange={setSummary}
          platforms={master.platforms}
          paymentMethods={master.paymentMethods}
          buyerAccounts={master.buyerAccounts}
        />
        {/* 입력 중인 값과 누락 항목을 실시간으로 보여줘 데스크톱 보조 영역을 실제 확인 작업에 사용합니다. */}
        <aside className="h-fit min-w-0 rounded-xl border bg-card p-4 shadow-xs lg:sticky lg:top-5">
          <div className="flex items-center gap-2">
            {copyOrder ? <Copy className="h-4 w-4 text-primary" aria-hidden /> : <WalletCards className="h-4 w-4 text-primary" aria-hidden />}
            <h2 className="text-base font-semibold">등록 전 요약</h2>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">상품</dt>
              <dd className="max-w-[65%] text-right font-medium break-words">{summary?.productName || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">구매금액</dt>
              <dd className="font-semibold tabular-nums">{(summary?.purchasePrice ?? 0).toLocaleString("ko-KR")}원</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">분류</dt>
              <dd className="max-w-[65%] text-right">{[summary?.platformName, summary?.paymentMethodName].filter(Boolean).join(" · ") || "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">구매계정</dt>
              <dd className="max-w-[65%] text-right">{summary?.buyerAccountNames.join(", ") || "—"}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">구매 예정</dt>
              <dd className="max-w-[65%] text-right">{summary?.scheduledPurchaseAt ? new Date(summary.scheduledPurchaseAt).toLocaleString("ko-KR") : "없음"}</dd>
            </div>
          </dl>
          <div className="mt-4 border-t pt-4">
            {summary?.missingFields.length ? (
              <div className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden />필수 항목 {summary.missingFields.length}개 남음</p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">{summary.missingFields.join(", ")}</p>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden />필수 항목 입력 완료</p>
            )}
            {summary?.duplicateCount ? (
              <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">비슷한 기존 주문 {summary.duplicateCount}건을 확인해 주세요.</p>
            ) : null}
          </div>
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
