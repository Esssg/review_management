"use client";

import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Banknote,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  CreditCard,
  Filter,
  Images,
  ListChecks,
  Loader2,
  Package,
  PackageCheck,
  PencilLine,
  RotateCcw,
  Rows3,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  Type,
  UserCircle,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OrdersBulkActions,
  type BulkCompletionDraft,
  type BulkOperationResult,
  type BulkOrderPatch,
} from "@/components/orders/orders-bulk-actions";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { hexToRgba, normalizeHexColor } from "@/lib/color";
import { exportDashboardExcel } from "@/lib/export-dashboard-excel";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { fetchMasterData, type MasterData } from "@/lib/master-data";
import { getKoreaDateInputValue } from "@/lib/korea-date";
import {
  buildOrderCompletionValues,
  calculateOrderProfit,
  getDefaultOrderCompletionInput,
  getOrderCompletionWarning,
  parseOrderCompletionAmount,
  type OrderCompletionInput,
} from "@/lib/order-completion";
import { matchesPurchaseSchedule, type PurchaseScheduleFilter } from "@/lib/order-workflow";
import { getOrCreateUserPreferences, type LedgerDensity } from "@/lib/user-preferences";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { Database, Json } from "@/types/database";
import { ORDER_LIST_SELECT, type OrderWithRelations } from "@/types/orders";

const krwCurrencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const koreaDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

const koreaScheduleFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});
const EMPTY_ORDER_ROWS: OrderWithRelations[] = [];

function formatKrw(amount: number | string | null) {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return krwCurrencyFormatter.format(n);
}

function completeLedgerOrder(
  supabase: ReturnType<typeof createClient>,
  row: OrderWithRelations,
  date: string,
  amount: number,
  memo: string,
) {
  const profit = calculateOrderProfit(amount, Number(row.purchase_price_krw));
  return supabase
    .from("orders")
    .update({
      is_processed: true,
      deposit_date: date,
      deposit_amount_krw: amount,
      deposit_memo: memo.trim() || null,
      profit_krw: profit,
    })
    .eq("id", row.id)
    .is("deleted_at", null)
    .select(ORDER_LIST_SELECT)
    .single();
}

function uncompleteLedgerOrder(supabase: ReturnType<typeof createClient>, row: OrderWithRelations) {
  return supabase
    .from("orders")
    .update({
      is_processed: false,
      deposit_date: null,
      deposit_amount_krw: null,
      deposit_memo: null,
      profit_krw: null,
    })
    .eq("id", row.id)
    .is("deleted_at", null)
    .select(ORDER_LIST_SELECT)
    .single();
}

function formatDate(isoDate: string | null) {
  if (!isoDate) return "—";
  return koreaDateFormatter.format(new Date(isoDate + "T00:00:00"));
}

export type OrderListCounts = {
  total: number | null;
  pending: number | null;
  completed: number | null;
};

function addDaysToDateInput(value: string, days: number) {
  const base = value.trim() || getKoreaDateInputValue();
  const [year, month, day] = base.split("-").map(Number);
  if (!year || !month || !day) return getKoreaDateInputValue();
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function adjustDepositAmountInput(value: string, fallbackAmount: number | string, delta: number) {
  const current = parseOrderCompletionAmount(value) ?? (Number(fallbackAmount) || 0);
  return String(Math.max(0, current + delta));
}

type OrderCompletionFormOptions = {
  row: OrderWithRelations;
  supabase: ReturnType<typeof createClient>;
  resetOn: boolean;
  onPatched: (order: OrderWithRelations) => void;
  onCompleted?: () => void;
};

/** 모바일·데스크톱 완료 입력이 같은 기본값·경고·저장 규칙을 사용하도록 관리합니다. */
function useOrderCompletionForm({
  row,
  supabase,
  resetOn,
  onPatched,
  onCompleted,
}: OrderCompletionFormOptions) {
  const [input, setInput] = useState<OrderCompletionInput>(() =>
    resetOn ? getDefaultOrderCompletionInput(row) : { date: "", amount: "", memo: "" },
  );
  const pendingSubmitRef = useRef<{ date: string; amount: number } | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!resetOn) return;
    setInput(getDefaultOrderCompletionInput(row));
    pendingSubmitRef.current = null;
    setConfirmMessage(null);
  }, [resetOn, row]);

  const setDepositDate = useCallback((value: string | ((current: string) => string)) => {
    setInput((current) => ({
      ...current,
      date: typeof value === "function" ? value(current.date) : value,
    }));
  }, []);

  const setDepositAmount = useCallback((value: string | ((current: string) => string)) => {
    setInput((current) => ({
      ...current,
      amount: typeof value === "function" ? value(current.amount) : value,
    }));
  }, []);

  const setDepositMemo = useCallback((value: string | ((current: string) => string)) => {
    setInput((current) => ({
      ...current,
      memo: typeof value === "function" ? value(current.memo) : value,
    }));
  }, []);

  const completeOrder = useCallback(async (date: string, amount: number) => {
    setBusy(true);
    try {
      const { data, error } = await completeLedgerOrder(supabase, row, date, amount, input.memo);
      if (error) {
        window.alert(error.message);
        return;
      }
      pendingSubmitRef.current = null;
      setConfirmMessage(null);
      onPatched(data as OrderWithRelations);
      onCompleted?.();
    } finally {
      setBusy(false);
    }
  }, [input.memo, onCompleted, onPatched, row, supabase]);

  const submit = useCallback(async () => {
    const depositDate = input.date.trim();
    if (!depositDate) {
      window.alert("완료처리를 하려면 입금일자 칸을 입력해야 됩니다.");
      return;
    }
    const depositAmount = parseOrderCompletionAmount(input.amount);
    if (depositAmount === null) {
      window.alert("완료처리를 하려면 실입금금액 칸을 입력해야 됩니다.");
      return;
    }
    const warning = getOrderCompletionWarning(row, depositAmount);
    if (warning) {
      pendingSubmitRef.current = { date: depositDate, amount: depositAmount };
      setConfirmMessage(warning);
      return;
    }
    await completeOrder(depositDate, depositAmount);
  }, [completeOrder, input.amount, input.date, row]);

  const confirmSubmit = useCallback(() => {
    const pending = pendingSubmitRef.current;
    if (!pending) return;
    void completeOrder(pending.date, pending.amount);
  }, [completeOrder]);

  const cancelConfirm = useCallback(() => {
    pendingSubmitRef.current = null;
    setConfirmMessage(null);
  }, []);

  return {
    depositDate: input.date,
    depositAmount: input.amount,
    depositMemo: input.memo,
    setDepositDate,
    setDepositAmount,
    setDepositMemo,
    confirmMessage,
    busy,
    submit,
    confirmSubmit,
    cancelConfirm,
  };
}

type UncompleteOrderOptions = {
  row: OrderWithRelations;
  supabase: ReturnType<typeof createClient>;
  onPatched: (order: OrderWithRelations) => void;
  onCompleted?: () => void;
};

/** 완료 취소도 모바일·데스크톱에서 같은 확인·오류·대기 상태를 사용하도록 관리합니다. */
function useUncompleteOrder({
  row,
  supabase,
  onPatched,
  onCompleted,
}: UncompleteOrderOptions) {
  const [busy, setBusy] = useState(false);

  const handleUncomplete = useCallback(async () => {
    const ok = window.confirm(
      "이 주문을 미완료로 되돌릴까요? 입금일·입금금액·입금 메모는 비워집니다.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data, error } = await uncompleteLedgerOrder(supabase, row);
      if (error) {
        window.alert(error.message);
        return;
      }
      onPatched(data as OrderWithRelations);
      onCompleted?.();
    } finally {
      setBusy(false);
    }
  }, [onCompleted, onPatched, row, supabase]);

  return { busy, handleUncomplete };
}

