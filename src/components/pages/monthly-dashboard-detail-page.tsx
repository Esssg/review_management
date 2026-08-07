"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { OrderWithRelations } from "@/types/orders";
import { GlobalSearchTrigger } from "@/components/navigation/global-search-trigger";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildGroupedStats,
  buildMonthStat,
  formatKrw,
  formatPercent,
  isValidMonthKey,
  shiftMonth,
} from "@/lib/dashboard-stats";
import { getKoreaDateInputValue } from "@/lib/korea-date";
import { createClient } from "@/lib/supabase/client";

function currentMonthKey() {
  return getKoreaDateInputValue().slice(0, 7);
}

function monthRange(month: string) {
  const from = `${month}-01`;
  const to = `${shiftMonth(month, 1)}-01`;
  return { from, to };
}

function MetricCard({
  label,
  value,
  comparison,
  href,
}: {
  label: string;
  value: string | number;
  comparison?: { current: number; previous: number };
  href?: string;
}) {
  const content = (
    <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold tabular-nums">{value}</p>
      {comparison ? <ChangeBadge current={comparison.current} previous={comparison.previous} /> : null}
    </div>
  );
  return href ? <Link href={href} className="min-w-0 rounded-xl transition-shadow hover:ring-2 hover:ring-primary/20">{content}</Link> : content;
}

