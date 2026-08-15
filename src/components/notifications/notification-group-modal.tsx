"use client";

import { CalendarClock, ChevronRight, Package, X } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AppNotificationRow, NotificationOrder } from "@/lib/notifications";

export type NotificationGroupModalData = {
  groupId: string;
  rows: AppNotificationRow[];
  orders: NotificationOrder[];
};

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatScheduledAt(value: string | null) {
  if (!value) return "구매 예정 시각 미지정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationGroupModal({
  group,
  onClose,
}: {
  group: NotificationGroupModalData | null;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!group) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-group-title"
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-hairline bg-card shadow-2xl sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              묶음 알림
            </p>
            <h2 id="notification-group-title" className="mt-1 text-base font-semibold sm:text-lg">
              구매 예정 주문 {group.orders.length}건
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {group.rows[0]?.body ?? "같은 구매 예정 시각의 주문입니다."}
            </p>
          </div>
          <button
            type="button"
            aria-label="묶음 알림 닫기"
            title="닫기"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
          {group.orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted-foreground">
              연결된 주문이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {group.orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    onClose();
                    router.push(`/orders/detail?id=${encodeURIComponent(order.id)}`);
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: order.platforms?.color || "#64748b" }}
                  >
                    <Package className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{order.platforms?.name ?? "플랫폼 미지정"}</span>
                      {order.buyer_accounts?.label ? <span>· {order.buyer_accounts.label}</span> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                      {order.title?.trim() || order.product_name}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{order.product_name}</span>
                      <span>{formatScheduledAt(order.scheduled_purchase_at)}</span>
                      <span>{formatCurrency(Number(order.purchase_price_krw))}</span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