/** 완료처리 전 금액과 배송 여부가 어긋나는 경우 운영자가 한 번 더 확인한다. */
function DepositMismatchConfirmDialog({
  message,
  busy,
  onCancel,
  onConfirm,
}: {
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (!busy) onConfirm();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        if (busy) return;
        onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-mismatch-title"
        aria-describedby="deposit-mismatch-message"
        className="w-full max-w-[23rem] rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl ring-1 ring-black/5 dark:border-amber-500/30 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 id="deposit-mismatch-title" className="text-base font-semibold text-slate-950 dark:text-slate-50">
              완료처리 확인
            </h3>
            <p
              id="deposit-mismatch-message"
              className="whitespace-normal break-keep text-sm leading-6 text-slate-700 dark:text-slate-200"
            >
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={onCancel}>
            취소하기
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            무시하고 처리하기
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 날짜와 금액 보정 버튼은 모바일 터치 환경에서도 누르기 쉬운 크기로 맞춘다. */
function DepositDateStepButtons({ onStep }: { onStep: (days: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="h-7 touch-manipulation px-2 text-[11px]"
        aria-label="입금일자 하루 빼기"
        onClick={(e) => {
          e.stopPropagation();
          onStep(-1);
        }}
      >
        -1일
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="h-7 touch-manipulation px-2 text-[11px]"
        aria-label="입금일자 하루 더하기"
        onClick={(e) => {
          e.stopPropagation();
          onStep(1);
        }}
      >
        +1일
      </Button>
    </div>
  );
}

function DepositAmountStepButtons({ onStep }: { onStep: (amount: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="h-7 touch-manipulation px-2 text-[11px]"
        aria-label="입금금액 500원 빼기"
        onClick={(e) => {
          e.stopPropagation();
          onStep(-500);
        }}
      >
        -500원
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="h-7 touch-manipulation px-2 text-[11px]"
        aria-label="입금금액 500원 더하기"
        onClick={(e) => {
          e.stopPropagation();
          onStep(500);
        }}
      >
        +500원
      </Button>
    </div>
  );
}

const DEFAULT_PLATFORM_COLOR = "#64748b";
const DEFAULT_PAYMENT_METHOD_COLOR = "#7c3aed";
const DEFAULT_BUYER_ACCOUNT_COLOR = "#64748b";

function getChipTone(color: string) {
  const base = normalizeHexColor(color, DEFAULT_PLATFORM_COLOR);
  return {
    base,
    style: {
      color: base,
      borderColor: hexToRgba(base, 0.35),
      backgroundColor: hexToRgba(base, 0.14),
    },
  };
}

function PlatformBadge({ platform }: { platform: { name: string; color: string } | null }) {
  const label = platform?.name?.trim() || "기타";
  const tone = getChipTone(platform?.color ?? DEFAULT_PLATFORM_COLOR);
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium" style={tone.style}>
      {label}
    </span>
  );
}

function getPaymentMethodDisplay(name: string | null | undefined): { Icon: LucideIcon; label: string } {
  const n = (name ?? "").trim();
  if (!n) return { Icon: Wallet, label: "미지정" };
  const lower = n.toLowerCase();
  if (lower.includes("현금") || lower.includes("cash")) return { Icon: Banknote, label: n };
  if (lower.includes("카드") || lower.includes("card")) return { Icon: CreditCard, label: n };
  if (lower.includes("페이") || lower.includes("pay")) return { Icon: Wallet, label: n };
  return { Icon: Wallet, label: n };
}

const ORDER_DETAIL_CHIP_CLASS =
  "inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

const ORDER_DETAIL_CHIP_CLASS_TABLE =
  "inline-flex min-h-7 min-w-0 max-w-full items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-xs dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200";

function TemplateKakaoCopyChip({
  template,
  orderNumber,
  purchasePriceKrw,
  chipClass,
  iconClass,
  preferWrapLabels = false,
}: {
  template: PurchaseTemplateRow;
  orderNumber: string | null;
  purchasePriceKrw: number | string;
  chipClass: string;
  iconClass: string;
  preferWrapLabels?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const line = buildKakaoPasteLine(template, orderNumber?.trim() ?? "", String(purchasePriceKrw ?? ""));
    try {
      await copyTextToClipboard(line);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "복사됨" : `${template.title} — 탭하면 카톡용 한 줄이 복사됩니다`}
      className={cn(
        chipClass,
        preferWrapLabels && "max-w-full flex-wrap",
        "cursor-pointer touch-manipulation text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/80",
      )}
    >
      <Clipboard className={cn(iconClass, "shrink-0 text-sky-600 dark:text-sky-400")} aria-hidden />
      <span
        className={cn(
          "min-w-0",
          preferWrapLabels
            ? "max-w-full whitespace-normal break-words"
            : "max-w-[7rem] truncate sm:max-w-[10rem]",
        )}
      >
        {copied ? "복사됨" : template.title}
      </span>
    </button>
  );
}

function AiReviewCopyChip({
  text,
  chipClass,
  iconClass,
  preferWrapLabels = false,
}: {
  text: string;
  chipClass: string;
  iconClass: string;
  preferWrapLabels?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await copyTextToClipboard(text.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("복사에 실패했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "복사됨" : "탭하면 AI 리뷰 전체가 복사됩니다"}
      aria-label={copied ? "복사됨" : "AI 리뷰 클립보드에 복사"}
      className={cn(
        chipClass,
        preferWrapLabels && "max-w-full flex-wrap",
        "cursor-pointer touch-manipulation text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/80",
      )}
    >
      <Bot className={cn(iconClass, "shrink-0 text-violet-600 dark:text-violet-400")} aria-hidden />
      <span className={cn("min-w-0", preferWrapLabels ? "whitespace-normal break-words" : "truncate")}>
        {copied ? "복사됨" : "AI 리뷰"}
      </span>
    </button>
  );
}

function OrderDetailChips({
  row,
  density = "default",
  preferWrapLabels = false,
}: {
  row: OrderWithRelations;
  density?: "default" | "table";
  /** 좁은 영역(예: 미완료 스와이프 요약)에서 칩·텍스트가 가로를 넘기면 줄바꿈 */
  preferWrapLabels?: boolean;
}) {
  const chipClass = density === "table" ? ORDER_DETAIL_CHIP_CLASS_TABLE : ORDER_DETAIL_CHIP_CLASS;
  const chipClassMaybeWrap = cn(chipClass, preferWrapLabels && "max-w-full flex-wrap");
  const iconClass = density === "table" ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0";
  const chipText = preferWrapLabels
    ? "min-w-0 whitespace-normal break-words text-left"
    : "truncate";
  const paymentName = row.payment_methods?.name?.trim();
  const payDisplay = paymentName ? getPaymentMethodDisplay(paymentName) : null;
  const PayIcon = payDisplay?.Icon;
  const accountLabel = row.buyer_accounts?.label?.trim();
  const paymentColor = normalizeHexColor(row.payment_methods?.color, DEFAULT_PAYMENT_METHOD_COLOR);
  const accountColor = normalizeHexColor(row.buyer_accounts?.color, DEFAULT_BUYER_ACCOUNT_COLOR);
  const photos = row.review_photo_count;
  const chars = row.review_char_count;
  const showPhotos = photos !== null && photos !== undefined;
  const showChars = chars !== null && chars !== undefined;
  const linkedTemplate = row.purchase_info_templates;
  // 예약 구매는 목록을 훑을 때 바로 놓치지 않도록 상태 칩으로 함께 노출한다.
  const scheduledPurchase = row.scheduled_purchase_at
    ? new Date(row.scheduled_purchase_at)
    : null;
  const hasValidSchedule = scheduledPurchase && !Number.isNaN(scheduledPurchase.getTime());

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:gap-2",
        preferWrapLabels && "gap-1.5",
      )}
    >
      <span className={chipClassMaybeWrap} title="실 배송 여부">
        {row.is_item_delivered ? (
          <PackageCheck className={cn(iconClass, "text-blue-600 dark:text-blue-400")} aria-hidden />
        ) : (
          <Package className={cn(iconClass, "text-slate-400 dark:text-slate-500")} aria-hidden />
        )}
        <span className={cn(chipText)}>{row.is_item_delivered ? "배송 있음" : "배송 없음"}</span>
      </span>
      {payDisplay && PayIcon ? (
        <span className={chipClassMaybeWrap} title="결제 방식">
          <PayIcon className={iconClass} style={{ color: paymentColor }} aria-hidden />
          <span className={cn(chipText)}>{payDisplay.label}</span>
        </span>
      ) : null}
      {accountLabel ? (
        <span className={chipClassMaybeWrap} title="구매 계정">
          <UserCircle className={iconClass} style={{ color: accountColor }} aria-hidden />
          <span
            className={cn(
              "min-w-0 font-medium",
              preferWrapLabels ? "whitespace-normal break-words" : "max-w-[6rem] truncate sm:max-w-[9rem]",
            )}
            style={{ color: accountColor }}
          >
            {accountLabel}
          </span>
        </span>
      ) : null}
      {hasValidSchedule ? (
        <span
          className={cn(
            chipClassMaybeWrap,
            "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
          )}
          title="구매 예정 시각"
        >
          <CalendarClock className={iconClass} aria-hidden />
          <span className={cn(chipText)}>
            예정 · {koreaScheduleFormatter.format(scheduledPurchase)}
          </span>
        </span>
      ) : null}
      {showPhotos ? (
        <span className={chipClassMaybeWrap} title="리뷰 사진">
          <Images className={cn(iconClass, "text-emerald-600 dark:text-emerald-400")} aria-hidden />
          <span className="tabular-nums">{photos}장</span>
        </span>
      ) : null}
      {showChars ? (
        <span className={chipClassMaybeWrap} title="리뷰 글자 수">
          <Type className={cn(iconClass, "text-amber-600 dark:text-amber-400")} aria-hidden />
          <span className="tabular-nums">{chars}글자</span>
        </span>
      ) : null}
      {row.ai_review?.trim() ? (
        <AiReviewCopyChip
          text={row.ai_review}
          chipClass={chipClass}
          iconClass={iconClass}
          preferWrapLabels={preferWrapLabels}
        />
      ) : null}
      {linkedTemplate ? (
        <TemplateKakaoCopyChip
          template={linkedTemplate}
          orderNumber={row.order_number}
          purchasePriceKrw={row.purchase_price_krw}
          chipClass={chipClass}
          iconClass={iconClass}
          preferWrapLabels={preferWrapLabels}
        />
      ) : null}
    </div>
  );
}

/** 미완료 카드 펼침: 1페이지(칩+주문상세보기)가 왼쪽으로 밀리며 2페이지(입금 입력·완료) 표시. */
function MobilePendingDepositSwipePanel({
  row,
  onEditOrder,
  supabase,
  onPatched,
}: {
  row: OrderWithRelations;
  onEditOrder: () => void;
  supabase: ReturnType<typeof createClient>;
  onPatched: (o: OrderWithRelations) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panel0Ref = useRef<HTMLDivElement>(null);
  const panel1Ref = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [panelHeights, setPanelHeights] = useState({ h0: 96, h1: 280 });
  const {
    depositDate,
    depositAmount,
    depositMemo,
    setDepositDate,
    setDepositAmount,
    setDepositMemo,
    confirmMessage,
    busy,
    submit,
    confirmSubmit,
    cancelConfirm,
  } = useOrderCompletionForm({
    row,
    supabase,
    resetOn: true,
    onPatched,
  });

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    scroll.scrollLeft = 0;
  }, [row.id]);

  useLayoutEffect(() => {
    const p0 = panel0Ref.current;
    const p1 = panel1Ref.current;
    if (!p0 || !p1) return;
    const measure = () => {
      setPanelHeights({
        h0: Math.max(1, Math.ceil(p0.getBoundingClientRect().height)),
        h1: Math.max(1, Math.ceil(p1.getBoundingClientRect().height)),
      });
    };
    measure();
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(measure);
    });
    ro.observe(p0);
    ro.observe(p1);
    return () => ro.disconnect();
  }, [row.id]);

  const innerH = Math.max(panelHeights.h0, panelHeights.h1);
  const outerH = activePage === 0 ? panelHeights.h0 : panelHeights.h1;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w < 8) return;
    const next = el.scrollLeft >= w * 0.42 ? 1 : 0;
    setActivePage((p) => (p !== next ? next : p));
  };

  const memoClass =
    "min-h-[4rem] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="mt-0">
      {confirmMessage ? (
        <DepositMismatchConfirmDialog
          message={confirmMessage}
          busy={busy}
          onCancel={cancelConfirm}
          onConfirm={confirmSubmit}
        />
      ) : null}
      <div className="mb-2 grid grid-cols-2 gap-2 px-0.5" aria-hidden>
        <span
          className={cn(
            "h-1 rounded-full transition-colors duration-200",
            activePage === 0
              ? "bg-slate-800 dark:bg-slate-100"
              : "bg-slate-300/90 dark:bg-slate-600",
          )}
        />
        <span
          className={cn(
            "h-1 rounded-full transition-colors duration-200",
            activePage === 1
              ? "bg-slate-800 dark:bg-slate-100"
              : "bg-slate-300/90 dark:bg-slate-600",
          )}
        />
      </div>
      <div
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white/80 transition-[height] duration-200 ease-out will-change-[height] dark:border-slate-600 dark:bg-slate-800/60"
        style={{ height: outerH }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth touch-pan-x items-start"
          style={{ height: innerH }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={panel0Ref}
            className="box-border flex min-w-full max-w-full shrink-0 snap-center snap-always flex-col gap-2.5 self-start px-1 py-2"
          >
            <div className="min-w-0 w-full">
              <OrderDetailChips row={row} density="default" preferWrapLabels />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2 touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                onEditOrder();
              }}
            >
              <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              주문상세보기
            </Button>
          </div>
          <div
            ref={panel1Ref}
            className="min-w-full shrink-0 snap-center snap-always space-y-2 self-start border-l border-slate-200/80 px-2 py-2.5 dark:border-slate-600"
          >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">입금일자</Label>
              <DepositDateStepButtons onStep={(days) => setDepositDate((value) => addDaysToDateInput(value, days))} />
            </div>
            <Input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-muted-foreground">입금금액 (원)</Label>
              <DepositAmountStepButtons
                onStep={(amount) =>
                  setDepositAmount((value) => adjustDepositAmountInput(value, row.purchase_price_krw, amount))
                }
              />
            </div>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="h-9 tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">입금메모</Label>
            <textarea
              value={depositMemo}
              onChange={(e) => setDepositMemo(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              rows={3}
              className={memoClass}
              placeholder="입금 확인 메모"
            />
          </div>
          <Button
            type="button"
            className="w-full touch-manipulation bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              void submit();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            완료처리하기
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}

function WebPendingCompleteDropdown({
  row,
  isOpen,
  onClose,
  onToggle,
  supabase,
  onPatched,
}: {
  row: OrderWithRelations;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  supabase: ReturnType<typeof createClient>;
  onPatched: (o: OrderWithRelations) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    depositDate,
    depositAmount,
    depositMemo,
    setDepositDate,
    setDepositAmount,
    setDepositMemo,
    confirmMessage,
    busy,
    submit,
    confirmSubmit,
    cancelConfirm,
  } = useOrderCompletionForm({
    row,
    supabase,
    resetOn: isOpen,
    onPatched,
    onCompleted: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen, onClose]);

  const memoClass =
    "min-h-[4.5rem] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div ref={wrapRef} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      {confirmMessage ? (
        <DepositMismatchConfirmDialog
          message={confirmMessage}
          busy={busy}
          onCancel={cancelConfirm}
          onConfirm={confirmSubmit}
        />
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1 border-emerald-200 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        완료처리하기
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} aria-hidden />
      </Button>
      {isOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-2rem,18.5rem)] space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          role="dialog"
          aria-label="입금 완료 처리"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">입금일자</Label>
              <DepositDateStepButtons onStep={(days) => setDepositDate((value) => addDaysToDateInput(value, days))} />
            </div>
            <Input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">입금금액 (원)</Label>
              <DepositAmountStepButtons
                onStep={(amount) =>
                  setDepositAmount((value) => adjustDepositAmountInput(value, row.purchase_price_krw, amount))
                }
              />
            </div>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="h-9 tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">입금메모</Label>
            <textarea value={depositMemo} onChange={(e) => setDepositMemo(e.target.value)} rows={3} className={memoClass} />
          </div>
          <Button
            type="button"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            완료처리하기
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function WebCompletedActionsDropdown({
  row,
  isOpen,
  onClose,
  onToggle,
  onEditOrder,
  supabase,
  onPatched,
}: {
  row: OrderWithRelations;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  onEditOrder: () => void;
  supabase: ReturnType<typeof createClient>;
  onPatched: (o: OrderWithRelations) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { busy, handleUncomplete } = useUncompleteOrder({
    row,
    supabase,
    onPatched,
    onCompleted: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen, onClose]);

  return (
    <div ref={wrapRef} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        관리
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} aria-hidden />
      </Button>
      {isOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 flex min-w-[11rem] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          role="menu"
        >
          <Button type="button" variant="ghost" size="sm" className="justify-start gap-2" onClick={() => onEditOrder()}>
            <PencilLine className="h-3.5 w-3.5" aria-hidden />
            주문수정하기
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-500/15"
            disabled={busy}
            onClick={() => void handleUncomplete()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            미완료처리하기
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const OrderExpandPanel = memo(function OrderExpandPanel({
  row,
  onEditOrder,
  onDuplicateOrder,
  supabase,
  onPatchOrder,
}: {
  row: OrderWithRelations;
  onEditOrder: () => void;
  onDuplicateOrder: () => void;
  supabase: ReturnType<typeof createClient>;
  onPatchOrder: (previous: OrderWithRelations, updated: OrderWithRelations) => void;
}) {
  const handlePatchOrder = useCallback((updated: OrderWithRelations) => {
    onPatchOrder(row, updated);
  }, [onPatchOrder, row]);

  const { busy: uncompleteBusy, handleUncomplete } = useUncompleteOrder({
    row,
    supabase,
    onPatched: handlePatchOrder,
  });

  return (
    <div className="border-t border-slate-100 bg-slate-50/90 px-3 pb-3 pt-2.5 dark:border-slate-700 dark:bg-slate-900/35">
      {!row.is_processed ? (
        <MobilePendingDepositSwipePanel
          row={row}
          onEditOrder={onEditOrder}
          supabase={supabase}
          onPatched={handlePatchOrder}
        />
      ) : (
        <>
          <OrderDetailChips row={row} density="default" />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 sm:w-auto" onClick={onEditOrder}>
            <PencilLine className="h-3.5 w-3.5" aria-hidden />
            주문수정하기
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5 border-amber-200 text-amber-900 hover:bg-amber-50 sm:w-auto dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-500/15"
            disabled={uncompleteBusy}
            onClick={() => void handleUncomplete()}
          >
            {uncompleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            미완료처리하기
          </Button>
        </div>
        </>
      )}
      <Button type="button" variant="ghost" size="sm" className="mt-2 w-full gap-1.5" onClick={onDuplicateOrder}>
        <Copy className="h-3.5 w-3.5" aria-hidden />
        새 주문으로 복제
      </Button>
    </div>
  );
});

const OrderCardItem = memo(function OrderCardItem({
  row,
  isDeleting,
  isSwiped,
  isExpanded,
  selectionMode,
  isSelected,
  onToggleExpand,
  onToggleSelection,
  onEditOrder,
  onDuplicateOrder,
  onDelete,
  onSwipeLeft,
  onSwipeCancel,
  supabase,
  onPatchOrder,
}: {
  row: OrderWithRelations;
  isDeleting: boolean;
  isSwiped: boolean;
  isExpanded: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleExpand: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onEditOrder: (id: string) => void;
  onDuplicateOrder: (id: string) => void;
  onDelete: (row: OrderWithRelations) => void;
  onSwipeLeft: (id: string) => void;
  onSwipeCancel: () => void;
  supabase: ReturnType<typeof createClient>;
  onPatchOrder: (previous: OrderWithRelations, updated: OrderWithRelations) => void;
}) {
  const touchStartXRef = useRef(0);
  const platformName = row.platforms?.name ?? "";
  const platformTone = getChipTone(row.platforms?.color ?? DEFAULT_PLATFORM_COLOR);
  const hasProfit = row.profit_krw !== null && Number(row.profit_krw) !== 0;
  const handleEditOrder = useCallback(() => onEditOrder(row.id), [onEditOrder, row.id]);
  const handleDuplicateOrder = useCallback(() => onDuplicateOrder(row.id), [onDuplicateOrder, row.id]);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:bg-slate-800",
      isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-transparent",
    )}>
      {/* 스와이프 삭제 영역 */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 transition-all duration-200",
          !selectionMode && isSwiped ? "w-20" : "w-0",
        )}
      >
        {!selectionMode && isSwiped && (
          <button
            type="button"
            aria-label="삭제"
            disabled={isDeleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row);
            }}
            className="flex flex-col items-center gap-0.5 text-white"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-[10px]">삭제</span>
          </button>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex items-center gap-3 p-3.5 cursor-pointer select-none transition-all duration-200",
          "active:bg-slate-50 dark:active:bg-slate-700/50",
          !selectionMode && isSwiped && "-translate-x-20",
        )}
        onClick={() => {
          if (selectionMode) { onToggleSelection(row.id); return; }
          if (isSwiped) { onSwipeCancel(); return; }
          onToggleExpand(row.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (selectionMode) onToggleSelection(row.id);
            else onToggleExpand(row.id);
          }
        }}
        aria-expanded={selectionMode ? undefined : isExpanded}
        aria-pressed={selectionMode ? isSelected : undefined}
        onTouchStart={(e) => { touchStartXRef.current = e.changedTouches[0]?.clientX ?? 0; }}
        onTouchEnd={(e) => {
          if (selectionMode) return;
          const endX = e.changedTouches[0]?.clientX ?? 0;
          const diff = touchStartXRef.current - endX;
          if (diff > 50) { onSwipeLeft(row.id); return; }
          if (diff < -35 && isSwiped) { onSwipeCancel(); }
        }}
      >
        {selectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(row.id)}
            onClick={(event) => event.stopPropagation()}
            className="h-5 w-5 shrink-0 accent-primary"
            aria-label={`${row.product_name} 선택`}
          />
        ) : null}
        {/* 플랫폼 아이콘 */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold",
          )}
          style={platformTone.style}
        >
          {(platformName ?? "?").charAt(0).toUpperCase()}
        </div>

        {/* 주문 정보 */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {row.title?.trim() ? (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{row.title}</p>
          ) : null}
          <p className="line-clamp-1 text-sm font-semibold">{row.product_name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <PlatformBadge platform={row.platforms} />
          </div>
        </div>

        {/* 금액 + 날짜 */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <p className="text-sm font-bold">{formatKrw(row.purchase_price_krw)}</p>
          {hasProfit ? (
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              +{formatKrw(row.profit_krw)}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">{formatDate(row.purchase_date)}</p>
          {isExpanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
          )}
        </div>
      </div>
      {!selectionMode && isExpanded ? (
        <OrderExpandPanel
          row={row}
          onEditOrder={handleEditOrder}
          onDuplicateOrder={handleDuplicateOrder}
          supabase={supabase}
          onPatchOrder={onPatchOrder}
        />
      ) : null}
    </div>
  );
});

type SearchableOrder = {
  order: OrderWithRelations;
  searchText: string;
};

type OrderStatusFilter = "all" | "pending" | "completed";
type OrderAttentionFilter =
  | "all"
  | "scheduleToday"
  | "overdue"
  | "scheduleUpcoming"
  | "missingDeposit"
  | "missingAi"
  | "missingTemplate";
type OrderDeliveryFilter = "all" | "yes" | "no";
type OrderQuickFilter = "all" | "pending" | "deliveryYes" | "deliveryNo" | Exclude<OrderAttentionFilter, "all">;
type OrderSort = "newest" | "oldest" | "amountDesc" | "amountAsc";
type SavedOrderView = Database["public"]["Tables"]["saved_order_views"]["Row"];

type OrderFilterSnapshot = {
  q: string;
  status: OrderStatusFilter;
  attention: OrderAttentionFilter;
  delivery: OrderDeliveryFilter;
  from: string;
  to: string;
  sort: OrderSort;
  platform: string;
  payment: string;
  account: string;
};

const orderStatusFilters: OrderStatusFilter[] = ["all", "pending", "completed"];
const orderAttentionFilters: OrderAttentionFilter[] = [
  "all",
  "scheduleToday",
  "overdue",
  "scheduleUpcoming",
  "missingDeposit",
  "missingAi",
  "missingTemplate",
];
const orderDeliveryFilters: OrderDeliveryFilter[] = ["all", "yes", "no"];
const orderSorts: OrderSort[] = ["newest", "oldest", "amountDesc", "amountAsc"];

function readSavedFilterSnapshot(value: Json): OrderFilterSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const readText = (key: keyof OrderFilterSnapshot) => typeof value[key] === "string" ? value[key] : "";
  const rawAttention = readText("attention");
  const isLegacyUndelivered = rawAttention === "undelivered";
  const status = readText("status") as OrderStatusFilter;
  const attention = (isLegacyUndelivered ? "all" : rawAttention) as OrderAttentionFilter;
  const rawDelivery = readText("delivery");
  const delivery = (rawDelivery || (isLegacyUndelivered ? "no" : "all")) as OrderDeliveryFilter;
  const sort = readText("sort") as OrderSort;
  if (!orderStatusFilters.includes(status) || !orderAttentionFilters.includes(attention) || !orderDeliveryFilters.includes(delivery) || !orderSorts.includes(sort)) {
    return null;
  }
  return {
    q: readText("q"),
    status,
    attention,
    delivery,
    from: readText("from"),
    to: readText("to"),
    sort,
    platform: readText("platform"),
    payment: readText("payment"),
    account: readText("account"),
  };
}

