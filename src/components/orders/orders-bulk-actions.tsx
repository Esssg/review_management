"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckSquare2, Download, Loader2, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import type { MasterData } from "@/lib/master-data";
import {
  buildOrderCompletionValues,
  getDefaultOrderCompletionInput,
  type OrderCompletionInput,
} from "@/lib/order-completion";
import { cn } from "@/lib/utils";
import type { OrderWithRelations } from "@/types/orders";

export type BulkOrderPatch = {
  field:
    | "is_item_delivered"
    | "platform_id"
    | "payment_method_id"
    | "buyer_account_id"
    | "purchase_info_template_id";
  value: boolean | string | null;
  label: string;
};

export type BulkCompletionDraft = OrderCompletionInput & { orderId: string };

export type BulkOperationResult = {
  successIds: string[];
  failures: { id: string; label: string; message: string }[];
};

type BulkActionKind = "delivery" | "platform" | "payment" | "account" | "template";
type DialogStage = "edit" | "confirm" | "result";

const actionLabels: Record<BulkActionKind, string> = {
  delivery: "배송 상태",
  platform: "결제 플랫폼",
  payment: "결제 수단",
  account: "구매 계정",
  template: "구매 정보 템플릿",
};

function orderLabel(order: OrderWithRelations) {
  return order.title?.trim() || order.product_name;
}

function currentValueLabel(order: OrderWithRelations, action: BulkActionKind) {
  if (action === "delivery") return order.is_item_delivered ? "배송 완료" : "미배송";
  if (action === "platform") return order.platforms?.name ?? "미지정";
  if (action === "payment") return order.payment_methods?.name ?? "미지정";
  if (action === "account") return order.buyer_accounts?.label ?? "미지정";
  return order.purchase_info_templates?.title ?? "연결 안 함";
}

function DialogShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-dialog-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-hairline bg-card shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 id="bulk-dialog-title" className="text-base font-semibold sm:text-lg">{title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
          </div>
          <button
            type="button"
            aria-label="창 닫기"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </section>
    </div>
  );
}

