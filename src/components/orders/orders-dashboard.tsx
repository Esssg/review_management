"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import type { OrderWithRelations } from "@/types/orders";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportDashboardExcel } from "@/lib/export-dashboard-excel";
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
  buildMonthlyStats,
  formatKrw,
  formatPercent,
  summarizeOrders,
} from "@/lib/dashboard-stats";

type PeriodPreset = "thisMonth" | "last3Months" | "yearToDate" | "all" | "custom";

function getPresetRange(preset: PeriodPreset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (preset === "all") return { from: "", to: "" };
  if (preset === "yearToDate") {
    const from = `${y}-01-01`;
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }
  if (preset === "thisMonth") {
    const from = new Date(y, m, 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }
  if (preset === "last3Months") {
    const from = new Date(y, m - 2, 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  }

  return { from: "", to: "" };
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPreviousRange(from: string, to: string) {
  if (!from || !to) return null;
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (!Number.isFinite(dayCount) || dayCount <= 0) return null;

  const previousTo = new Date(start.getTime() - 86400000);
  const previousFrom = new Date(previousTo.getTime() - (dayCount - 1) * 86400000);
  return { from: toDateInput(previousFrom), to: toDateInput(previousTo) };
}

function formatRange(from: string, to: string) {
  if (!from || !to) return "전체 기간";
  return `${from.replaceAll("-", ".")} ~ ${to.replaceAll("-", ".")}`;
}

function ChangeBadge({ current, previous, isRate = false }: { current: number; previous: number | null; isRate?: boolean }) {
  if (previous === null) return <span className="text-xs text-ink-faint">비교 없음</span>;

  const difference = current - previous;
  const percentage = previous === 0 ? null : (difference / Math.abs(previous)) * 100;
  const isPositive = difference > 0;
  const isNegative = difference < 0;
  const color = isPositive ? "text-emerald-700" : isNegative ? "text-rose-700" : "text-ink-muted";
  const prefix = difference > 0 ? "+" : "";
  const value = isRate ? `${prefix}${difference.toFixed(1)}%p` : formatKrw(difference);

  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>
      {value}
      {percentage !== null ? ` (${prefix}${percentage.toFixed(1)}%)` : ""}
    </span>
  );
}

function SummaryCard({ label, value, detail, tone = "default", href }: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  tone?: "default" | "warning" | "success";
  href?: string;
}) {
  const toneClass = {
    default: "bg-card",
    warning: "border-amber-200 bg-amber-50/70",
    success: "border-emerald-200 bg-emerald-50/70",
  }[tone];

  const content = (
    <div className={`min-w-0 rounded-xl border border-hairline p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition-colors ${toneClass}`}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      {detail ? <div className="mt-1.5">{detail}</div> : null}
    </div>
  );
  return href ? <Link href={href} className="min-w-0 rounded-xl hover:ring-2 hover:ring-primary/20">{content}</Link> : content;
}

function buildLedgerHref(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function OrdersDashboard({ orders, userEmail }: { orders: OrderWithRelations[]; userEmail: string }) {
  const [preset, setPreset] = useState<PeriodPreset>("thisMonth");
  const defaultRange = getPresetRange("thisMonth");
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);

  const filteredByPeriod = useMemo(
    () => orders.filter((order) => (!fromDate || order.purchase_date >= fromDate) && (!toDate || order.purchase_date <= toDate)),
    [orders, fromDate, toDate],
  );
  const periodSummary = useMemo(() => summarizeOrders(filteredByPeriod), [filteredByPeriod]);
  const currentSummary = useMemo(() => summarizeOrders(orders), [orders]);
  const monthlyStats = useMemo(() => buildMonthlyStats(orders), [orders]);
  const previousRange = useMemo(() => getPreviousRange(fromDate, toDate), [fromDate, toDate]);
  const previousSummary = useMemo(() => {
    if (!previousRange) return null;
    return summarizeOrders(
      orders.filter(
        (order) => order.purchase_date >= previousRange.from && order.purchase_date <= previousRange.to,
      ),
    );
  }, [orders, previousRange]);

  const groupedStats = useMemo(
    () => ({
      byPlatform: buildGroupedStats(filteredByPeriod, (order) => order.platforms?.name ?? "미지정"),
      byMethod: buildGroupedStats(filteredByPeriod, (order) => order.payment_methods?.name ?? "미지정"),
      byAccount: buildGroupedStats(filteredByPeriod, (order) => order.buyer_accounts?.label ?? "미지정"),
    }),
    [filteredByPeriod],
  );

  const onChangePreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const range = getPresetRange(nextPreset);
      setFromDate(range.from);
      setToDate(range.to);
    }
  };

  const topPlatform = groupedStats.byPlatform[0];
  const topAccount = groupedStats.byAccount[0];

  return (
    <div className="flex max-w-full min-w-0 flex-col gap-6 overflow-x-hidden">
      <section className="min-w-0 rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-primary">PERIOD REVIEW</p>
            <h2 className="mt-1 text-lg font-semibold">기간별 구매·회수 흐름</h2>
            <p className="mt-1 text-xs text-ink-muted">{formatRange(fromDate, toDate)} · {filteredByPeriod.length}건</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-surface-soft px-3 py-2 text-right">
              <p className="text-xs text-ink-muted">선택 기간 구매금액</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{formatKrw(periodSummary.purchaseAmount)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={filteredByPeriod.length === 0}
              aria-label="선택 기간 엑셀 내보내기"
              title="현재 선택 기간만 엑셀로 내보내기"
              onClick={() => exportDashboardExcel(filteredByPeriod, userEmail, formatRange(fromDate, toDate))}
            >
              <Download className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <select
            aria-label="분석 기간"
            value={preset}
            onChange={(event) => onChangePreset(event.target.value as PeriodPreset)}
            className="h-10 rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            <option value="thisMonth">이번 달</option>
            <option value="last3Months">최근 3개월</option>
            <option value="yearToDate">연초부터</option>
            <option value="all">전체 기간</option>
            <option value="custom">직접 지정</option>
          </select>
          <Input
            type="date"
            aria-label="분석 시작일"
            value={fromDate}
            onChange={(event) => {
              setPreset("custom");
              setFromDate(event.target.value);
            }}
          />
          <Input
            type="date"
            aria-label="분석 종료일"
            value={toDate}
            onChange={(event) => {
              setPreset("custom");
              setToDate(event.target.value);
            }}
          />
          <div className="flex min-h-10 items-center justify-between rounded-lg border border-hairline bg-surface-soft px-3 text-sm">
            <span className="text-ink-muted">완료율</span>
            <span className="font-semibold tabular-nums">{formatPercent(periodSummary.completionRate)}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-hairline pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-ink-muted">입금금액</p>
            <p className="mt-1 font-semibold tabular-nums">{formatKrw(periodSummary.depositAmount)}</p>
            <ChangeBadge current={periodSummary.depositAmount} previous={previousSummary?.depositAmount ?? null} />
          </div>
          <div>
            <p className="text-xs text-ink-muted">수익</p>
            <p className="mt-1 font-semibold tabular-nums">{formatKrw(periodSummary.profitKrw)}</p>
            <ChangeBadge current={periodSummary.profitKrw} previous={previousSummary?.profitKrw ?? null} />
          </div>
          <div>
            <p className="text-xs text-ink-muted">전월/직전 기간 대비 완료율</p>
            <p className="mt-1 font-semibold tabular-nums">{formatPercent(periodSummary.completionRate)}</p>
            <ChangeBadge current={periodSummary.completionRate ?? 0} previous={previousSummary?.completionRate ?? null} isRate />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="누적 구매금액" value={formatKrw(currentSummary.purchaseAmount)} href="/" />
        <SummaryCard label="누적 입금금액" value={formatKrw(currentSummary.depositAmount)} href="/?status=completed" />
        <SummaryCard label="미회수 원금" value={formatKrw(currentSummary.unrecoveredPrincipal)} tone="warning" href="/?status=pending" detail={<span className="text-xs text-amber-800">입금 미완료 {currentSummary.pendingCount}건</span>} />
        <SummaryCard label="완료율" value={formatPercent(currentSummary.completionRate)} tone="success" href="/?status=completed" detail={<span className="text-xs text-emerald-800">완료 {currentSummary.completedCount}건</span>} />
        <SummaryCard label="미배송 건수" value={`${currentSummary.undeliveredCount}건`} tone={currentSummary.undeliveredCount > 0 ? "warning" : "default"} href="/?attention=undelivered&status=pending" detail={<span className="text-xs text-ink-muted">배송률 {formatPercent(currentSummary.deliveryRate)}</span>} />
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <DashboardCharts monthlyStats={monthlyStats} groupedStats={groupedStats} />
        <section className="min-w-0 rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-primary">OPERATING INSIGHTS</p>
              <h2 className="mt-1 text-lg font-semibold">이번 기간 확인할 것</h2>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">{periodSummary.pendingCount + periodSummary.undeliveredCount}건</span>
          </div>
          <div className="mt-4 grid gap-3">
            <Link href={buildLedgerHref({ status: "pending", from: fromDate, to: toDate })} className="rounded-lg bg-amber-50/80 p-3 transition-colors hover:bg-amber-100">
              <p className="text-xs font-medium text-amber-800">미회수 원금</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-amber-950">{formatKrw(periodSummary.unrecoveredPrincipal)}</p>
              <p className="mt-1 text-xs text-amber-800/80">입금 미완료 {periodSummary.pendingCount}건</p>
            </Link>
            <Link href={buildLedgerHref({ platform: topPlatform?.key === "미지정" ? undefined : topPlatform?.key, from: fromDate, to: toDate })} className="rounded-lg bg-surface-soft p-3 transition-colors hover:bg-accent">
              <p className="text-xs font-medium text-ink-muted">가장 큰 플랫폼</p>
              <p className="mt-1 truncate font-semibold">{topPlatform?.key ?? "데이터 없음"}</p>
              <p className="mt-1 text-xs text-ink-muted tabular-nums">{topPlatform ? formatKrw(topPlatform.purchaseAmount) : "-"}</p>
            </Link>
            <Link href={buildLedgerHref({ account: topAccount?.key === "미지정" ? undefined : topAccount?.key, from: fromDate, to: toDate })} className="rounded-lg bg-surface-soft p-3 transition-colors hover:bg-accent">
              <p className="text-xs font-medium text-ink-muted">가장 많이 사용하는 구매계정</p>
              <p className="mt-1 truncate font-semibold">{topAccount?.key ?? "데이터 없음"}</p>
              <p className="mt-1 text-xs text-ink-muted tabular-nums">{topAccount ? `${topAccount.totalCount}건 · ${formatKrw(topAccount.purchaseAmount)}` : "-"}</p>
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Link href={buildLedgerHref({ status: "pending", from: fromDate, to: toDate })} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-active">미완료 주문 확인</Link>
            <Link href="/menu-4" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-surface-soft">자동추천 열기</Link>
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-primary">MONTHLY SUMMARY</p>
            <h2 className="mt-1 text-lg font-semibold">월별 요약 통계</h2>
          </div>
          <p className="text-xs text-ink-muted">월을 누르면 상세 화면으로 이동합니다.</p>
        </div>
        <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-lg border">
          <Table containerClassName="max-w-full overflow-x-auto" className="min-w-[1040px] table-fixed w-full max-w-full text-xs sm:text-sm">
            <colgroup>
              <col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[8%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-2 py-2 sm:px-3">월</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">구매금액</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">수익</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">입금금액</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">수익률</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">전체</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">완료</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">미완료</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">배송</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">미배송</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyStats.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="px-3 py-8 text-center text-sm text-ink-muted">월별 데이터가 없습니다.</TableCell></TableRow>
              ) : monthlyStats.map((stat) => (
                <TableRow key={stat.month}>
                  <TableCell className="px-2 py-2 sm:px-3"><Link href={`/dashboard/monthly?month=${encodeURIComponent(stat.month)}`} className="font-semibold text-primary underline-offset-2 hover:underline">{stat.month}</Link></TableCell>
                  <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">{formatKrw(stat.purchaseAmount)}</TableCell>
                  <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">{formatKrw(stat.profitKrw)}</TableCell>
                  <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">{formatKrw(stat.depositAmount)}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{formatPercent(stat.profitRate)}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.totalCount}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.completedCount}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.pendingCount}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.deliveredCount}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.undeliveredCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { title: "플랫폼별", rows: groupedStats.byPlatform, filterKey: "platform" },
          { title: "결제방식별", rows: groupedStats.byMethod, filterKey: "payment" },
          { title: "구매계정별", rows: groupedStats.byAccount, filterKey: "account" },
        ].map((group) => (
          <div key={group.title} className="min-w-0 rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
            <h2 className="text-base font-semibold">{group.title} 구매/입금/수익</h2>
            <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-lg border">
              <Table containerClassName="max-w-full overflow-x-auto" className="min-w-[30rem] table-fixed w-full max-w-full text-xs sm:text-sm">
                <TableHeader className="bg-muted/40"><TableRow><TableHead className="px-2 py-2 sm:px-3">분류</TableHead><TableHead className="px-2 py-2 text-right sm:px-3">구매금액</TableHead><TableHead className="px-2 py-2 text-right sm:px-3">입금금액</TableHead><TableHead className="px-2 py-2 text-right sm:px-3">수익</TableHead></TableRow></TableHeader>
                <TableBody>
                  {group.rows.length === 0 ? <TableRow><TableCell colSpan={4} className="px-2 py-6 text-center text-ink-muted">데이터가 없습니다.</TableCell></TableRow> : group.rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="max-w-[8rem] truncate px-2 py-2 sm:px-3" title={row.key}>
                        <Link
                          href={buildLedgerHref({
                            [group.filterKey]: row.key === "미지정" ? undefined : row.key,
                            from: fromDate,
                            to: toDate,
                          })}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {row.key}
                        </Link>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">{formatKrw(row.purchaseAmount)}</TableCell>
                      <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">{formatKrw(row.depositAmount)}</TableCell>
                      <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">{formatKrw(row.profitKrw)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