function buildOrderSearchText(order: OrderWithRelations) {
  return [
    order.title,
    order.product_name,
    order.notes,
    order.order_number,
    order.order_status,
    order.platforms?.name,
    order.payment_methods?.name,
    order.buyer_accounts?.label,
  ].filter(Boolean).join(" ").trim().toLocaleLowerCase("ko-KR");
}

function prepareSearchableOrders(orders: OrderWithRelations[]) {
  return orders.map((order) => ({ order, searchText: buildOrderSearchText(order) }));
}

function filterSearchableOrders(
  sourceOrders: SearchableOrder[],
  filters: OrderFilterSnapshot,
) {
  const query = filters.q.trim().toLocaleLowerCase("ko-KR");
  const now = Date.now();
  const visible = sourceOrders
    .filter(({ order, searchText }) => {
      if (filters.from && order.purchase_date < filters.from) return false;
      if (filters.to && order.purchase_date > filters.to) return false;
      if (filters.platform && order.platforms?.name !== filters.platform) return false;
      if (filters.payment && order.payment_methods?.name !== filters.payment) return false;
      if (filters.account && order.buyer_accounts?.label !== filters.account) return false;

      if (filters.delivery === "yes" && !order.is_item_delivered) return false;
      if (filters.delivery === "no" && order.is_item_delivered) return false;
      if (["scheduleToday", "overdue", "scheduleUpcoming"].includes(filters.attention)) {
        if (!matchesPurchaseSchedule(
          order.scheduled_purchase_at,
          filters.attention as PurchaseScheduleFilter,
          now,
        )) return false;
      }
      if (
        filters.attention === "missingDeposit"
        && (!order.is_processed || (order.deposit_date && order.deposit_amount_krw !== null))
      ) return false;
      if (filters.attention === "missingAi") {
        const hasReviewRequirement = Number(order.review_photo_count) > 0 || Number(order.review_char_count) > 0;
        if (!hasReviewRequirement || order.ai_review?.trim()) return false;
      }
      if (filters.attention === "missingTemplate" && order.purchase_info_template_id) return false;

      return query ? searchText.includes(query) : true;
    })
    .map(({ order }) => order);

  return visible.sort((a, b) => {
    if (filters.sort === "oldest") return a.purchase_date.localeCompare(b.purchase_date) || a.created_at.localeCompare(b.created_at);
    if (filters.sort === "amountDesc") return Number(b.purchase_price_krw) - Number(a.purchase_price_krw);
    if (filters.sort === "amountAsc") return Number(a.purchase_price_krw) - Number(b.purchase_price_krw);
    return b.purchase_date.localeCompare(a.purchase_date) || b.created_at.localeCompare(a.created_at);
  });
}

