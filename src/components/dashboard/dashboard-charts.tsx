"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GroupedDashboardStat, MonthlyStat } from "@/lib/dashboard-stats";
import { formatKrw, formatPercent } from "@/lib/dashboard-stats";

const CHART_COLORS = {
  purchase: "#0075de",
  deposit: "#2a9d99",
  profit: "#dd5b00",
  completion: "#391c57",
  delivery: "#1aae39",
  pending: "#d97706",
};

// 차트는 기존 집계 데이터를 그대로 사용해 화면을 풍부하게 만들고 추가 조회는 발생시키지 않습니다.
type ChartValue = number | string | null | undefined;

function formatAxisKrw(value: ChartValue) {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) >= 100000000) return `${Math.round(amount / 100000000)}억`;
  if (Math.abs(amount) >= 10000) return `${Math.round(amount / 10000)}만`;
  return `${Math.round(amount / 1000)}천`;
}

function formatTooltipValue(value: unknown, name: string | number | undefined) {
  const label = String(name ?? "값");
  if (label.includes("율")) return [formatPercent(Number(value ?? 0)), label];
  return [formatKrw(Number(value ?? 0)), label];
}

function ChartPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg bg-surface-soft px-4 text-center text-sm text-ink-muted">
      {message}
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: ChartValue; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-hairline bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <div className="grid gap-1">
        {payload.map((entry) => (
          <div key={String(entry.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">{formatKrw(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RateTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: ChartValue; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-hairline bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <div className="grid gap-1">
        {payload.map((entry) => (
          <div key={String(entry.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">{formatPercent(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartLegendToggle({
  items,
  visible,
  onToggle,
}: {
  items: Array<{ key: string; label: string; color: string }>;
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5" aria-label="차트 항목 표시 전환">
      {items.map((item) => {
        const isVisible = visible[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={isVisible}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
              isVisible ? "border-transparent bg-surface-soft text-foreground" : "border-hairline text-ink-faint"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color, opacity: isVisible ? 1 : 0.35 }} aria-hidden />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function MonthTrendChart({ monthlyStats }: { monthlyStats: MonthlyStat[] }) {
  const router = useRouter();
  const [visible, setVisible] = useState({ purchase: true, deposit: true, profit: true });
  const chartData = useMemo(
    () => [...monthlyStats].reverse().map((stat) => ({
      month: stat.month,
      구매금액: stat.purchaseAmount,
      입금금액: stat.depositAmount,
      수익: stat.profitKrw,
    })),
    [monthlyStats],
  );

  const toggle = (key: keyof typeof visible) => setVisible((current) => ({ ...current, [key]: !current[key] }));
  const handleClick = (state: unknown) => {
    if (!state || typeof state !== "object" || !("activeLabel" in state)) return;
    const month = state.activeLabel;
    if (typeof month === "string") router.push(`/dashboard/monthly?month=${encodeURIComponent(month)}`);
  };

  if (chartData.length === 0) return <EmptyChart message="월별 데이터가 쌓이면 금액 흐름을 보여드릴게요." />;

  return (
    <>
      <ChartLegendToggle
        items={[
          { key: "purchase", label: "구매금액", color: CHART_COLORS.purchase },
          { key: "deposit", label: "입금금액", color: CHART_COLORS.deposit },
          { key: "profit", label: "수익", color: CHART_COLORS.profit },
        ]}
        visible={visible}
        onToggle={(key) => toggle(key as keyof typeof visible)}
      />
      <div className="h-64 min-w-0" role="img" aria-label="월별 구매금액, 입금금액, 수익 추이 차트">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} onClick={handleClick}>
            <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={formatAxisKrw} tick={{ fontSize: 10, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} width={42} />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(0, 117, 222, 0.05)" }} />
            <Legend content={() => null} />
            {visible.purchase ? <Bar dataKey="구매금액" fill={CHART_COLORS.purchase} radius={[3, 3, 0, 0]} maxBarSize={24} /> : null}
            {visible.deposit ? <Bar dataKey="입금금액" fill={CHART_COLORS.deposit} radius={[3, 3, 0, 0]} maxBarSize={24} /> : null}
            {visible.profit ? <Line type="monotone" dataKey="수익" stroke={CHART_COLORS.profit} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /> : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">월을 클릭하면 해당 월 상세로 이동합니다.</p>
    </>
  );
}

function RateTrendChart({ monthlyStats }: { monthlyStats: MonthlyStat[] }) {
  const chartData = useMemo(
    () => [...monthlyStats].reverse().map((stat) => ({
      month: stat.month,
      완료율: stat.completionRate ?? 0,
      배송률: stat.totalCount > 0 ? (stat.deliveredCount / stat.totalCount) * 100 : 0,
    })),
    [monthlyStats],
  );

  if (chartData.length === 0) return <EmptyChart message="완료·배송 데이터가 쌓이면 운영 상태를 보여드릴게요." />;

  return (
    <div className="h-64 min-w-0" role="img" aria-label="월별 완료율과 배송률 추이 차트">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} width={38} />
          <Tooltip content={<RateTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="완료율" stroke={CHART_COLORS.completion} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="배송률" stroke={CHART_COLORS.delivery} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupRankingChart({
  title,
  rows,
}: {
  title: string;
  rows: GroupedDashboardStat[];
}) {
  const [metric, setMetric] = useState<"purchaseAmount" | "depositAmount" | "profitKrw">("purchaseAmount");
  const labels = { purchaseAmount: "구매금액", depositAmount: "입금금액", profitKrw: "수익" } as const;
  const chartData = rows.slice(0, 6).map((row) => ({ name: row.key, 값: row[metric] }));

  return (
    <ChartPanel title={`${title} 순위`} description="선택한 금액 기준 상위 6개를 비교합니다.">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className={`min-h-8 rounded-full px-2.5 text-[11px] font-medium transition-colors ${metric === key ? "bg-primary text-primary-foreground" : "bg-surface-soft text-ink-muted hover:text-foreground"}`}
          >
            {labels[key]}
          </button>
        ))}
      </div>
      {chartData.length === 0 ? (
        <EmptyChart message="분류 데이터가 없습니다." />
      ) : (
        <div className="h-64 min-w-0" role="img" aria-label={`${title} 금액 순위 차트`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="var(--hairline)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={formatAxisKrw} tick={{ fontSize: 10, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={74} tick={{ fontSize: 10, fill: "var(--ink-muted)" }} tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(0, 10)} />
              <Tooltip formatter={(value, name) => formatTooltipValue(value, name)} />
              <Bar dataKey="값" name={labels[metric]} fill={CHART_COLORS.purchase} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
}

export function DashboardCharts({
  monthlyStats,
  groupedStats,
}: {
  monthlyStats: MonthlyStat[];
  groupedStats: {
    byPlatform: GroupedDashboardStat[];
    byMethod: GroupedDashboardStat[];
    byAccount: GroupedDashboardStat[];
  };
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartPanel title="월별 금액 흐름" description="구매·입금·수익을 함께 보고 월별 상세로 이동할 수 있습니다.">
        <MonthTrendChart monthlyStats={monthlyStats} />
      </ChartPanel>
      <ChartPanel title="운영 상태 추이" description="완료율과 배송률의 흐름을 비교해 밀린 업무를 찾습니다.">
        <RateTrendChart monthlyStats={monthlyStats} />
      </ChartPanel>
      <GroupRankingChart title="플랫폼별" rows={groupedStats.byPlatform} />
      <GroupRankingChart title="구매계정별" rows={groupedStats.byAccount} />
    </div>
  );
}
