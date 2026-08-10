"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Loader2, PackageCheck, Plus, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LandingAuthPanel } from "@/components/auth/landing-auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import {
  OrdersTable,
  type OrderListCounts,
} from "@/components/orders/orders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlobalSearchTrigger } from "@/components/navigation/global-search-trigger";
import { getKoreaDateInputValue } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/client";
import { ORDER_LIST_SELECT, type OrderWithRelations } from "@/types/orders";

const homeKrwFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function HomeOperationsSummary({
  pendingOrders,
  completedOrders,
  counts,
  isCompletedLoading,
}: {
  pendingOrders: OrderWithRelations[];
  completedOrders: OrderWithRelations[] | null;
  counts: OrderListCounts;
  isCompletedLoading: boolean;
}) {
  const today = getKoreaDateInputValue();
  const pendingPrincipal = useMemo(
    () => pendingOrders.reduce((sum, order) => sum + Number(order.purchase_price_krw || 0), 0),
    [pendingOrders],
  );
  const undeliveredCount = useMemo(() => pendingOrders.filter((order) => !order.is_item_delivered).length, [pendingOrders]);
  const scheduledCount = useMemo(
    () => pendingOrders.filter((order) => {
      if (!order.scheduled_purchase_at) return false;
      const date = new Date(order.scheduled_purchase_at);
      return !Number.isNaN(date.getTime()) && getKoreaDateInputValue(date) === today;
    }).length,
    [pendingOrders, today],
  );
  const missingDepositCount = completedOrders?.filter(
    (order) => !order.deposit_date || order.deposit_amount_krw === null,
  ).length ?? null;
  const completionRate = counts.total && counts.total > 0 && counts.completed !== null
    ? Math.round((counts.completed / counts.total) * 100)
    : null;

  return (
    <aside className="min-w-0 space-y-4 xl:sticky xl:top-5 xl:self-start">
      <section className="rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-primary">TODAY&apos;S QUEUE</p>
            <h2 className="mt-1 text-lg font-semibold">오늘 확인할 일</h2>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
            {pendingOrders.length + undeliveredCount}건
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          <Link href="/?status=pending" className="flex items-center justify-between gap-3 rounded-lg bg-amber-50/80 p-3 transition-colors hover:bg-amber-100/80">
            <div className="flex min-w-0 items-center gap-2">
              <WalletCards className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <span className="truncate text-sm text-amber-950">입금 미완료</span>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-amber-950">{pendingOrders.length}건</span>
          </Link>
          <Link href="/?status=pending&attention=undelivered" className="flex items-center justify-between gap-3 rounded-lg bg-surface-soft p-3 transition-colors hover:bg-accent">
            <div className="flex min-w-0 items-center gap-2">
              <PackageCheck className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate text-sm">미배송 주문</span>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums">{undeliveredCount}건</span>
          </Link>
          <Link href="/?status=pending&attention=scheduleToday" className="flex items-center justify-between gap-3 rounded-lg bg-surface-soft p-3 transition-colors hover:bg-accent">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate text-sm">오늘 구매 일정</span>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums">{scheduledCount}건</span>
          </Link>
          <Link href="/?status=completed&attention=missingDeposit" className="flex items-center justify-between gap-3 rounded-lg bg-surface-soft p-3 transition-colors hover:bg-accent">
            <div className="flex min-w-0 items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate text-sm">완료 정보 확인</span>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {isCompletedLoading ? "…" : missingDepositCount === null ? "완료 목록 열기" : `${missingDepositCount}건`}
            </span>
          </Link>
        </div>

        <div className="mt-4 border-t border-hairline pt-4">
          <div className="flex items-end justify-between gap-2">
            <span className="text-xs text-ink-muted">미완료 구매원금</span>
            <span className="text-base font-bold tabular-nums">{homeKrwFormatter.format(pendingPrincipal)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-muted">
            <span>전체 완료율</span>
            <span className="font-semibold tabular-nums">{completionRate === null ? "-" : `${completionRate}%`}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-soft">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completionRate ?? 0}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-base font-semibold">빠른 작업</h2>
        </div>
        <div className="mt-3 grid gap-2">
          <Link href="/orders/new" className="flex min-h-10 items-center justify-between rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-active">
            주문 추가
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/recommendations" className="flex min-h-10 items-center justify-between rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-surface-soft">
            자동추천 확인
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/dashboard" className="flex min-h-10 items-center justify-between rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-surface-soft">
            재무 흐름 보기
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </aside>
  );
}

const EMPTY_COUNTS: OrderListCounts = {
  total: null,
  pending: null,
  completed: null,
};

function sortOrderList(orders: OrderWithRelations[]) {
  return [...orders].sort((a, b) => {
    const d = b.purchase_date.localeCompare(a.purchase_date);
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
  });
}

function upsertOrder(orders: OrderWithRelations[], order: OrderWithRelations) {
  return sortOrderList([order, ...orders.filter((item) => item.id !== order.id)]);
}

function adjustNullableCount(value: number | null, delta: number) {
  return value === null ? null : Math.max(0, value + delta);
}

export function HomePage() {
  const [phase, setPhase] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<OrderWithRelations[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderWithRelations[] | null>(null);
  const [orderCounts, setOrderCounts] = useState<OrderListCounts>(EMPTY_COUNTS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCountsLoading, setIsCountsLoading] = useState(false);
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [isCompletedLoading, setIsCompletedLoading] = useState(false);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missingEnv = !url?.trim() || !anonKey?.trim();

  const failWithError = useCallback((message: string, isCancelled?: () => boolean) => {
    if (isCancelled?.()) return;
    setErrorMessage(message);
    setPhase("error");
  }, []);

  const loadOrderCounts = useCallback(async (targetUserId: string, isCancelled?: () => boolean) => {
    setIsCountsLoading(true);
    try {
      const supabase = createClient();
      const [totalResult, pendingResult, completedResult] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", targetUserId).is("deleted_at", null),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .is("deleted_at", null)
          .eq("is_processed", false),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .is("deleted_at", null)
          .eq("is_processed", true),
      ]);

      if (isCancelled?.()) return;
      const error = totalResult.error ?? pendingResult.error ?? completedResult.error;
      if (error) {
        failWithError(error.message, isCancelled);
        return;
      }

      setOrderCounts({
        total: totalResult.count ?? 0,
        pending: pendingResult.count ?? 0,
        completed: completedResult.count ?? 0,
      });
    } catch (e) {
      failWithError(e instanceof Error ? e.message : String(e), isCancelled);
    } finally {
      if (!isCancelled?.()) setIsCountsLoading(false);
    }
  }, [failWithError]);

  const loadPendingOrders = useCallback(async (targetUserId: string, isCancelled?: () => boolean) => {
    setIsPendingLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_LIST_SELECT)
        .eq("user_id", targetUserId)
        .is("deleted_at", null)
        .eq("is_processed", false)
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (isCancelled?.()) return;
      if (error) {
        failWithError(error.message, isCancelled);
        return;
      }

      setPendingOrders((data ?? []) as OrderWithRelations[]);
    } catch (e) {
      failWithError(e instanceof Error ? e.message : String(e), isCancelled);
    } finally {
      if (!isCancelled?.()) setIsPendingLoading(false);
    }
  }, [failWithError]);

  const loadOrders = useCallback(async (opts?: { manual?: boolean; isCancelled?: () => boolean }) => {
    const manual = opts?.manual ?? false;
    const isCancelled = opts?.isCancelled;
    if (manual) setIsRefreshing(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isCancelled?.()) return;
      if (!user) {
        setPhase("guest");
        return;
      }
      // 첫 화면을 막지 않도록 사용자 확인 직후 화면 뼈대를 먼저 열고, 목록 조회는 분리해서 진행합니다.
      setEmail(user.email ?? user.id);
      setUserId(user.id);
      setErrorMessage(null);
      setOrderCounts(EMPTY_COUNTS);
      setPendingOrders([]);
      setCompletedOrders(null);
      setIsCompletedLoading(false);
      setPhase("ready");

      const countsPromise = loadOrderCounts(user.id, isCancelled);
      const pendingPromise = loadPendingOrders(user.id, isCancelled);
      if (manual) await Promise.all([countsPromise, pendingPromise]);
    } catch (e) {
      if (isCancelled?.()) return;
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, [loadOrderCounts, loadPendingOrders]);

  const loadCompletedOrders = useCallback(async () => {
    if (!userId || completedOrders !== null || isCompletedLoading) return;
    setIsCompletedLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_LIST_SELECT)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("is_processed", true)
        .order("purchase_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        failWithError(error.message);
        return;
      }

      setCompletedOrders((data ?? []) as OrderWithRelations[]);
    } catch (e) {
      failWithError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCompletedLoading(false);
    }
  }, [completedOrders, failWithError, isCompletedLoading, userId]);

  const handleOrderPatched = useCallback((previous: OrderWithRelations, updated: OrderWithRelations) => {
    setPendingOrders((current) => {
      if (!previous.is_processed && updated.is_processed) return current.filter((item) => item.id !== updated.id);
      if (previous.is_processed && !updated.is_processed) return upsertOrder(current, updated);
      if (!updated.is_processed) return sortOrderList(current.map((item) => (item.id === updated.id ? updated : item)));
      return current;
    });

    setCompletedOrders((current) => {
      if (current === null) return current;
      if (!previous.is_processed && updated.is_processed) return upsertOrder(current, updated);
      if (previous.is_processed && !updated.is_processed) return current.filter((item) => item.id !== updated.id);
      if (updated.is_processed) return sortOrderList(current.map((item) => (item.id === updated.id ? updated : item)));
      return current;
    });

    if (previous.is_processed !== updated.is_processed) {
      setOrderCounts((current) => ({
        total: current.total,
        pending: adjustNullableCount(current.pending, updated.is_processed ? -1 : 1),
        completed: adjustNullableCount(current.completed, updated.is_processed ? 1 : -1),
      }));
    }
  }, []);

  const handleOrderDeleted = useCallback((deleted: OrderWithRelations) => {
    if (deleted.is_processed) {
      setCompletedOrders((current) => current?.filter((item) => item.id !== deleted.id) ?? current);
    } else {
      setPendingOrders((current) => current.filter((item) => item.id !== deleted.id));
    }

    setOrderCounts((current) => ({
      total: adjustNullableCount(current.total, -1),
      pending: adjustNullableCount(current.pending, deleted.is_processed ? 0 : -1),
      completed: adjustNullableCount(current.completed, deleted.is_processed ? -1 : 0),
    }));
  }, []);

  const handleOrderRestored = useCallback((restored: OrderWithRelations) => {
    if (restored.is_processed) {
      setCompletedOrders((current) => current === null ? current : upsertOrder(current, restored));
    } else {
      setPendingOrders((current) => upsertOrder(current, restored));
    }

    setOrderCounts((current) => ({
      total: adjustNullableCount(current.total, 1),
      pending: adjustNullableCount(current.pending, restored.is_processed ? 0 : 1),
      completed: adjustNullableCount(current.completed, restored.is_processed ? 1 : 0),
    }));
  }, []);

  useEffect(() => {
    if (missingEnv) return;

    let cancelled = false;
    void loadOrders({ isCancelled: () => cancelled });

    return () => {
      cancelled = true;
    };
  }, [missingEnv, loadOrders]);

  useEffect(() => {
    if (missingEnv) return;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setPendingOrders([]);
        setCompletedOrders(null);
        setOrderCounts(EMPTY_COUNTS);
        setEmail(null);
        setUserId(null);
        setErrorMessage(null);
        setPhase("guest");
      }
    });
    return () => subscription.unsubscribe();
  }, [missingEnv]);

  if (missingEnv) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">구매 장부</h1>
        <p className="text-muted-foreground text-sm">
          빌드 시 <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>가
          번들에 포함되어야 합니다. <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>
          를 참고하세요.
        </p>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <LandingAuthPanel tagline="계정을 확인하는 중입니다." wide>
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <div className="bg-muted h-5 w-32 animate-pulse rounded-md" />
            <div className="bg-muted mt-2 h-4 w-full max-w-[280px] animate-pulse rounded-md" />
          </CardHeader>
          <CardContent className="grid gap-4 pt-2">
            <div className="bg-muted h-11 animate-pulse rounded-xl" />
            <div className="bg-muted h-11 animate-pulse rounded-xl" />
            <div className="bg-muted h-11 animate-pulse rounded-xl" />
          </CardContent>
        </Card>
      </LandingAuthPanel>
    );
  }

  if (phase === "guest") {
    return (
      <LandingAuthPanel tagline="로그인하면 내 주문 장부를 바로 볼 수 있어요." wide>
        <Card className="shadow-md">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-lg sm:text-xl">로그인</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <LoginForm hideHomeLink onSignedIn={() => loadOrders()} />
          </CardContent>
        </Card>
      </LandingAuthPanel>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">구매 장부</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">구매 장부</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSearchTrigger />
          <button
            type="button"
            aria-label="주문 목록 새로고침"
            title="목록 다시 불러오기"
            disabled={isRefreshing}
            onClick={() => void loadOrders({ manual: true })}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-card text-ink-muted shadow-sm transition-colors hover:bg-accent hover:text-primary disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
        <div className="order-2 min-w-0 xl:order-1">
          <OrdersTable
            userId={userId!}
            userEmail={email ?? ""}
            pendingOrders={pendingOrders}
            completedOrders={completedOrders}
            counts={orderCounts}
            isCountsLoading={isCountsLoading}
            isPendingLoading={isPendingLoading}
            isCompletedLoading={isCompletedLoading}
            onLoadCompleted={loadCompletedOrders}
            onOrderPatched={handleOrderPatched}
            onOrderDeleted={handleOrderDeleted}
            onOrderRestored={handleOrderRestored}
          />
        </div>
        <div className="order-1 min-w-0 xl:order-2">
          <HomeOperationsSummary
            pendingOrders={pendingOrders}
            completedOrders={completedOrders}
            counts={orderCounts}
            isCompletedLoading={isCompletedLoading}
          />
        </div>
      </div>

      <Link
        href="/orders/new"
        aria-label="주문 추가"
        title="주문 추가"
        className="fixed right-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-white/70 transition-[transform,colors] hover:bg-primary-active active:scale-95"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
      </Link>
    </div>
  );
}