function findVirtualIndex(offsets: number[], value: number) {
  let low = 0;
  let high = Math.max(0, offsets.length - 1);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if ((offsets[mid] ?? 0) <= value) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(0, low - 2);
}

function useVirtualRange<T>(
  items: T[],
  estimateSize: (item: T) => number,
  overscan = 6,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  const offsets = useMemo(() => {
    const next = [0];
    for (const item of items) {
      next.push((next.at(-1) ?? 0) + Math.max(1, estimateSize(item)));
    }
    return next;
  }, [estimateSize, items]);

  const totalSize = offsets.at(-1) ?? 0;

  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = { scrollTop: el.scrollTop, height: el.clientHeight };
    setViewport((current) => (
      current.scrollTop === next.scrollTop && current.height === next.height ? current : next
    ));
  }, []);

  useLayoutEffect(() => {
    updateViewport();
  }, [estimateSize, items.length, totalSize, updateViewport]);

  const range = useMemo(() => {
    if (items.length === 0) return { start: 0, end: 0 };
    if (viewport.height <= 0) return { start: 0, end: Math.min(items.length, 24) };

    const start = Math.max(0, findVirtualIndex(offsets, viewport.scrollTop) - overscan);
    const end = Math.min(
      items.length,
      findVirtualIndex(offsets, viewport.scrollTop + viewport.height) + overscan + 2,
    );
    return { start, end };
  }, [items.length, offsets, overscan, viewport.height, viewport.scrollTop]);

  const virtualItems = useMemo(
    () => items.slice(range.start, range.end).map((item, index) => ({ item, index: range.start + index })),
    [items, range.end, range.start],
  );

  return {
    scrollRef,
    onScroll: updateViewport,
    virtualItems,
    topPadding: offsets[range.start] ?? 0,
    bottomPadding: Math.max(0, totalSize - (offsets[range.end] ?? totalSize)),
  };
}

function displayCount(value: number | null) {
  return value === null ? "…" : value.toLocaleString("ko-KR");
}

function OrderListLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2 py-1" aria-label={`${label} 불러오는 중`}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-[4.75rem] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/60" />
      ))}
    </div>
  );
}

function TableLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={colSpan} className="px-3 py-2">
            <div className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700/60" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

type CompletedOrdersSectionProps = {
  density: LedgerDensity;
  showCompletedOrders: boolean;
  onToggleCompletedOrders: () => void;
  completedOrders: OrderWithRelations[] | null;
  completedCount: number | null;
  visibleCompletedOrders: OrderWithRelations[];
  isCompletedLoading: boolean;
  isDesktop: boolean;
  completedScrollRef: RefObject<HTMLDivElement | null>;
  completedOnScroll: () => void;
  completedVirtualItems: Array<{ item: OrderWithRelations; index: number }>;
  completedTopPadding: number;
  completedBottomPadding: number;
  selectionMode: boolean;
  selectedOrderIds: Set<string>;
  deletingId: string | null;
  swipedRowId: string | null;
  expandedOrderId: string | null;
  completedActionsMenuId: string | null;
  toggleExpanded: (id: string) => void;
  toggleOrderSelection: (id: string) => void;
  goToOrderDetail: (id: string) => void;
  duplicateOrder: (id: string) => void;
  handleDelete: (row: OrderWithRelations) => void;
  handleSwipeLeft: (id: string) => void;
  handleSwipeCancel: () => void;
  supabase: ReturnType<typeof createClient>;
  handlePatched: (previous: OrderWithRelations, updated: OrderWithRelations) => void;
  onCompletedActionsMenuChange: (rowId: string, open: boolean) => void;
};

const CompletedOrdersSection = memo(function CompletedOrdersSection({
  density,
  showCompletedOrders,
  onToggleCompletedOrders,
  completedOrders,
  completedCount,
  visibleCompletedOrders,
  isCompletedLoading,
  isDesktop,
  completedScrollRef,
  completedOnScroll,
  completedVirtualItems,
  completedTopPadding,
  completedBottomPadding,
  selectionMode,
  selectedOrderIds,
  deletingId,
  swipedRowId,
  expandedOrderId,
  completedActionsMenuId,
  toggleExpanded,
  toggleOrderSelection,
  goToOrderDetail,
  duplicateOrder,
  handleDelete,
  handleSwipeLeft,
  handleSwipeCancel,
  supabase,
  handlePatched,
  onCompletedActionsMenuChange,
}: CompletedOrdersSectionProps) {
  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-card shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]", density === "compact" ? "p-3" : "p-4")}>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleCompletedOrders}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={showCompletedOrders}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-emerald-700 transition-transform dark:text-emerald-300", showCompletedOrders && "rotate-180")}
            aria-hidden
          />
          <span className="text-base font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
            완료 주문
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
            {showCompletedOrders && completedOrders !== null
              ? visibleCompletedOrders.length.toLocaleString("ko-KR")
              : displayCount(completedCount)}
          </span>
        </button>
      </div>

      {showCompletedOrders ? (
        isDesktop ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-hairline shadow-xs dark:border-slate-700">
            <div
              ref={completedScrollRef}
              onScroll={completedOnScroll}
              className="max-h-96 overflow-y-auto overflow-x-auto lg:max-h-[560px]"
            >
              <Table className="min-w-[58rem]">
                <TableHeader className="bg-surface-soft dark:bg-slate-700/40">
                  <TableRow>
                    <TableHead className="px-3">주문 정보</TableHead>
                    <TableHead className="whitespace-nowrap px-3">구매일</TableHead>
                    <TableHead className="whitespace-nowrap text-right">구매금액</TableHead>
                    <TableHead className="whitespace-nowrap px-3">플랫폼</TableHead>
                    <TableHead className="whitespace-nowrap px-3 text-right">수익</TableHead>
                    <TableHead className="min-w-[14rem] px-3">추가 정보</TableHead>
                    <TableHead className="whitespace-nowrap px-3 text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isCompletedLoading && completedOrders === null ? (
                    <TableLoadingRow colSpan={7} />
                  ) : visibleCompletedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="px-3 py-4 text-center text-sm text-muted-foreground"
                      >
                        조건에 맞는 완료 주문이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {completedTopPadding > 0 ? (
                        <TableRow aria-hidden>
                          <TableCell colSpan={7} className="border-0 p-0" style={{ height: completedTopPadding }} />
                        </TableRow>
                      ) : null}
                      {completedVirtualItems.map(({ item: row }) => (
                        <TableRow
                          key={row.id}
                          tabIndex={0}
                          role="button"
                          aria-label={selectionMode ? `${row.product_name} 주문 선택` : `${row.product_name} 주문 상세`}
                          aria-pressed={selectionMode ? selectedOrderIds.has(row.id) : undefined}
                          className={cn(
                            "group cursor-pointer border-l-2 border-l-emerald-400/70 bg-emerald-50/20 transition-colors hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-l-emerald-500/50 dark:hover:bg-emerald-500/10",
                            selectedOrderIds.has(row.id) && "bg-primary/10 ring-1 ring-inset ring-primary/30 hover:bg-primary/10",
                          )}
                          onClick={() => selectionMode ? toggleOrderSelection(row.id) : goToOrderDetail(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (selectionMode) toggleOrderSelection(row.id);
                              else goToOrderDetail(row.id);
                            }
                          }}
                        >
                          <TableCell className={cn("relative max-w-[14rem] px-3", selectionMode ? "pl-10 pr-3" : "pr-20", density === "compact" ? "py-2" : "py-4")}>
                            {selectionMode ? (
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.has(row.id)}
                                onChange={() => toggleOrderSelection(row.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 accent-primary"
                                aria-label={`${row.product_name} 선택`}
                              />
                            ) : null}
                            <div>
                              {row.title?.trim() ? (
                                <p className="text-muted-foreground line-clamp-1 text-xs">{row.title}</p>
                              ) : null}
                              <p className="line-clamp-1 font-semibold">{row.product_name}</p>
                              <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                                {row.notes?.trim() || "메모 없음"}
                              </p>
                            </div>
                            {!selectionMode ? <>
                              <button
                                type="button"
                                aria-label="주문 복제"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  duplicateOrder(row.id);
                                }}
                                className="absolute right-11 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border bg-background text-muted-foreground opacity-0 transition hover:text-primary group-hover:opacity-100 focus:opacity-100"
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label="주문 삭제"
                                disabled={deletingId === row.id}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleDelete(row); }}
                                className={cn(
                                  "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive transition",
                                  "md:opacity-0 md:group-hover:opacity-100",
                                  swipedRowId === row.id
                                    ? "pointer-events-auto opacity-100"
                                    : "pointer-events-none opacity-0 md:pointer-events-auto",
                                )}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </> : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3">{formatDate(row.purchase_date)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium">
                            {formatKrw(row.purchase_price_krw)}
                          </TableCell>
                          <TableCell className="px-3">
                            <PlatformBadge platform={row.platforms} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3 text-right font-medium">
                            {formatKrw(row.profit_krw)}
                          </TableCell>
                          <TableCell className="min-w-0 px-3 py-2 align-top">
                            <OrderDetailChips row={row} density="table" />
                          </TableCell>
                          <TableCell className="relative whitespace-nowrap px-3 py-2 align-top">
                            {selectionMode ? (
                              <span className="text-xs font-medium text-primary">{selectedOrderIds.has(row.id) ? "선택됨" : "선택"}</span>
                            ) : <WebCompletedActionsDropdown
                              row={row}
                              isOpen={completedActionsMenuId === row.id}
                              onClose={() => onCompletedActionsMenuChange(row.id, false)}
                              onToggle={() => onCompletedActionsMenuChange(row.id, completedActionsMenuId !== row.id)}
                              onEditOrder={() => {
                                onCompletedActionsMenuChange(row.id, false);
                                goToOrderDetail(row.id);
                              }}
                              supabase={supabase}
                              onPatched={(updated) => handlePatched(row, updated)}
                            />}
                          </TableCell>
                        </TableRow>
                      ))}
                      {completedBottomPadding > 0 ? (
                        <TableRow aria-hidden>
                          <TableCell colSpan={7} className="border-0 p-0" style={{ height: completedBottomPadding }} />
                        </TableRow>
                      ) : null}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div
            ref={completedScrollRef}
            onScroll={completedOnScroll}
            className="mt-4 max-h-[22rem] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y"
          >
            {isCompletedLoading && completedOrders === null ? (
              <OrderListLoading label="완료 주문" />
            ) : visibleCompletedOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">조건에 맞는 완료 주문이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {completedTopPadding > 0 ? <div aria-hidden style={{ height: completedTopPadding }} /> : null}
                {completedVirtualItems.map(({ item: row }) => (
                  <OrderCardItem
                    key={row.id}
                    row={row}
                    isDeleting={deletingId === row.id}
                    isSwiped={!selectionMode && swipedRowId === row.id}
                    isExpanded={expandedOrderId === row.id}
                    selectionMode={selectionMode}
                    isSelected={selectedOrderIds.has(row.id)}
                    onToggleExpand={toggleExpanded}
                    onToggleSelection={toggleOrderSelection}
                    onEditOrder={goToOrderDetail}
                    onDuplicateOrder={duplicateOrder}
                    onDelete={handleDelete}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeCancel={handleSwipeCancel}
                    supabase={supabase}
                    onPatchOrder={handlePatched}
                  />
                ))}
                {completedBottomPadding > 0 ? <div aria-hidden style={{ height: completedBottomPadding }} /> : null}
              </div>
            )}
          </div>
        )
      ) : null}
    </section>
  );
});

