"use client";

import Link from "next/link";
import { Bell, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { LandingAuthPanel } from "@/components/auth/landing-auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import {
  ORDER_LIST_SELECT,
  OrdersTable,
  type OrderListCounts,
  type OrderWithRelations,
} from "@/components/orders/orders-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

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
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("is_processed", false),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
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
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
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
      <LandingAuthPanel tagline="계정을 확인하는 중입니다.">
        <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
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
      <LandingAuthPanel tagline="로그인하면 내 주문 장부를 바로 볼 수 있어요.">
        <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
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
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">구매 장부</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">구매 장부</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="주문 목록 새로고침"
            title="목록 다시 불러오기"
            disabled={isRefreshing}
            onClick={() => void loadOrders({ manual: true })}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
            ) : (
              <RefreshCw className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            )}
          </button>
          <button
            type="button"
            aria-label="알림"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Bell className="h-4.5 w-4.5 text-slate-600 dark:text-slate-300" />
          </button>
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>

      <OrdersTable
        pendingOrders={pendingOrders}
        completedOrders={completedOrders}
        counts={orderCounts}
        isCountsLoading={isCountsLoading}
        isPendingLoading={isPendingLoading}
        isCompletedLoading={isCompletedLoading}
        onLoadCompleted={loadCompletedOrders}
        onOrderPatched={handleOrderPatched}
        onOrderDeleted={handleOrderDeleted}
      />

      <Link
        href="/orders/new"
        aria-label="주문 추가"
        title="주문 추가"
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg ring-2 ring-white/30 transition-[transform,colors] hover:bg-rose-700 active:scale-95 dark:bg-rose-500 dark:ring-slate-900/40 dark:hover:bg-rose-600"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
      </Link>
    </div>
  );
}
