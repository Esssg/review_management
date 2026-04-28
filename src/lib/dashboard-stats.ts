import type { OrderWithRelations } from "@/components/orders/orders-table";

export type MonthlyStat = {
  month: string;
  purchaseAmount: number;
  depositAmount: number;
  profitKrw: number;
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  deliveredCount: number;
  undeliveredCount: number;
  unrecoveredPrincipal: number;
  averageProfitKrw: number;
  profitRate: number | null;
  completionRate: number | null;
};

export type GroupedDashboardStat = {
  key: string;
  purchaseAmount: number;
  depositAmount: number;
  profitKrw: number;
  totalCount: number;
};

export function toDashboardNumber(v: string | number | null | undefined) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function getMonthKey(date: string) {
  return date.slice(0, 7);
}

export function isValidMonthKey(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const next = new Date(year, monthIndex - 1 + delta, 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function makeEmptyMonthlyStat(month: string): MonthlyStat {
  return {
    month,
    purchaseAmount: 0,
    depositAmount: 0,
    profitKrw: 0,
    totalCount: 0,
    completedCount: 0,
    pendingCount: 0,
    deliveredCount: 0,
    undeliveredCount: 0,
    unrecoveredPrincipal: 0,
    averageProfitKrw: 0,
    profitRate: null,
    completionRate: null,
  };
}

function finalizeMonthlyStat(stat: MonthlyStat) {
  stat.averageProfitKrw = stat.totalCount > 0 ? stat.profitKrw / stat.totalCount : 0;
  stat.profitRate = stat.purchaseAmount > 0 ? (stat.profitKrw / stat.purchaseAmount) * 100 : null;
  stat.completionRate = stat.totalCount > 0 ? (stat.completedCount / stat.totalCount) * 100 : null;
  return stat;
}

export function buildMonthlyStats(orders: OrderWithRelations[]) {
  const map = new Map<string, MonthlyStat>();

  orders.forEach((order) => {
    const month = getMonthKey(order.purchase_date);
    const prev = map.get(month) ?? makeEmptyMonthlyStat(month);
    const purchaseAmount = toDashboardNumber(order.purchase_price_krw);

    prev.purchaseAmount += purchaseAmount;
    prev.depositAmount += toDashboardNumber(order.deposit_amount_krw);
    prev.profitKrw += toDashboardNumber(order.profit_krw);
    prev.totalCount += 1;
    if (order.is_processed) {
      prev.completedCount += 1;
    } else {
      prev.pendingCount += 1;
      prev.unrecoveredPrincipal += purchaseAmount;
    }
    if (order.is_item_delivered) prev.deliveredCount += 1;
    if (!order.is_item_delivered) prev.undeliveredCount += 1;
    map.set(month, prev);
  });

  return [...map.values()]
    .map(finalizeMonthlyStat)
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function buildMonthStat(orders: OrderWithRelations[], month: string) {
  const stat = orders.reduce<MonthlyStat>((prev, order) => {
    const purchaseAmount = toDashboardNumber(order.purchase_price_krw);
    prev.purchaseAmount += purchaseAmount;
    prev.depositAmount += toDashboardNumber(order.deposit_amount_krw);
    prev.profitKrw += toDashboardNumber(order.profit_krw);
    prev.totalCount += 1;
    if (order.is_processed) {
      prev.completedCount += 1;
    } else {
      prev.pendingCount += 1;
      prev.unrecoveredPrincipal += purchaseAmount;
    }
    if (order.is_item_delivered) prev.deliveredCount += 1;
    if (!order.is_item_delivered) prev.undeliveredCount += 1;
    return prev;
  }, makeEmptyMonthlyStat(month));

  return finalizeMonthlyStat(stat);
}

export function buildGroupedStats(
  orders: OrderWithRelations[],
  keySelector: (order: OrderWithRelations) => string,
) {
  const map = new Map<string, GroupedDashboardStat>();
  orders.forEach((order) => {
    const key = keySelector(order) || "미지정";
    const prev = map.get(key) ?? {
      key,
      purchaseAmount: 0,
      depositAmount: 0,
      profitKrw: 0,
      totalCount: 0,
    };
    prev.purchaseAmount += toDashboardNumber(order.purchase_price_krw);
    prev.depositAmount += toDashboardNumber(order.deposit_amount_krw);
    prev.profitKrw += toDashboardNumber(order.profit_krw);
    prev.totalCount += 1;
    map.set(key, prev);
  });
  return [...map.values()].sort((a, b) => b.purchaseAmount - a.purchaseAmount);
}