function buildMonthlyLedgerHref(month: string, extra: Record<string, string | undefined> = {}) {
  const range = monthRange(month);
  const inclusiveTo = new Date(new Date(`${range.to}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({ from: range.from, to: inclusiveTo });
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `/?${params.toString()}`;
}

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {current === 0 ? "전월과 동일" : "전월 데이터 없음"}
      </p>
    );
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change * 10) / 10;
  const isPositive = rounded > 0;
  const isNegative = rounded < 0;

  return (
    <p
      className={
        isPositive
          ? "mt-1 text-xs text-emerald-600 dark:text-emerald-400"
          : isNegative
            ? "mt-1 text-xs text-rose-600 dark:text-rose-400"
            : "mt-1 text-xs text-muted-foreground"
      }
    >
      {isPositive ? "+" : ""}{rounded}% 전월 대비
    </p>
  );
}

export function MonthlyDashboardDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonth = searchParams.get("month")?.trim() ?? "";
  const month = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [previousOrders, setPreviousOrders] = useState<OrderWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(month);
    const previousMonth = shiftMonth(month, -1);
    const previousRange = monthRange(previousMonth);

    (async () => {
      setPhase("loading");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/");
        return;
      }

      const selectColumns =
        "*, platforms(id, name, color), payment_methods(id, name, color), buyer_accounts(id, label, color), purchase_info_templates(*)";
      const [currentResult, previousResult] = await Promise.all([
        supabase
          .from("orders")
          .select(selectColumns)
          .gte("purchase_date", from)
          .lt("purchase_date", to)
          .order("purchase_date", { ascending: false }),
        supabase
          .from("orders")
          .select(selectColumns)
          .gte("purchase_date", previousRange.from)
          .lt("purchase_date", previousRange.to)
          .order("purchase_date", { ascending: false }),
      ]);

      if (cancelled) return;
      if (currentResult.error || previousResult.error) {
        setErrorMessage(currentResult.error?.message ?? previousResult.error?.message ?? "월별 통계를 불러오지 못했습니다.");
        setPhase("error");
        return;
      }

      setOrders((currentResult.data ?? []) as OrderWithRelations[]);
      setPreviousOrders((previousResult.data ?? []) as OrderWithRelations[]);
      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [month, router]);

  const stat = useMemo(() => buildMonthStat(orders, month), [orders, month]);
  const previousMonth = shiftMonth(month, -1);
  const previousStat = useMemo(
    () => buildMonthStat(previousOrders, previousMonth),
    [previousOrders, previousMonth],
  );
  const groupedStats = useMemo(
    () => ({
      byPlatform: buildGroupedStats(orders, (order) => order.platforms?.name ?? "미지정"),
      byMethod: buildGroupedStats(orders, (order) => order.payment_methods?.name ?? "미지정"),
      byAccount: buildGroupedStats(orders, (order) => order.buyer_accounts?.label ?? "미지정"),
    }),
    [orders],
  );

  const moveMonth = (delta: number) => {
    router.push(`/dashboard/monthly?month=${encodeURIComponent(shiftMonth(month, delta))}`);
  };

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight">월별 상세 통계</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {errorMessage}</p>
        <Button type="button" variant="outline" className="w-fit" onClick={() => router.replace("/dashboard")}>
          대시보드로
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-5 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="전월"
            title="전월"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <h1 className="min-w-0 text-center text-2xl font-bold tracking-tight tabular-nums">{month}</h1>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="다음월"
            title="다음월"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <GlobalSearchTrigger />
      </div>

      {phase === "loading" ? (
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      ) : (
        <>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
            <div className="grid min-w-0 gap-5">
              <section className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard
                  label="구매금액"
                  value={formatKrw(stat.purchaseAmount)}
                  comparison={{ current: stat.purchaseAmount, previous: previousStat.purchaseAmount }}
                  href={buildMonthlyLedgerHref(month)}
                />
                <MetricCard
                  label="입금금액"
                  value={formatKrw(stat.depositAmount)}
                  comparison={{ current: stat.depositAmount, previous: previousStat.depositAmount }}
                  href={buildMonthlyLedgerHref(month, { status: "completed" })}
                />
                <MetricCard
                  label="수익"
                  value={formatKrw(stat.profitKrw)}
                  comparison={{ current: stat.profitKrw, previous: previousStat.profitKrw }}
                  href={buildMonthlyLedgerHref(month, { status: "completed" })}
                />
                <MetricCard
                  label="미회수 원금"
                  value={formatKrw(stat.unrecoveredPrincipal)}
                  comparison={{ current: stat.unrecoveredPrincipal, previous: previousStat.unrecoveredPrincipal }}
                  href={buildMonthlyLedgerHref(month, { status: "pending" })}
                />
              </section>

              <section className="grid min-w-0 gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-card p-4 shadow-xs">
                  <p className="text-xs font-semibold text-muted-foreground">주문 상태</p>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between"><dt>전체</dt><dd className="font-semibold tabular-nums">{stat.totalCount}건</dd></div>
                    <div className="flex justify-between"><dt>완료</dt><dd><Link href={buildMonthlyLedgerHref(month, { status: "completed" })} className="font-semibold text-primary hover:underline">{stat.completedCount}건</Link></dd></div>
                    <div className="flex justify-between"><dt>미완료</dt><dd><Link href={buildMonthlyLedgerHref(month, { status: "pending" })} className="font-semibold text-amber-700 hover:underline">{stat.pendingCount}건</Link></dd></div>
                  </dl>
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-xs">
                  <p className="text-xs font-semibold text-muted-foreground">배송 상태</p>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between"><dt>배송</dt><dd className="font-semibold tabular-nums">{stat.deliveredCount}건</dd></div>
                    <div className="flex justify-between"><dt>미배송</dt><dd><Link href={buildMonthlyLedgerHref(month, { status: "pending", attention: "undelivered" })} className="font-semibold text-primary hover:underline">{stat.undeliveredCount}건</Link></dd></div>
                    <div className="flex justify-between"><dt>완료율</dt><dd className="font-semibold tabular-nums">{formatPercent(stat.completionRate)}</dd></div>
                  </dl>
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-xs">
                  <p className="text-xs font-semibold text-muted-foreground">수익 효율</p>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between"><dt>수익률</dt><dd className="font-semibold tabular-nums">{formatPercent(stat.profitRate)}</dd></div>
                    <div className="flex justify-between"><dt>평균 수익</dt><dd className="font-semibold tabular-nums">{formatKrw(stat.averageProfitKrw)}</dd></div>
                    <div className="flex justify-between"><dt>전월 주문</dt><dd className="font-semibold tabular-nums">{previousStat.totalCount}건</dd></div>
                  </dl>
                </div>
              </section>
            </div>

            <aside className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">이번 달 확인할 항목</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{month} 운영 상태를 빠르게 점검하세요.</p>
                </div>
                <Link
                  href={buildMonthlyLedgerHref(month)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  장부 보기
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <div className="mt-4 grid gap-2">
                <Link href={buildMonthlyLedgerHref(month, { status: "pending" })} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm transition-colors hover:bg-amber-100 dark:bg-amber-950/30">
                  <span className="text-amber-900 dark:text-amber-100">미완료 주문</span>
                  <span className="font-semibold tabular-nums text-amber-900 dark:text-amber-100">{stat.pendingCount}건</span>
                </Link>
                <Link href={buildMonthlyLedgerHref(month, { status: "pending", attention: "undelivered" })} className="flex items-center justify-between gap-3 rounded-lg bg-sky-50 px-3 py-2.5 text-sm transition-colors hover:bg-sky-100 dark:bg-sky-950/30">
                  <span className="text-sky-900 dark:text-sky-100">미배송 주문</span>
                  <span className="font-semibold tabular-nums text-sky-900 dark:text-sky-100">{stat.undeliveredCount}건</span>
                </Link>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm dark:bg-emerald-950/30">
                  <span className="text-emerald-900 dark:text-emerald-100">완료율</span>
                  <span className="font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">{formatPercent(stat.completionRate)}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-2 border-t pt-4 text-xs text-muted-foreground">
                <Link href="/orders/new" className="flex items-center justify-between gap-2 hover:text-primary">
                  새 주문 등록 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
                <Link href="/menu-4" className="flex items-center justify-between gap-2 hover:text-primary">
                  자동 추천 확인 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </aside>
          </div>

          <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { title: "플랫폼별", rows: groupedStats.byPlatform, filterKey: "platform" },
              { title: "결제방식별", rows: groupedStats.byMethod, filterKey: "payment" },
              { title: "구매계정별", rows: groupedStats.byAccount, filterKey: "account" },
            ].map((group) => (
              <div key={group.title} className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
                <h2 className="text-lg font-semibold">{group.title} 구매/입금/수익</h2>
                <div className="mt-3 min-w-0 max-w-full rounded-lg border">
                  <Table
                    containerClassName="max-w-full overflow-x-auto"
                    className="min-w-[520px] table-fixed w-full max-w-full text-xs sm:text-sm"
                  >
                    <colgroup>
                      <col className="w-[28%]" />
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                      <col className="w-[20%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="px-2 py-2 sm:px-3">분류</TableHead>
                        <TableHead className="px-2 py-2 text-right sm:px-3">구매금액</TableHead>
                        <TableHead className="px-2 py-2 text-right sm:px-3">입금금액</TableHead>
                        <TableHead className="px-2 py-2 text-right sm:px-3">수익</TableHead>
                        <TableHead className="px-2 py-2 text-right sm:px-3">건수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="px-2 py-6 text-center text-muted-foreground sm:px-3">
                            데이터가 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        group.rows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="truncate px-2 py-2 sm:px-3" title={row.key}>
                              <Link
                                href={buildMonthlyLedgerHref(month, {
                                  [group.filterKey]: row.key === "미지정" ? undefined : row.key,
                                })}
                                className="font-medium text-primary underline-offset-2 hover:underline"
                              >
                                {row.key}
                              </Link>
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">
                              {formatKrw(row.purchaseAmount)}
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">
                              {formatKrw(row.depositAmount)}
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">
                              {formatKrw(row.profitKrw)}
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">
                              {row.totalCount}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
