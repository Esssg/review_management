"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ORDER_LIST_SELECT, type OrderWithRelations } from "@/types/orders";

const deletedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

const trashKrwFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

type TrashSWRKey = readonly ["orders", "trash", string];

async function fetchTrashOrders(key: TrashSWRKey): Promise<OrderWithRelations[]> {
  const [, , userId] = key;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_LIST_SELECT)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderWithRelations[];
}

export function OrderTrashPanel({
  userId,
  onCountChange,
}: {
  userId: string;
  onCountChange: (count: number) => void;
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const {
    data: ordersData,
    error: ordersError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<OrderWithRelations[]>(["orders", "trash", userId] satisfies TrashSWRKey, fetchTrashOrders, {
    revalidateOnFocus: false,
  });
  const orders = ordersData ?? [];
  const phase = ordersError ? "error" : isLoading ? "loading" : "ready";
  const isTrashLoading = isLoading || isValidating;

  const loadTrash = useCallback(async () => {
    setErrorMessage("");
    await mutate();
  }, [mutate]);

  useEffect(() => {
    // 휴지통 목록 렌더가 끝난 뒤 설정 메뉴의 개수 배지를 맞춰 React 상태 충돌을 피합니다.
    if (phase === "ready") onCountChange(orders.length);
  }, [onCountChange, orders.length, phase]);

  const restoreOrder = async (order: OrderWithRelations) => {
    setWorkingId(order.id);
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ deleted_at: null })
      .eq("id", order.id)
      .eq("user_id", userId)
      .not("deleted_at", "is", null);
    setWorkingId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    void mutate((current) => current?.filter((item) => item.id !== order.id) ?? [], { revalidate: false });
    setSuccessMessage("주문을 구매장부로 복원했습니다.");
    window.setTimeout(() => setSuccessMessage(""), 3500);
  };

  const permanentlyDeleteOrder = async (order: OrderWithRelations) => {
    const confirmed = window.confirm(
      `"${order.title?.trim() || order.product_name}" 주문을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;
    setWorkingId(order.id);
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id)
      .eq("user_id", userId)
      .not("deleted_at", "is", null);
    setWorkingId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    void mutate((current) => current?.filter((item) => item.id !== order.id) ?? [], { revalidate: false });
  };

  return (
    <section className="rounded-lg border border-hairline bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">최근 삭제 주문</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">최근 삭제한 주문을 최대 100건까지 보여줍니다. 복원하면 구매장부에 다시 나타납니다.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" disabled={isTrashLoading} onClick={() => void loadTrash()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isTrashLoading ? "animate-spin" : ""}`} aria-hidden />
          새로고침
        </Button>
      </div>

      {errorMessage || ordersError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage || ordersError?.message || "휴지통을 불러오지 못했습니다."}</p> : null}
      {successMessage ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{successMessage}</p> : null}

      {phase === "loading" ? (
        <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />휴지통을 불러오는 중입니다.</div>
      ) : orders.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">휴지통이 비어 있습니다.</div>
      ) : (
        <div className="mt-4 grid gap-2">
          {orders.map((order) => (
            <article key={order.id} className="grid gap-3 rounded-xl border border-hairline p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{order.title?.trim() || order.product_name}</p>
                  <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-muted-foreground">{order.is_processed ? "완료" : "미완료"}</span>
                </div>
                {order.title?.trim() ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.product_name}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  구매 {order.purchase_date} · {trashKrwFormatter.format(Number(order.purchase_price_krw))} · 삭제 {order.deleted_at ? deletedAtFormatter.format(new Date(order.deleted_at)) : "-"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:flex">
                <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={workingId === order.id} onClick={() => void restoreOrder(order)}>
                  {workingId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                  복원
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50" disabled={workingId === order.id} onClick={() => void permanentlyDeleteOrder(order)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  영구 삭제
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