function OperationResult({ result }: { result: BulkOperationResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
          <p className="text-xs">성공</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{result.successIds.length}건</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-950">
          <p className="text-xs">실패</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{result.failures.length}건</p>
        </div>
      </div>
      {result.failures.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <p className="text-sm font-semibold text-red-900">다시 처리할 주문</p>
          <ul className="mt-2 space-y-1 text-xs text-red-800">
            {result.failures.map((failure) => (
              <li key={failure.id}><span className="font-medium">{failure.label}</span> · {failure.message}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-700">실패한 주문만 선택 상태로 남겨 두었습니다.</p>
        </div>
      ) : null}
    </div>
  );
}

function BulkPatchDialog({
  orders,
  masterData,
  templates,
  onApply,
  onClose,
}: {
  orders: OrderWithRelations[];
  masterData: MasterData;
  templates: PurchaseTemplateRow[];
  onApply: (patch: BulkOrderPatch) => Promise<BulkOperationResult>;
  onClose: () => void;
}) {
  const [action, setAction] = useState<BulkActionKind>("delivery");
  const [target, setTarget] = useState("delivered");
  const [stage, setStage] = useState<DialogStage>("edit");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkOperationResult | null>(null);

  const options = useMemo(() => {
    if (action === "delivery") return [
      { value: "delivered", label: "배송 완료" },
      { value: "undelivered", label: "미배송" },
    ];
    if (action === "platform") return [
      { value: "__none__", label: "미지정" },
      ...masterData.platforms.map((item) => ({ value: item.id, label: item.name })),
    ];
    if (action === "payment") return [
      { value: "__none__", label: "미지정" },
      ...masterData.paymentMethods.map((item) => ({ value: item.id, label: item.name })),
    ];
    if (action === "account") return [
      { value: "__none__", label: "미지정" },
      ...masterData.buyerAccounts.map((item) => ({ value: item.id, label: item.label })),
    ];
    return [
      { value: "__none__", label: "연결 안 함" },
      ...templates.map((item) => ({ value: item.id, label: item.title })),
    ];
  }, [action, masterData, templates]);

  useEffect(() => {
    setTarget(action === "delivery" ? "delivered" : "__none__");
    setStage("edit");
  }, [action]);

  const targetLabel = options.find((option) => option.value === target)?.label ?? "미지정";
  const beforeLabels = [...new Set(orders.map((order) => currentValueLabel(order, action)))];

  const buildPatch = (): BulkOrderPatch => {
    if (action === "delivery") {
      return { field: "is_item_delivered", value: target === "delivered", label: targetLabel };
    }
    const field = action === "platform"
      ? "platform_id"
      : action === "payment"
        ? "payment_method_id"
        : action === "account"
          ? "buyer_account_id"
          : "purchase_info_template_id";
    return { field, value: target === "__none__" ? null : target, label: targetLabel };
  };

  const apply = async () => {
    setBusy(true);
    try {
      const next = await onApply(buildPatch());
      setResult(next);
      setStage("result");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title="선택 주문 일괄 변경" description={`${orders.length}건의 주문을 같은 값으로 변경합니다.`} onClose={onClose}>
      {stage === "result" && result ? (
        <>
          <OperationResult result={result} />
          <Button type="button" className="mt-4 w-full" onClick={onClose}>확인</Button>
        </>
      ) : stage === "confirm" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">{orders.length}건을 정말 변경할까요?</p>
            <p className="mt-1">{actionLabels[action]}: {beforeLabels.join(", ")} → <strong>{targetLabel}</strong></p>
          </div>
          <ul className="max-h-52 space-y-1 overflow-y-auto rounded-xl border p-3 text-sm">
            {orders.slice(0, 10).map((order) => <li key={order.id} className="truncate">{orderLabel(order)}</li>)}
            {orders.length > 10 ? <li className="text-muted-foreground">외 {orders.length - 10}건</li> : null}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStage("edit")}>이전</Button>
            <Button type="button" disabled={busy} onClick={() => void apply()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              최종 변경
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">변경 항목</span>
            <select value={action} onChange={(event) => setAction(event.target.value as BulkActionKind)} className="h-11 rounded-xl border border-input bg-background px-3">
              {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">변경할 값</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)} className="h-11 rounded-xl border border-input bg-background px-3">
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="rounded-xl border bg-surface-soft p-3 text-sm">
            <p className="text-xs text-muted-foreground">변경 전 → 변경 후</p>
            <p className="mt-1 font-medium">{beforeLabels.join(", ")} → {targetLabel}</p>
          </div>
          <Button type="button" className="w-full" onClick={() => setStage("confirm")}>변경 내용 확인</Button>
        </div>
      )}
    </DialogShell>
  );
}

function BulkCompleteDialog({
  selectedOrders,
  onApply,
  onClose,
}: {
  selectedOrders: OrderWithRelations[];
  onApply: (drafts: BulkCompletionDraft[]) => Promise<BulkOperationResult>;
  onClose: () => void;
}) {
  const pendingOrders = useMemo(() => selectedOrders.filter((order) => !order.is_processed), [selectedOrders]);
  const [drafts, setDrafts] = useState<Record<string, OrderCompletionInput>>(() => Object.fromEntries(
    pendingOrders.map((order) => [order.id, getDefaultOrderCompletionInput(order)]),
  ));
  const [stage, setStage] = useState<DialogStage>("edit");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<BulkOperationResult | null>(null);

  const checked = useMemo(() => pendingOrders.map((order) => ({
    order,
    outcome: buildOrderCompletionValues(order, drafts[order.id] ?? getDefaultOrderCompletionInput(order)),
  })), [drafts, pendingOrders]);
  const warningCount = checked.filter((item) => "warning" in item.outcome && item.outcome.warning).length;

  const updateDraft = (id: string, patch: Partial<OrderCompletionInput>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const review = () => {
    const invalid = checked.find((item) => "error" in item.outcome);
    if (invalid && "error" in invalid.outcome) {
      setErrorMessage(`${orderLabel(invalid.order)}: ${invalid.outcome.error}`);
      return;
    }
    setErrorMessage("");
    setStage("confirm");
  };

  const apply = async () => {
    setBusy(true);
    try {
      const next = await onApply(pendingOrders.map((order) => ({ orderId: order.id, ...drafts[order.id] })));
      setResult(next);
      setStage("result");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title="선택 주문 일괄 완료"
      description={`미완료 ${pendingOrders.length}건을 주문별 입금 정보로 처리합니다.${selectedOrders.length !== pendingOrders.length ? ` 완료 주문 ${selectedOrders.length - pendingOrders.length}건은 제외됩니다.` : ""}`}
      onClose={onClose}
    >
      {stage === "result" && result ? (
        <>
          <OperationResult result={result} />
          <Button type="button" className="mt-4 w-full" onClick={onClose}>확인</Button>
        </>
      ) : stage === "confirm" ? (
        <div className="space-y-4">
          <div className={cn("rounded-xl border p-3 text-sm", warningCount > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950")}>
            <p className="font-semibold">미완료 {pendingOrders.length}건을 완료 처리합니다.</p>
            <p className="mt-1">배송·입금액 확인이 필요한 주문 {warningCount}건</p>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3 text-sm">
            {checked.map(({ order, outcome }) => {
              if (!("values" in outcome) || !outcome.values) return null;
              const values = outcome.values;
              return (
                <li key={order.id} className="border-b border-hairline pb-2 last:border-0 last:pb-0">
                  <p className="truncate font-medium">{orderLabel(order)}</p>
                  <p className="text-xs text-muted-foreground">{values.deposit_date} · {Number(values.deposit_amount_krw).toLocaleString("ko-KR")}원</p>
                  {outcome.warning ? <p className="mt-1 text-xs text-amber-800">{outcome.warning}</p> : null}
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStage("edit")}>이전</Button>
            <Button type="button" disabled={busy || pendingOrders.length === 0} onClick={() => void apply()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              최종 완료처리
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {errorMessage ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}
          {pendingOrders.length === 0 ? (
            <p className="rounded-xl border bg-surface-soft p-4 text-sm text-muted-foreground">선택한 주문 중 미완료 주문이 없습니다.</p>
          ) : pendingOrders.map((order) => {
            const draft = drafts[order.id] ?? getDefaultOrderCompletionInput(order);
            const outcome = buildOrderCompletionValues(order, draft);
            return (
              <article key={order.id} className="rounded-xl border border-hairline p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{orderLabel(order)}</p>
                    <p className="truncate text-xs text-muted-foreground">{order.product_name}</p>
                  </div>
                  {"warning" in outcome && outcome.warning ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-label="확인 필요" /> : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs"><span>입금일</span><Input type="date" value={draft.date} onChange={(event) => updateDraft(order.id, { date: event.target.value })} className="h-10" /></label>
                  <label className="grid gap-1 text-xs"><span>입금금액</span><Input type="number" min={0} inputMode="numeric" value={draft.amount} onChange={(event) => updateDraft(order.id, { amount: event.target.value })} className="h-10 tabular-nums" /></label>
                  <label className="grid gap-1 text-xs sm:col-span-2"><span>입금메모</span><Input value={draft.memo} onChange={(event) => updateDraft(order.id, { memo: event.target.value })} className="h-10" /></label>
                </div>
              </article>
            );
          })}
          <Button type="button" className="w-full" disabled={pendingOrders.length === 0} onClick={review}>완료 내용 검토</Button>
        </div>
      )}
    </DialogShell>
  );
}

export function OrdersBulkActions({
  orders,
  visibleCount,
  allVisibleSelected,
  masterData,
  templates,
  isLoadingOptions,
  onToggleAllVisible,
  onPatch,
  onComplete,
  onExport,
  onClose,
}: {
  orders: OrderWithRelations[];
  visibleCount: number;
  allVisibleSelected: boolean;
  masterData: MasterData | null;
  templates: PurchaseTemplateRow[];
  isLoadingOptions: boolean;
  onToggleAllVisible: () => void;
  onPatch: (patch: BulkOrderPatch) => Promise<BulkOperationResult>;
  onComplete: (drafts: BulkCompletionDraft[]) => Promise<BulkOperationResult>;
  onExport: () => void;
  onClose: () => void;
}) {
  const [dialog, setDialog] = useState<"patch" | "complete" | null>(null);
  const pendingCount = orders.filter((order) => !order.is_processed).length;

  return (
    <>
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[70] mx-auto max-w-5xl rounded-2xl border border-slate-700 bg-slate-950 p-2 text-white shadow-2xl lg:bottom-4 lg:left-[calc(15rem+1rem)] lg:right-4">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <div className="flex min-w-[5rem] shrink-0 items-center gap-2 px-2">
            <CheckSquare2 className="h-4 w-4 text-sky-300" aria-hidden />
            <span className="text-sm font-semibold tabular-nums">{orders.length}건</span>
          </div>
          <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={onToggleAllVisible} disabled={visibleCount === 0}>
            {allVisibleSelected ? "전체 해제" : `화면 ${visibleCount}건 선택`}
          </Button>
          <Button type="button" size="sm" variant="secondary" className="shrink-0 gap-1.5" disabled={orders.length === 0 || isLoadingOptions || !masterData} onClick={() => setDialog("patch")}>
            {isLoadingOptions ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}
            일괄 변경
          </Button>
          <Button type="button" size="sm" className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700" disabled={pendingCount === 0} onClick={() => setDialog("complete")}>미완료 {pendingCount}건 완료</Button>
          <Button type="button" size="sm" variant="secondary" className="shrink-0 gap-1.5" disabled={orders.length === 0} onClick={onExport}>
            <Download className="h-3.5 w-3.5" aria-hidden /> 선택 엑셀
          </Button>
          <button type="button" aria-label="선택 모드 닫기" onClick={onClose} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {dialog === "patch" && masterData ? (
        <BulkPatchDialog orders={orders} masterData={masterData} templates={templates} onApply={onPatch} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "complete" ? (
        <BulkCompleteDialog selectedOrders={orders} onApply={onComplete} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
