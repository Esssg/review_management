"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderWithRelations } from "@/components/orders/orders-table";

type PeriodPreset = "thisMonth" | "last3Months" | "yearToDate" | "all" | "custom";

function toNumber(v: string | number | null | undefined) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

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

export function OrdersDashboard({ orders }: { orders: OrderWithRelations[] }) {
  const [preset, setPreset] = useState<PeriodPreset>("thisMonth");
  const defaultRange = getPresetRange("thisMonth");
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);

  const filteredByPeriod = useMemo(() => {
    return orders.filter((order) => {
      if (fromDate && order.purchase_date < fromDate) return false;
      if (toDate && order.purchase_date > toDate) return false;
      return true;
    });
  }, [orders, fromDate, toDate]);

  const periodPurchaseAmount = useMemo(
    () => filteredByPeriod.reduce((sum, order) => sum + toNumber(order.purchase_price_krw), 0),
    [filteredByPeriod],
  );

  const currentAssets = useMemo(() => {
    const totalPurchaseAmount = orders.reduce(
      (sum, order) => sum + toNumber(order.purchase_price_krw),
      0,
    );
    const totalDepositAmount = orders.reduce(
      (sum, order) => sum + toNumber(order.deposit_amount_krw),
      0,
    );
    const unrecoveredPrincipal = orders
      .filter((order) => !order.is_processed)
      .reduce((sum, order) => sum + toNumber(order.purchase_price_krw), 0);
    const pendingCount = orders.filter((order) => !order.is_processed).length;

    return { totalPurchaseAmount, totalDepositAmount, unrecoveredPrincipal, pendingCount };
  }, [orders]);

  const monthlyStats = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        purchaseAmount: number;
        profitKrw: number;
        totalCount: number;
        completedCount: number;
      }
    >();

    orders.forEach((order) => {
      const month = getMonthKey(order.purchase_date);
      const prev = map.get(month) ?? {
        month,
        purchaseAmount: 0,
        profitKrw: 0,
        totalCount: 0,
        completedCount: 0,
      };
      prev.purchaseAmount += toNumber(order.purchase_price_krw);
      prev.profitKrw += toNumber(order.profit_krw);
      prev.totalCount += 1;
      if (order.is_processed) prev.completedCount += 1;
      map.set(month, prev);
    });

    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [orders]);

  const groupedStats = useMemo(() => {
    const buildGroup = (keySelector: (order: OrderWithRelations) => string) => {
      const map = new Map<
        string,
        { key: string; purchaseAmount: number; depositAmount: number; profitKrw: number }
      >();
      orders.forEach((order) => {
        const key = keySelector(order) || "미지정";
        const prev = map.get(key) ?? { key, purchaseAmount: 0, depositAmount: 0, profitKrw: 0 };
        prev.purchaseAmount += toNumber(order.purchase_price_krw);
        prev.depositAmount += toNumber(order.deposit_amount_krw);
        prev.profitKrw += toNumber(order.profit_krw);
        map.set(key, prev);
      });
      return [...map.values()].sort((a, b) => b.purchaseAmount - a.purchaseAmount);
    };

    return {
      byPlatform: buildGroup((order) => order.platforms?.name ?? "미지정"),
      byMethod: buildGroup((order) => order.payment_methods?.name ?? "미지정"),
      byAccount: buildGroup((order) => order.buyer_accounts?.label ?? "미지정"),
    };
  }, [orders]);

  const onChangePreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const range = getPresetRange(nextPreset);
      setFromDate(range.from);
      setToDate(range.to);
    }
  };

  return (
    <div className="flex max-w-full min-w-0 flex-col gap-6 overflow-x-hidden">
      <section className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
        <h2 className="text-lg font-semibold">1. 기간별 구매금액 조회</h2>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <select
            value={preset}
            onChange={(event) => onChangePreset(event.target.value as PeriodPreset)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="thisMonth">이번 달</option>
            <option value="last3Months">최근 3개월</option>
            <option value="yearToDate">연초부터</option>
            <option value="all">전체 기간</option>
            <option value="custom">직접 지정</option>
          </select>
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setPreset("custom");
              setFromDate(event.target.value);
            }}
          />
          <Input
            type="date"
            value={toDate}
            onChange={(event) => {
              setPreset("custom");
              setToDate(event.target.value);
            }}
          />
          <div className="min-w-0 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            대상 건수: <span className="font-semibold">{filteredByPeriod.length}건</span>
          </div>
        </div>
        <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
          {formatKrw(periodPurchaseAmount)}
        </p>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-muted-foreground text-xs">누적 구매금액</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
            {formatKrw(currentAssets.totalPurchaseAmount)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-muted-foreground text-xs">누적 입금금액</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
            {formatKrw(currentAssets.totalDepositAmount)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-muted-foreground text-xs">미회수 원금</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
            {formatKrw(currentAssets.unrecoveredPrincipal)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-muted-foreground text-xs">미완료 건수</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
            {currentAssets.pendingCount}건
          </p>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
        <h2 className="text-lg font-semibold">3. 월별 요약 통계</h2>
        <div className="mt-3 min-w-0 max-w-full rounded-lg border">
          <Table
            containerClassName="max-w-full overflow-x-hidden"
            className="table-fixed w-full max-w-full text-xs sm:text-sm"
          >
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[28%]" />
              <col className="w-[28%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-2 py-2 sm:px-3">월</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">구매금액</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">수익</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">전체 건수</TableHead>
                <TableHead className="px-2 py-2 text-right sm:px-3">완료 건수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyStats.map((stat) => (
                <TableRow key={stat.month}>
                  <TableCell className="px-2 py-2 sm:px-3">{stat.month}</TableCell>
                  <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">
                    {formatKrw(stat.purchaseAmount)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">
                    {formatKrw(stat.profitKrw)}
                  </TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.totalCount}</TableCell>
                  <TableCell className="px-2 py-2 text-right tabular-nums sm:px-3">{stat.completedCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { title: "플랫폼별", rows: groupedStats.byPlatform },
          { title: "결제방식별", rows: groupedStats.byMethod },
          { title: "구매계정별", rows: groupedStats.byAccount },
        ].map((group) => (
          <div key={group.title} className="min-w-0 rounded-xl border bg-card p-4 shadow-xs">
            <h2 className="text-lg font-semibold">{group.title} 구매/입금/수익</h2>
            <div className="mt-3 min-w-0 max-w-full rounded-lg border">
              <Table
                containerClassName="max-w-full overflow-x-hidden"
                className="table-fixed w-full max-w-full text-xs sm:text-sm"
              >
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[22%]" />
                  <col className="w-[22%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-2 py-2 sm:px-3">분류</TableHead>
                    <TableHead className="px-2 py-2 text-right sm:px-3">구매금액</TableHead>
                    <TableHead className="px-2 py-2 text-right sm:px-3">입금금액</TableHead>
                    <TableHead className="px-2 py-2 text-right sm:px-3">수익</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell
                        className="truncate px-2 py-2 sm:px-3"
                        title={row.key}
                      >
                        {row.key}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">
                        {formatKrw(row.purchaseAmount)}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">
                        {formatKrw(row.depositAmount)}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:text-sm">
                        {formatKrw(row.profitKrw)}
                      </TableCell>
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