type PendingOrdersSectionProps = {
  density: LedgerDensity;
  visiblePendingOrders: OrderWithRelations[];
  isPendingLoading: boolean;
  isDesktop: boolean;
  pendingScrollRef: RefObject<HTMLDivElement | null>;
  pendingOnScroll: () => void;
  pendingVirtualItems: Array<{ item: OrderWithRelations; index: number }>;
  pendingTopPadding: number;
  pendingBottomPadding: number;
  selectionMode: boolean;
  selectedOrderIds: Set<string>;
  deletingId: string | null;
  swipedRowId: string | null;
  expandedOrderId: string | null;
  pendingCompleteMenuId: string | null;
  toggleExpanded: (id: string) => void;
  toggleOrderSelection: (id: string) => void;
  goToOrderDetail: (id: string) => void;
  duplicateOrder: (id: string) => void;
  handleDelete: (row: OrderWithRelations) => void;
  handleSwipeLeft: (id: string) => void;
  handleSwipeCancel: () => void;
  supabase: ReturnType<typeof createClient>;
  handlePatched: (previous: OrderWithRelations, updated: OrderWithRelations) => void;
  onPendingCompleteMenuChange: (rowId: string, open: boolean) => void;
};

const PendingOrdersSection = memo(function PendingOrdersSection({
  density,
  visiblePendingOrders,
  isPendingLoading,
  isDesktop,
  pendingScrollRef,
  pendingOnScroll,
  pendingVirtualItems,
  pendingTopPadding,
  pendingBottomPadding,
  selectionMode,
  selectedOrderIds,
  deletingId,
  swipedRowId,
  expandedOrderId,
  pendingCompleteMenuId,
  toggleExpanded,
  toggleOrderSelection,
  goToOrderDetail,
  duplicateOrder,
  handleDelete,
  handleSwipeLeft,
  handleSwipeCancel,
  supabase,
  handlePatched,
  onPendingCompleteMenuChange,
}: PendingOrdersSectionProps) {
  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-card shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]", density === "compact" ? "p-3" : "p-4")}>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-amber-700 dark:text-amber-300">
            미완료 주문
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            {visiblePendingOrders.length.toLocaleString("ko-KR")}
          </span>
        </div>
      </div>

      {isDesktop ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-hairline shadow-xs dark:border-slate-700">
          <div
            ref={pendingScrollRef}
            onScroll={pendingOnScroll}
            className="max-h-96 overflow-y-auto overflow-x-auto lg:max-h-[560px]"
          >
            <Table className="min-w-[52rem]">
              <TableHeader className="bg-surface-soft dark:bg-slate-700/40">
                <TableRow>
                  <TableHead className="px-3">주문 정보</TableHead>
                  <TableHead className="whitespace-nowrap px-3">구매일</TableHead>
                  <TableHead className="whitespace-nowrap text-right">구매금액</TableHead>
                  <TableHead className="whitespace-nowrap px-3">플랫폼</TableHead>
                  <TableHead className="min-w-[14rem] px-3">추가 정보</TableHead>
                  <TableHead className="whitespace-nowrap px-3 text-right">완료</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPendingLoading ? (
                  <TableLoadingRow colSpan={6} />
                ) : visiblePendingOrders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-3 py-4 text-center text-sm text-muted-foreground"
                    >
                      조건에 맞는 미완료 주문이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {pendingTopPadding > 0 ? (
                      <TableRow aria-hidden>
                        <TableCell colSpan={6} className="border-0 p-0" style={{ height: pendingTopPadding }} />
                      </TableRow>
                    ) : null}
                    {pendingVirtualItems.map(({ item: row }) => (
                      <TableRow
                        key={row.id}
                        tabIndex={0}
                        role="button"
                        aria-label={selectionMode ? `${row.product_name} 주문 선택` : `${row.product_name} 주문 상세`}
                        aria-pressed={selectionMode ? selectedOrderIds.has(row.id) : undefined}
                        className={cn(
                          "group cursor-pointer border-l-2 border-l-amber-400/90 bg-amber-50/30 transition-colors hover:bg-amber-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-l-amber-500/50 dark:hover:bg-amber-500/10",
                          selectedOrderIds.has(row.id) && "bg-primary/10 ring-1 ring-inset ring-primary/30 hover:bg-primary/10",
                        )}
                        onClick={() => selectionMode ? toggleOrderSelection(row.id) : goToOrderDetail(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selectionMode) toggleOrderSelection(row.id);
                            else goToOrderDetail(row.id);
                          }
                        }}
                      >
                        <TableCell className={cn("relative max-w-[14rem] px-3", selectionMode ? "pl-10 pr-3" : "pr-20", density === "compact" ? "py-2" : "py-4")}>
                          {selectionMode ? (
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.has(row.id)}
                              onChange={() => toggleOrderSelection(row.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 accent-primary"
                              aria-label={`${row.product_name} 선택`}
                            />
                          ) : null}
                          <div>
                            {row.title?.trim() ? (
                              <p className="text-muted-foreground line-clamp-1 text-xs">{row.title}</p>
                            ) : null}
                            <p className="line-clamp-1 font-semibold">{row.product_name}</p>
                            <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                              {row.notes?.trim() || "메모 없음"}
                            </p>
                          </div>
                          {!selectionMode ? <>
                            <button
                              type="button"
                              aria-label="주문 복제"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                duplicateOrder(row.id);
                              }}
                              className="absolute right-11 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border bg-background text-muted-foreground opacity-0 transition hover:text-primary group-hover:opacity-100 focus:opacity-100"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label="주문 삭제"
                              disabled={deletingId === row.id}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleDelete(row); }}
                              className={cn(
                                "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive transition",
                                "md:opacity-0 md:group-hover:opacity-100",
                                swipedRowId === row.id
                                  ? "pointer-events-auto opacity-100"
                                  : "pointer-events-none opacity-0 md:pointer-events-auto",
                              )}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3">{formatDate(row.purchase_date)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-medium">
                          {formatKrw(row.purchase_price_krw)}
                        </TableCell>
                        <TableCell className="px-3">
                          <PlatformBadge platform={row.platforms} />
                        </TableCell>
                        <TableCell className="min-w-0 px-3 py-2 align-top">
                          <OrderDetailChips row={row} density="table" />
                        </TableCell>
                        <TableCell className="relative whitespace-nowrap px-3 py-2 align-top">
                          {selectionMode ? (
                            <span className="text-xs font-medium text-primary">{selectedOrderIds.has(row.id) ? "선택됨" : "선택"}</span>
                          ) : <WebPendingCompleteDropdown
                            row={row}
                            isOpen={pendingCompleteMenuId === row.id}
                            onClose={() => onPendingCompleteMenuChange(row.id, false)}
                            onToggle={() => onPendingCompleteMenuChange(row.id, pendingCompleteMenuId !== row.id)}
                            supabase={supabase}
                            onPatched={(updated) => handlePatched(row, updated)}
                          />}
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingBottomPadding > 0 ? (
                      <TableRow aria-hidden>
                        <TableCell colSpan={6} className="border-0 p-0" style={{ height: pendingBottomPadding }} />
                      </TableRow>
                    ) : null}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div
          ref={pendingScrollRef}
          onScroll={pendingOnScroll}
          className="mt-4 max-h-[22rem] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y"
        >
          {isPendingLoading ? (
            <OrderListLoading label="미완료 주문" />
          ) : visiblePendingOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">조건에 맞는 미완료 주문이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingTopPadding > 0 ? <div aria-hidden style={{ height: pendingTopPadding }} /> : null}
              {pendingVirtualItems.map(({ item: row }) => (
                <OrderCardItem
                  key={row.id}
                  row={row}
                  isDeleting={deletingId === row.id}
                  isSwiped={!selectionMode && swipedRowId === row.id}
                  isExpanded={expandedOrderId === row.id}
                  selectionMode={selectionMode}
                  isSelected={selectedOrderIds.has(row.id)}
                  onToggleExpand={toggleExpanded}
                  onToggleSelection={toggleOrderSelection}
                  onEditOrder={goToOrderDetail}
                  onDuplicateOrder={duplicateOrder}
                  onDelete={handleDelete}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeCancel={handleSwipeCancel}
                  supabase={supabase}
                  onPatchOrder={handlePatched}
                />
              ))}
              {pendingBottomPadding > 0 ? <div aria-hidden style={{ height: pendingBottomPadding }} /> : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
});

