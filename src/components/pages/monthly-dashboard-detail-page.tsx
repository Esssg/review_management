"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { OrderWithRelations } from "@/components/orders/orders-table";
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
import { createClient } from "@/lib/supabase/client";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const from = `${month}-01`;
  const to = `${shiftMonth(month, 1)}-01`;
  return { from, to };
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function MonthlyDashboardDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonth = searchParams.get("month")?.trim() ?? "";
  const month = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(month);

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

      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, platforms(id, name, color), payment_methods(id, name, color), buyer_accounts(id, label, color), purchase_info_templates(*)",
        )
        .gte("purchase_date", from)
        .lt("purchase_date", to)
        .order("purchase_date", { ascending: false });

      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setPhase("error");
        return;
      }

      setOrders((data ?? []) as OrderWithRelations[]);
      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [month, router]);

  const stat = useMemo(() => buildMonthStat(orders, month), [orders, month]);
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
      <div className="mx-auto flex w-full min-w-0 max-w-screen-md flex-1 flex-col gap-4 overflow-x-hidden p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">월별 상세 통계</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {errorMessage}</p>
        <Button type="button" variant="outline" className="w-fit" onClick={() => router.replace("/dashboard")}>
          대시보드로
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-screen-md flex-1 flex-col gap-5 overflow-x-hidden p-4 sm:p-6">
      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2">
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
        <h1 className="min-w-0 text-center text-2xl font-semibold tracking-tight tabular-nums">{month}</h1>
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

      {phase === "loading" ? (
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      ) : (
        <>
          <section className="grid min-w-0 grid-cols-2 gap-3">
            <MetricCard label="구매금액" value={formatKrw(stat.purchaseAmount)} />
            <MetricCard label="입금금액" value={formatKrw(stat.depositAmount)} />
            <MetricCard label="수익" value={formatKrw(stat.profitKrw)} />
            <MetricCard label="미회수 원금" value={formatKrw(stat.unrecoveredPrincipal)} />
            <MetricCard label="전체 건수" value={`${stat.totalCount}건`} />
            <MetricCard label="완료 건수" value={`${stat.completedCount}건`} />
            <MetricCard label="미완료 건수" value={`${stat.pendingCount}건`} />
            <MetricCard label="미배송 건수" value={`${stat.undeliveredCount}건`} />
            <MetricCard label="완료율" value={formatPercent(stat.completionRate)} />
            <MetricCard label="수익률" value={formatPercent(stat.profitRate)} />
            <MetricCard label="평균 수익" value={formatKrw(stat.averageProfitKrw)} />
            <MetricCard label="배송 건수" value={`${stat.deliveredCount}건`} />
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-4">
            {[
              { title: "플랫폼별", rows: groupedStats.byPlatform },
              { title: "결제방식별", rows: groupedStats.byMethod },
              { title: "구매계정별", rows: groupedStats.byAccount },
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
                              {row.key}
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