/** 많은 주문을 한꺼번에 선택해도 브라우저가 DB 요청을 과도하게 동시에 보내지 않도록 나눠 처리합니다. */
async function runOrderMutationBatches<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += 20) {
    results.push(...await Promise.all(items.slice(index, index + 20).map(worker)));
  }
  return results;
}

export function OrdersTable({
  userId,
  userEmail,
  pendingOrders,
  completedOrders,
  counts,
  isCountsLoading,
  isPendingLoading,
  isCompletedLoading,
  onLoadCompleted,
  onOrderPatched,
  onOrderDeleted,
  onOrderRestored,
}: {
  userId: string;
  userEmail: string;
  pendingOrders: OrderWithRelations[];
  completedOrders: OrderWithRelations[] | null;
  counts: OrderListCounts;
  isCountsLoading: boolean;
  isPendingLoading: boolean;
  isCompletedLoading: boolean;
  onLoadCompleted: () => Promise<void>;
  onOrderPatched: (previous: OrderWithRelations, updated: OrderWithRelations) => void;
  onOrderDeleted: (deleted: OrderWithRelations) => void;
  onOrderRestored: (restored: OrderWithRelations) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const legacyUndeliveredFromUrl = searchParams.get("attention") === "undelivered";
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(() => {
    const value = searchParams.get("status") as OrderStatusFilter;
    return orderStatusFilters.includes(value) ? value : "all";
  });
  const [attentionFilter, setAttentionFilter] = useState<OrderAttentionFilter>(() => {
    const value = searchParams.get("attention") as OrderAttentionFilter;
    return legacyUndeliveredFromUrl ? "all" : orderAttentionFilters.includes(value) ? value : "all";
  });
  const [deliveryFilter, setDeliveryFilter] = useState<OrderDeliveryFilter>(() => {
    const value = searchParams.get("delivery") as OrderDeliveryFilter;
    return orderDeliveryFilters.includes(value) ? value : legacyUndeliveredFromUrl ? "no" : "all";
  });
  const [fromDate, setFromDate] = useState(() => searchParams.get("from") ?? "");
  const [toDate, setToDate] = useState(() => searchParams.get("to") ?? "");
  const [sort, setSort] = useState<OrderSort>(() => {
    const value = searchParams.get("sort") as OrderSort;
    return orderSorts.includes(value) ? value : "newest";
  });
  const [platformFilter, setPlatformFilter] = useState(() => searchParams.get("platform") ?? "");
  const [paymentFilter, setPaymentFilter] = useState(() => searchParams.get("payment") ?? "");
  const [accountFilter, setAccountFilter] = useState(() => searchParams.get("account") ?? "");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const quickFilterScrollRef = useRef<HTMLDivElement>(null);
  const [hasMoreQuickFilters, setHasMoreQuickFilters] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedOrderView[]>([]);
  const [density, setDensity] = useState<LedgerDensity>("compact");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);
  const [showCompletedOrders, setShowCompletedOrders] = useState(
    statusFilter === "completed" || attentionFilter === "missingDeposit" || deliveryFilter !== "all",
  );
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [pendingCompleteMenuId, setPendingCompleteMenuId] = useState<string | null>(null);
  const [completedActionsMenuId, setCompletedActionsMenuId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const [bulkMasterData, setBulkMasterData] = useState<MasterData | null>(null);
  const [bulkTemplates, setBulkTemplates] = useState<PurchaseTemplateRow[]>([]);
  const [isLoadingBulkOptions, setIsLoadingBulkOptions] = useState(false);
  const [undoOrder, setUndoOrder] = useState<OrderWithRelations | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const undoTimerRef = useRef<number | null>(null);

  const updateQuickFilterScrollState = useCallback(() => {
    const element = quickFilterScrollRef.current;
    if (!element) return;
    const remainingScroll = element.scrollWidth - element.clientWidth - element.scrollLeft;
    setHasMoreQuickFilters(remainingScroll > 4);
  }, []);

  const deferredSearch = useDeferredValue(search);

  const filterSnapshot = useMemo<OrderFilterSnapshot>(() => ({
    q: deferredSearch,
    status: statusFilter,
    attention: attentionFilter,
    delivery: deliveryFilter,
    from: fromDate,
    to: toDate,
    sort,
    platform: platformFilter,
    payment: paymentFilter,
    account: accountFilter,
  }), [
    accountFilter,
    attentionFilter,
    deliveryFilter,
    deferredSearch,
    fromDate,
    paymentFilter,
    platformFilter,
    sort,
    statusFilter,
    toDate,
  ]);

  const pendingSearchableOrders = useMemo(() => prepareSearchableOrders(pendingOrders), [pendingOrders]);
  const completedSearchableOrders = useMemo(
    () => prepareSearchableOrders(completedOrders ?? []),
    [completedOrders],
  );

  const visiblePendingOrders = useMemo(
    () => statusFilter === "completed" ? [] : filterSearchableOrders(pendingSearchableOrders, filterSnapshot),
    [filterSnapshot, pendingSearchableOrders, statusFilter],
  );

  const visibleCompletedOrders = useMemo(
    () => statusFilter === "pending" ? [] : filterSearchableOrders(completedSearchableOrders, filterSnapshot),
    [completedSearchableOrders, filterSnapshot, statusFilter],
  );

  const loadedOrders = useMemo(
    () => [...pendingOrders, ...(completedOrders ?? [])],
    [completedOrders, pendingOrders],
  );
  const selectedOrders = useMemo(
    () => loadedOrders.filter((order) => selectedOrderIds.has(order.id)),
    [loadedOrders, selectedOrderIds],
  );
  const visibleSelectableOrders = useMemo(
    () => [...visiblePendingOrders, ...(showCompletedOrders ? visibleCompletedOrders : [])],
    [showCompletedOrders, visibleCompletedOrders, visiblePendingOrders],
  );
  const allVisibleSelected = visibleSelectableOrders.length > 0
    && visibleSelectableOrders.every((order) => selectedOrderIds.has(order.id));

  const totalCount = counts.total;
  const pendingCount = counts.pending;
  const completedCount = counts.completed;
  const completedPct =
    totalCount !== null && completedCount !== null && totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : null;

  const filterOptions = useMemo(() => {
    const allOrders = [...pendingOrders, ...(completedOrders ?? [])];
    return {
      platforms: [...new Set(allOrders.map((order) => order.platforms?.name).filter((name): name is string => Boolean(name)))].sort(),
      payments: [...new Set(allOrders.map((order) => order.payment_methods?.name).filter((name): name is string => Boolean(name)))].sort(),
      accounts: [...new Set(allOrders.map((order) => order.buyer_accounts?.label).filter((name): name is string => Boolean(name)))].sort(),
    };
  }, [completedOrders, pendingOrders]);

  const currentFilterSnapshot = useMemo<OrderFilterSnapshot>(() => ({
    q: search,
    status: statusFilter,
    attention: attentionFilter,
    delivery: deliveryFilter,
    from: fromDate,
    to: toDate,
    sort,
    platform: platformFilter,
    payment: paymentFilter,
    account: accountFilter,
  }), [accountFilter, attentionFilter, deliveryFilter, fromDate, paymentFilter, platformFilter, search, sort, statusFilter, toDate]);
  const currentFilterSnapshotRef = useRef(currentFilterSnapshot);
  currentFilterSnapshotRef.current = currentFilterSnapshot;

  const applyFilterSnapshot = useCallback((next: OrderFilterSnapshot) => {
    const current = currentFilterSnapshotRef.current;
    if (current.q !== next.q) setSearch(next.q);
    if (current.status !== next.status) setStatusFilter(next.status);
    if (current.attention !== next.attention) setAttentionFilter(next.attention);
    if (current.delivery !== next.delivery) setDeliveryFilter(next.delivery);
    if (current.from !== next.from) setFromDate(next.from);
    if (current.to !== next.to) setToDate(next.to);
    if (current.sort !== next.sort) setSort(next.sort);
    if (current.platform !== next.platform) setPlatformFilter(next.platform);
    if (current.payment !== next.payment) setPaymentFilter(next.payment);
    if (current.account !== next.account) setAccountFilter(next.account);
  }, []);

  useEffect(() => {
    const nextStatus = searchParams.get("status") as OrderStatusFilter;
    const rawAttention = searchParams.get("attention") ?? "";
    const isLegacyUndelivered = rawAttention === "undelivered";
    const nextAttention = rawAttention as OrderAttentionFilter;
    const nextDelivery = searchParams.get("delivery") as OrderDeliveryFilter;
    const nextSort = searchParams.get("sort") as OrderSort;
    applyFilterSnapshot({
      q: searchParams.get("q") ?? "",
      status: orderStatusFilters.includes(nextStatus) ? nextStatus : "all",
      attention: isLegacyUndelivered ? "all" : orderAttentionFilters.includes(nextAttention) ? nextAttention : "all",
      delivery: orderDeliveryFilters.includes(nextDelivery) ? nextDelivery : isLegacyUndelivered ? "no" : "all",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      sort: orderSorts.includes(nextSort) ? nextSort : "newest",
      platform: searchParams.get("platform") ?? "",
      payment: searchParams.get("payment") ?? "",
      account: searchParams.get("account") ?? "",
    });
  }, [applyFilterSnapshot, searchParams]);

  const clearAllFilters = useCallback(() => {
    applyFilterSnapshot({
      q: "",
      status: "all",
      attention: "all",
      delivery: "all",
      from: "",
      to: "",
      sort: "newest",
      platform: "",
      payment: "",
      account: "",
    });
  }, [applyFilterSnapshot]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [viewsResult, nextPreferences] = await Promise.all([
        supabase.from("saved_order_views").select("*").eq("user_id", userId).order("created_at"),
        getOrCreateUserPreferences(supabase, userId),
      ]);
      if (cancelled) return;
      setSavedViews(viewsResult.data ?? []);
      setDensity(nextPreferences.ledger_density === "comfortable" ? "comfortable" : "compact");
    })().catch(() => {
      // 원장 자체는 계속 사용할 수 있으므로 보조 설정 조회 실패는 화면을 막지 않습니다.
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  useLayoutEffect(() => {
    const element = quickFilterScrollRef.current;
    if (!element) return;

    updateQuickFilterScrollState();
    element.addEventListener("scroll", updateQuickFilterScrollState, { passive: true });
    window.addEventListener("resize", updateQuickFilterScrollState);
    const resizeObserver = new ResizeObserver(updateQuickFilterScrollState);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", updateQuickFilterScrollState);
      window.removeEventListener("resize", updateQuickFilterScrollState);
      resizeObserver.disconnect();
    };
  }, [updateQuickFilterScrollState]);

  useEffect(() => {
    if (statusFilter === "pending") return;
    if (statusFilter !== "completed" && attentionFilter !== "missingDeposit" && deliveryFilter === "all") return;
    setShowCompletedOrders(true);
    void onLoadCompleted();
  }, [attentionFilter, deliveryFilter, onLoadCompleted, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams();
      if (search.trim()) nextParams.set("q", search.trim());
      if (statusFilter !== "all") nextParams.set("status", statusFilter);
      if (attentionFilter !== "all") nextParams.set("attention", attentionFilter);
      if (deliveryFilter !== "all") nextParams.set("delivery", deliveryFilter);
      if (fromDate) nextParams.set("from", fromDate);
      if (toDate) nextParams.set("to", toDate);
      if (sort !== "newest") nextParams.set("sort", sort);
      if (platformFilter) nextParams.set("platform", platformFilter);
      if (paymentFilter) nextParams.set("payment", paymentFilter);
      if (accountFilter) nextParams.set("account", accountFilter);

      const nextQuery = nextParams.toString();
      if (nextQuery === searchParams.toString()) return;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    accountFilter,
    attentionFilter,
    deliveryFilter,
    fromDate,
    pathname,
    paymentFilter,
    platformFilter,
    router,
    search,
    searchParams,
    sort,
    statusFilter,
    toDate,
  ]);

  const setQuickFilter = (key: OrderQuickFilter) => {
    if (key === "all") {
      setStatusFilter("all");
      setAttentionFilter("all");
      setDeliveryFilter("all");
      return;
    }
    if (key === "pending") {
      setStatusFilter("pending");
      setAttentionFilter("all");
      setDeliveryFilter("all");
      return;
    }
    if (key === "deliveryYes" || key === "deliveryNo") {
      setStatusFilter("all");
      setAttentionFilter("all");
      setDeliveryFilter(key === "deliveryYes" ? "yes" : "no");
      return;
    }
    if (key === "missingDeposit") {
      setStatusFilter("completed");
      setAttentionFilter("missingDeposit");
      setDeliveryFilter("all");
      return;
    }
    setDeliveryFilter("all");
    setStatusFilter(
      key === "scheduleToday" || key === "overdue" || key === "scheduleUpcoming"
        ? "pending"
        : "all",
    );
    setAttentionFilter(key);
  };

  const activeQuickFilter: OrderQuickFilter | null = deliveryFilter !== "all"
    ? deliveryFilter === "yes" ? "deliveryYes" : "deliveryNo"
    : statusFilter === "pending" && attentionFilter === "all"
      ? "pending"
      : attentionFilter !== "all"
        ? attentionFilter
        : statusFilter === "all"
          ? "all"
          : null;

  const saveCurrentView = async () => {
    const name = window.prompt("저장할 보기 이름을 입력해 주세요.")?.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("saved_order_views")
      .upsert(
        { user_id: userId, name, filters: currentFilterSnapshot as unknown as Json },
        { onConflict: "user_id,name" },
      )
      .select("*")
      .single();
    if (error) {
      window.alert(`보기를 저장하지 못했습니다: ${error.message}`);
      return;
    }
    setSavedViews((current) => [...current.filter((view) => view.id !== data.id && view.name !== data.name), data]);
  };

  const applySavedView = (view: SavedOrderView) => {
    const parsed = readSavedFilterSnapshot(view.filters);
    if (!parsed) {
      window.alert("저장된 필터 형식을 읽을 수 없습니다.");
      return;
    }
    applyFilterSnapshot(parsed);
  };

  const deleteSavedView = async (view: SavedOrderView) => {
    const { error } = await supabase.from("saved_order_views").delete().eq("id", view.id);
    if (error) {
      window.alert(`보기를 삭제하지 못했습니다: ${error.message}`);
      return;
    }
    setSavedViews((current) => current.filter((item) => item.id !== view.id));
  };

  const toggleDensity = () => {
    const next: LedgerDensity = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    void supabase.from("user_preferences").upsert(
      { user_id: userId, ledger_density: next },
      { onConflict: "user_id" },
    );
  };

  const toggleExpanded = useCallback((id: string) => {
    setPendingCompleteMenuId(null);
    setCompletedActionsMenuId(null);
    setExpandedOrderId((prev) => (prev === id ? null : id));
  }, []);

  const goToOrderDetail = useCallback((id: string) => {
    router.push(`/orders/detail?id=${encodeURIComponent(id)}`);
  }, [router]);

  const duplicateOrder = useCallback((id: string) => {
    router.push(`/orders/new?copy=${encodeURIComponent(id)}`);
  }, [router]);

  const handlePatched = useCallback(
    (previous: OrderWithRelations, updated: OrderWithRelations) => {
      setPendingCompleteMenuId(null);
      setCompletedActionsMenuId(null);
      setExpandedOrderId((prev) => (prev === previous.id && previous.is_processed !== updated.is_processed ? null : prev));
      onOrderPatched(previous, updated);
    },
    [onOrderPatched],
  );

  const closeSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedOrderIds(new Set());
    setSwipedRowId(null);
    setExpandedOrderId(null);
  }, []);

  const enableSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSwipedRowId(null);
    setExpandedOrderId(null);
    if (bulkMasterData || isLoadingBulkOptions) return;

    setIsLoadingBulkOptions(true);
    void Promise.all([
      fetchMasterData(supabase, userId),
      supabase
        .from("purchase_info_templates")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]).then(([master, templateResult]) => {
      setBulkMasterData(master);
      setBulkTemplates(templateResult.data ?? []);
    }).catch((error: unknown) => {
      window.alert(`일괄 변경 항목을 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => setIsLoadingBulkOptions(false));
  }, [bulkMasterData, isLoadingBulkOptions, supabase, userId]);

  const toggleOrderSelection = useCallback((id: string) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisibleOrders = useCallback(() => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      const shouldClear = visibleSelectableOrders.length > 0
        && visibleSelectableOrders.every((order) => next.has(order.id));
      for (const order of visibleSelectableOrders) {
        if (shouldClear) next.delete(order.id);
        else next.add(order.id);
      }
      return next;
    });
  }, [visibleSelectableOrders]);

  const applyBulkResult = useCallback((result: BulkOperationResult) => {
    setSelectedOrderIds(new Set(result.failures.map((failure) => failure.id)));
    return result;
  }, []);

  const handleBulkPatch = useCallback(async (patch: BulkOrderPatch) => {
    const targets = selectedOrders;
    const results = await runOrderMutationBatches(targets, async (previous) => {
      const update = { [patch.field]: patch.value } as Database["public"]["Tables"]["orders"]["Update"];
      const { data, error } = await supabase
        .from("orders")
        .update(update)
        .eq("id", previous.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select(ORDER_LIST_SELECT)
        .maybeSingle();
      if (error || !data) {
        return { previous, error: error?.message ?? "변경할 주문을 찾지 못했습니다." };
      }
      return { previous, updated: data as OrderWithRelations };
    });

    const operationResult: BulkOperationResult = { successIds: [], failures: [] };
    for (const result of results) {
      if ("updated" in result && result.updated) {
        operationResult.successIds.push(result.previous.id);
        handlePatched(result.previous, result.updated);
      } else {
        operationResult.failures.push({
          id: result.previous.id,
          label: result.previous.title?.trim() || result.previous.product_name,
          message: result.error,
        });
      }
    }
    return applyBulkResult(operationResult);
  }, [applyBulkResult, handlePatched, selectedOrders, supabase, userId]);

  const handleBulkComplete = useCallback(async (drafts: BulkCompletionDraft[]) => {
    const selectedById = new Map(selectedOrders.map((order) => [order.id, order]));
    const results = await runOrderMutationBatches(drafts, async (draft) => {
      const previous = selectedById.get(draft.orderId);
      if (!previous) return { draft, error: "선택한 주문을 찾지 못했습니다." };
      const outcome = buildOrderCompletionValues(previous, draft);
      if ("error" in outcome) return { draft, previous, error: outcome.error };

      const { data, error } = await supabase
        .from("orders")
        .update(outcome.values)
        .eq("id", previous.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("is_processed", false)
        .select(ORDER_LIST_SELECT)
        .maybeSingle();
      if (error || !data) return { draft, previous, error: error?.message ?? "이미 처리되었거나 주문을 찾지 못했습니다." };
      return { draft, previous, updated: data as OrderWithRelations };
    });

    const operationResult: BulkOperationResult = { successIds: [], failures: [] };
    for (const result of results) {
      if ("updated" in result && result.previous && result.updated) {
        operationResult.successIds.push(result.previous.id);
        handlePatched(result.previous, result.updated);
      } else {
        const previous = result.previous ?? selectedById.get(result.draft.orderId);
        operationResult.failures.push({
          id: result.draft.orderId,
          label: previous?.title?.trim() || previous?.product_name || "주문",
          message: result.error ?? "처리하지 못했습니다.",
        });
      }
    }
    return applyBulkResult(operationResult);
  }, [applyBulkResult, handlePatched, selectedOrders, supabase, userId]);

  const handleDelete = useCallback(async (row: OrderWithRelations) => {
    const confirmed = window.confirm(`"${row.product_name}" 주문을 휴지통으로 이동할까요?`);
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) {
        window.alert(`삭제 중 오류: ${error.message}`);
        return;
      }
      onOrderDeleted(row);
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      setUndoOrder(row);
      undoTimerRef.current = window.setTimeout(() => {
        setUndoOrder(null);
        undoTimerRef.current = null;
      }, 8000);
      setSwipedRowId((prev) => (prev === row.id ? null : prev));
      setExpandedOrderId((prev) => (prev === row.id ? null : prev));
    } finally {
      setDeletingId(null);
    }
  }, [onOrderDeleted, supabase, userId]);

  const undoDelete = async () => {
    if (!undoOrder || isUndoing) return;
    setIsUndoing(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .update({ deleted_at: null })
        .eq("id", undoOrder.id)
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .select(ORDER_LIST_SELECT)
        .maybeSingle();
      if (error || !data) {
        window.alert(`삭제 취소 중 오류: ${error?.message ?? "휴지통에서 주문을 찾지 못했습니다."}`);
        return;
      }
      onOrderRestored(data as OrderWithRelations);
      setUndoOrder(null);
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    } finally {
      setIsUndoing(false);
    }
  };

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  const handleToggleCompletedOrders = useCallback(() => {
    const next = !showCompletedOrders;
    setShowCompletedOrders(next);
    if (!next) return;
    void onLoadCompleted();
  }, [onLoadCompleted, showCompletedOrders]);

  const handleCompletedActionsMenuChange = useCallback((rowId: string, open: boolean) => {
    setCompletedActionsMenuId(open ? rowId : null);
  }, []);

  const handlePendingCompleteMenuChange = useCallback((rowId: string, open: boolean) => {
    setPendingCompleteMenuId(open ? rowId : null);
  }, []);

  const handleSwipeLeft = useCallback((id: string) => setSwipedRowId(id), []);
  const handleSwipeCancel = useCallback(() => setSwipedRowId(null), []);

  const mobilePendingSize = useCallback(
    (row: OrderWithRelations) => (expandedOrderId === row.id ? 430 : 92),
    [expandedOrderId],
  );
  const mobileCompletedSize = useCallback(
    (row: OrderWithRelations) => (expandedOrderId === row.id ? 250 : 92),
    [expandedOrderId],
  );
  // 가상 스크롤 높이도 실제 행 여백과 맞춰 긴 목록에서 스크롤 위치가 어긋나지 않게 합니다.
  const tableRowSize = useCallback(() => density === "compact" ? 72 : 88, [density]);

  const pendingVirtual = useVirtualRange(
    visiblePendingOrders,
    isDesktop ? tableRowSize : mobilePendingSize,
  );
  const completedVirtual = useVirtualRange(
    showCompletedOrders ? visibleCompletedOrders : EMPTY_ORDER_ROWS,
    isDesktop ? tableRowSize : mobileCompletedSize,
  );

  return (
    <div className="flex min-h-0 flex-col gap-5">
      {/* ── 통계 카드 (모바일도 한 줄 3열) ───────────────── */}
      <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
        {/* 전체 주문 */}
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-white p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-slate-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-slate-700">
            <ShoppingBag className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5 dark:text-slate-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-tight text-muted-foreground break-keep sm:text-xs">
              전체 주문
            </p>
            <p className="text-lg font-bold tabular-nums sm:text-2xl" aria-busy={isCountsLoading}>
              {displayCount(totalCount)}
            </p>
          </div>
        </div>

        {/* 입금 미완료 */}
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-amber-50 p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-amber-500/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-amber-500/20">
            <Clock className="h-4 w-4 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-tight break-keep text-amber-700 sm:text-xs dark:text-amber-300">
              입금 미완료
            </p>
            <p className="text-lg font-bold tabular-nums text-amber-800 sm:text-2xl dark:text-amber-200">
              {displayCount(pendingCount)}
            </p>
          </div>
        </div>

        {/* 입금 완료 + 프로그레스 바 */}
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-emerald-50 p-2 shadow-sm sm:gap-2 sm:rounded-2xl sm:p-4 dark:bg-emerald-500/10">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 sm:h-5 sm:w-5 dark:text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] leading-tight break-keep text-emerald-700 sm:text-xs dark:text-emerald-300">
                입금 완료
              </p>
              <p className="text-lg font-bold tabular-nums text-emerald-800 sm:text-2xl dark:text-emerald-200">
                {displayCount(completedCount)}
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-0.5 pl-[calc(2rem+0.375rem)] sm:space-y-1 sm:pl-0">
            <div className="flex justify-between gap-1 text-[9px] text-emerald-700/70 sm:text-[11px] dark:text-emerald-400/70">
              <span className="truncate">전체 대비</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {completedPct === null ? "…" : `${completedPct}%`}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-emerald-200/60 sm:h-1.5 dark:bg-emerald-900/40">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 dark:bg-emerald-400"
                style={{ width: `${completedPct ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 모든 주문 섹션이 같은 검색·기간·분류 상태를 공유하는 원장 도구 모음입니다. */}
      <section className="sticky top-0 z-30 rounded-2xl border border-hairline bg-background/95 p-3 shadow-sm backdrop-blur-md sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제목·상품·주문번호·메모 검색"
              aria-label="전체 주문 검색"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:shrink-0">
            <Button
              type="button"
              variant={showAdvancedFilter ? "default" : "outline"}
              size="sm"
              className="h-10 shrink-0 gap-1.5 whitespace-nowrap"
              onClick={() => setShowAdvancedFilter((current) => !current)}
            >
              <Filter className="h-4 w-4" aria-hidden />
              상세
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 whitespace-nowrap" onClick={toggleDensity}>
              <Rows3 className="h-4 w-4" aria-hidden />
              {density === "compact" ? "촘촘하게" : "편안하게"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 whitespace-nowrap" onClick={() => void saveCurrentView()}>
              <Save className="h-4 w-4" aria-hidden />
              보기 저장
            </Button>
            <Button
              type="button"
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              className="h-10 shrink-0 gap-1.5 whitespace-nowrap"
              onClick={selectionMode ? closeSelectionMode : enableSelectionMode}
            >
              <ListChecks className="h-4 w-4" aria-hidden />
              {selectionMode ? "선택 종료" : "주문 선택"}
            </Button>
          </div>
        </div>

        <div className="relative mt-3">
          <div ref={quickFilterScrollRef} className="flex gap-2 overflow-x-auto pb-1 pr-8 [scrollbar-width:none]">
            {([
              ["all", "전체"],
              ["pending", "미완료"],
              ["deliveryYes", "배송 있음"],
              ["deliveryNo", "배송 없음"],
              ["scheduleToday", "오늘 구매"],
              ["overdue", "예약 지남"],
              ["scheduleUpcoming", "7일 내 예정"],
              ["missingDeposit", "입금정보 누락"],
              ["missingAi", "AI 리뷰 없음"],
              ["missingTemplate", "템플릿 없음"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuickFilter(key)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                  activeQuickFilter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {hasMoreQuickFilters ? (
            <button
              type="button"
              aria-label="오른쪽 필터 더 보기"
              title="오른쪽 필터 더 보기"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-background via-background/95 to-transparent pl-3 text-muted-foreground lg:hidden"
              onClick={() => quickFilterScrollRef.current?.scrollBy({ left: 180, behavior: "smooth" })}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {savedViews.length > 0 ? (
          <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">저장된 보기</span>
            {savedViews.map((view) => (
              <span key={view.id} className="inline-flex shrink-0 items-center rounded-full border bg-card">
                <button type="button" className="h-7 px-2.5 text-xs font-medium" onClick={() => applySavedView(view)}>
                  {view.name}
                </button>
                <button
                  type="button"
                  aria-label={`${view.name} 보기 삭제`}
                  className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void deleteSavedView(view)}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {showAdvancedFilter ? (
          <div className="mt-3 border-t border-border/60 pt-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatusFilter)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="all">상태 전체</option>
                <option value="pending">미완료</option>
                <option value="completed">완료</option>
              </select>
              <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">플랫폼 전체</option>
                {filterOptions.platforms.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">결제수단 전체</option>
                {filterOptions.payments.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">구매계정 전체</option>
                {filterOptions.accounts.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="구매일 시작" className="h-9 rounded-xl" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="구매일 종료" className="h-9 rounded-xl" />
              <select value={sort} onChange={(event) => setSort(event.target.value as OrderSort)} className="h-9 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="newest">구매일 최신순</option>
                <option value="oldest">구매일 오래된순</option>
                <option value="amountDesc">구매금액 높은순</option>
                <option value="amountAsc">구매금액 낮은순</option>
              </select>
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1.5" onClick={clearAllFilters}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                모든 필터 지우기
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {selectionMode ? (
        <OrdersBulkActions
          orders={selectedOrders}
          visibleCount={visibleSelectableOrders.length}
          allVisibleSelected={allVisibleSelected}
          masterData={bulkMasterData}
          templates={bulkTemplates}
          isLoadingOptions={isLoadingBulkOptions}
          onToggleAllVisible={toggleAllVisibleOrders}
          onPatch={handleBulkPatch}
          onComplete={handleBulkComplete}
          onExport={() => {
            void exportDashboardExcel(selectedOrders, userEmail, `선택 주문 ${selectedOrders.length}건`);
          }}
          onClose={closeSelectionMode}
        />
      ) : null}

      <PendingOrdersSection
        density={density}
        visiblePendingOrders={visiblePendingOrders}
        isPendingLoading={isPendingLoading}
        isDesktop={isDesktop}
        pendingScrollRef={pendingVirtual.scrollRef}
        pendingOnScroll={pendingVirtual.onScroll}
        pendingVirtualItems={pendingVirtual.virtualItems}
        pendingTopPadding={pendingVirtual.topPadding}
        pendingBottomPadding={pendingVirtual.bottomPadding}
        selectionMode={selectionMode}
        selectedOrderIds={selectedOrderIds}
        deletingId={deletingId}
        swipedRowId={swipedRowId}
        expandedOrderId={expandedOrderId}
        pendingCompleteMenuId={pendingCompleteMenuId}
        toggleExpanded={toggleExpanded}
        toggleOrderSelection={toggleOrderSelection}
        goToOrderDetail={goToOrderDetail}
        duplicateOrder={duplicateOrder}
        handleDelete={handleDelete}
        handleSwipeLeft={handleSwipeLeft}
        handleSwipeCancel={handleSwipeCancel}
        supabase={supabase}
        handlePatched={handlePatched}
        onPendingCompleteMenuChange={handlePendingCompleteMenuChange}
      />

      <CompletedOrdersSection
        density={density}
        showCompletedOrders={showCompletedOrders}
        onToggleCompletedOrders={handleToggleCompletedOrders}
        completedOrders={completedOrders}
        completedCount={completedCount}
        visibleCompletedOrders={visibleCompletedOrders}
        isCompletedLoading={isCompletedLoading}
        isDesktop={isDesktop}
        completedScrollRef={completedVirtual.scrollRef}
        completedOnScroll={completedVirtual.onScroll}
        completedVirtualItems={completedVirtual.virtualItems}
        completedTopPadding={completedVirtual.topPadding}
        completedBottomPadding={completedVirtual.bottomPadding}
        selectionMode={selectionMode}
        selectedOrderIds={selectedOrderIds}
        deletingId={deletingId}
        swipedRowId={swipedRowId}
        expandedOrderId={expandedOrderId}
        completedActionsMenuId={completedActionsMenuId}
        toggleExpanded={toggleExpanded}
        toggleOrderSelection={toggleOrderSelection}
        goToOrderDetail={goToOrderDetail}
        duplicateOrder={duplicateOrder}
        handleDelete={handleDelete}
        handleSwipeLeft={handleSwipeLeft}
        handleSwipeCancel={handleSwipeCancel}
        supabase={supabase}
        handlePatched={handlePatched}
        onCompletedActionsMenuChange={handleCompletedActionsMenuChange}
      />
      {undoOrder ? (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[75] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white shadow-2xl lg:bottom-5 lg:left-[calc(15rem+1rem)]">
          <p className="min-w-0 flex-1 truncate text-sm">{undoOrder.title?.trim() || undoOrder.product_name} 주문을 휴지통으로 옮겼습니다.</p>
          <Button type="button" size="sm" variant="secondary" disabled={isUndoing} onClick={() => void undoDelete()}>
            {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            실행 취소
          </Button>
        </div>
      ) : null}
    </div>
  );
}
