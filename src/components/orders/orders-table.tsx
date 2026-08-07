"use client";

import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { getKoreaDateInputValue } from "@/lib/korea-date";
import { matchesPurchaseSchedule, type PurchaseScheduleFilter } from "@/lib/order-workflow";
import { getOrCreateUserPreferences, type LedgerDensity } from "@/lib/user-preferences";
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

function formatKrw(amount: number | string | null) {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return krwCurrencyFormatter.format(n);
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

function parseDepositAmountInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function profitFromDepositAndPurchase(deposit: number, purchase: number): number {
  return Math.round((deposit - purchase) * 100) / 100;
}

function addDaysToDateInput(value: string, days: number) {
  const base = value.trim() || getKoreaDateInputValue();
  const [year, month, day] = base.split("-").map(Number);
  if (!year || !month || !day) return getKoreaDateInputValue();
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function adjustDepositAmountInput(value: string, fallbackAmount: number | string, delta: number) {
  const current = parseDepositAmountInput(value) ?? (Number(fallbackAmount) || 0);
  return String(Math.max(0, current + delta));
}

function getDefaultDepositValues(row: OrderWithRelations) {
  return {
    date: row.deposit_date?.trim() || getKoreaDateInputValue(),
    amount:
      row.deposit_amount_krw != null
        ? String(row.deposit_amount_krw)
        : String(row.purchase_price_krw),
    memo: row.deposit_memo?.trim() ? row.deposit_memo : row.title?.trim() ?? "",
  };
}

/** 배송 상태와 입금액 조합이 평소 처리 기준과 다르면 완료 전 경고한다. */
function getDeliveryDepositWarning(row: OrderWithRelations, depositAmount: number) {
  const purchaseAmount = Number(row.purchase_price_krw);
  if (!Number.isFinite(purchaseAmount)) return null;
  const isSameAmount = depositAmount === purchaseAmount;
  if (!row.is_item_delivered && isSameAmount) {
    return "미배송 상품인데 구매금액과 입금금액이 같습니다. 처리하시겠습니까?";
  }
  if (row.is_item_delivered && !isSameAmount) {
    return "배송 상품인데 구매금액과 입금금액이 다릅니다. 처리하시겠습니까?";
  }
  return null;
}

/** 완료처리 전 금액과 배송 상태가 어긋나는 경우 운영자가 한 번 더 확인한다. */
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
      <span className={chipClassMaybeWrap} title="실 배송">
        {row.is_item_delivered ? (
          <PackageCheck className={cn(iconClass, "text-blue-600 dark:text-blue-400")} aria-hidden />
        ) : (
          <Package className={cn(iconClass, "text-slate-400 dark:text-slate-500")} aria-hidden />
        )}
        <span className={cn(chipText)}>{row.is_item_delivered ? "배송" : "미배송"}</span>
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
  const [depositDate, setDepositDate] = useState(() => getDefaultDepositValues(row).date);
  const [depositAmount, setDepositAmount] = useState(() => getDefaultDepositValues(row).amount);
  const [depositMemo, setDepositMemo] = useState(() => getDefaultDepositValues(row).memo);
  const pendingSubmitRef = useRef<{ date: string; amount: number } | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const defaults = getDefaultDepositValues(row);
    setDepositDate(defaults.date);
    setDepositAmount(defaults.amount);
    setDepositMemo(defaults.memo);
    pendingSubmitRef.current = null;
    setConfirmMessage(null);
  }, [row]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    scroll.scrollLeft = 0;
    setActivePage(0);
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

  const completeOrder = async (date: string, amount: number) => {
    setBusy(true);
    try {
      const purchase = Number(row.purchase_price_krw);
      const profit = profitFromDepositAndPurchase(amount, purchase);
      const { data, error } = await supabase
        .from("orders")
        .update({
          is_processed: true,
          deposit_date: date,
          deposit_amount_krw: amount,
          deposit_memo: depositMemo.trim() || null,
          profit_krw: profit,
        })
        .eq("id", row.id)
        .select(ORDER_LIST_SELECT)
        .single();
      if (error) {
        window.alert(error.message);
        return;
      }
      pendingSubmitRef.current = null;
      setConfirmMessage(null);
      onPatched(data as OrderWithRelations);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (skipWarning = false) => {
    const dd = depositDate.trim();
    if (!dd) {
      window.alert("완료처리를 하려면 입금일자 칸을 입력해야 됩니다.");
      return;
    }
    const dep = parseDepositAmountInput(depositAmount);
    if (dep === null) {
      window.alert("완료처리를 하려면 실입금금액 칸을 입력해야 됩니다.");
      return;
    }
    const warning = skipWarning ? null : getDeliveryDepositWarning(row, dep);
    if (warning) {
      pendingSubmitRef.current = { date: dd, amount: dep };
      setConfirmMessage(warning);
      return;
    }
    await completeOrder(dd, dep);
  };

  const confirmSubmit = () => {
    const pending = pendingSubmitRef.current;
    if (!pending) return;
    void completeOrder(pending.date, pending.amount);
  };

  const memoClass =
    "min-h-[4rem] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="mt-0">
      {confirmMessage ? (
        <DepositMismatchConfirmDialog
          message={confirmMessage}
          busy={busy}
          onCancel={() => {
            pendingSubmitRef.current = null;
            setConfirmMessage(null);
          }}
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
  const pendingSubmitRef = useRef<{ date: string; amount: number } | null>(null);
  const [depositDate, setDepositDate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMemo, setDepositMemo] = useState("");
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const defaults = getDefaultDepositValues(row);
    setDepositDate(defaults.date);
    setDepositAmount(defaults.amount);
    setDepositMemo(defaults.memo);
    pendingSubmitRef.current = null;
    setConfirmMessage(null);
  }, [isOpen, row]);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen, onClose]);

  const completeOrder = async (date: string, amount: number) => {
    setBusy(true);
    try {
      const purchase = Number(row.purchase_price_krw);
      const profit = profitFromDepositAndPurchase(amount, purchase);
      const { data, error } = await supabase
        .from("orders")
        .update({
          is_processed: true,
          deposit_date: date,
          deposit_amount_krw: amount,
          deposit_memo: depositMemo.trim() || null,
          profit_krw: profit,
        })
        .eq("id", row.id)
        .select(ORDER_LIST_SELECT)
        .single();
      if (error) {
        window.alert(error.message);
        return;
      }
      pendingSubmitRef.current = null;
      setConfirmMessage(null);
      onPatched(data as OrderWithRelations);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const submit = async (skipWarning = false) => {
    const dd = depositDate.trim();
    if (!dd) {
      window.alert("완료처리를 하려면 입금일자 칸을 입력해야 됩니다.");
      return;
    }
    const dep = parseDepositAmountInput(depositAmount);
    if (dep === null) {
      window.alert("완료처리를 하려면 실입금금액 칸을 입력해야 됩니다.");
      return;
    }
    const warning = skipWarning ? null : getDeliveryDepositWarning(row, dep);
    if (warning) {
      pendingSubmitRef.current = { date: dd, amount: dep };
      setConfirmMessage(warning);
      return;
    }
    await completeOrder(dd, dep);
  };

  const confirmSubmit = () => {
    const pending = pendingSubmitRef.current;
    if (!pending) return;
    void completeOrder(pending.date, pending.amount);
  };

  const memoClass =
    "min-h-[4.5rem] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div ref={wrapRef} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      {confirmMessage ? (
        <DepositMismatchConfirmDialog
          message={confirmMessage}
          busy={busy}
          onCancel={() => {
            pendingSubmitRef.current = null;
            setConfirmMessage(null);
          }}
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen, onClose]);

  const handleUncomplete = async () => {
    const ok = window.confirm(
      "이 주문을 미완료로 되돌릴까요? 입금일·입금금액·입금 메모는 비워집니다.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .update({
          is_processed: false,
          deposit_date: null,
          deposit_amount_krw: null,
          deposit_memo: null,
          profit_krw: null,
        })
        .eq("id", row.id)
        .select(ORDER_LIST_SELECT)
        .single();
      if (error) {
        window.alert(error.message);
        return;
      }
      onPatched(data as OrderWithRelations);
      onClose();
    } finally {
      setBusy(false);
    }
  };

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

function OrderExpandPanel({
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
  onPatchOrder: (o: OrderWithRelations) => void;
}) {
  const [uncompleteBusy, setUncompleteBusy] = useState(false);

  const handleUncomplete = async () => {
    const ok = window.confirm(
      "이 주문을 미완료로 되돌릴까요? 입금일·입금금액·입금 메모는 비워집니다.",
    );
    if (!ok) return;
    setUncompleteBusy(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .update({
          is_processed: false,
          deposit_date: null,
          deposit_amount_krw: null,
          deposit_memo: null,
          profit_krw: null,
        })
        .eq("id", row.id)
        .select(ORDER_LIST_SELECT)
        .single();
      if (error) {
        window.alert(error.message);
        return;
      }
      onPatchOrder(data as OrderWithRelations);
    } finally {
      setUncompleteBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/90 px-3 pb-3 pt-2.5 dark:border-slate-700 dark:bg-slate-900/35">
      {!row.is_processed ? (
        <MobilePendingDepositSwipePanel
          row={row}
          onEditOrder={onEditOrder}
          supabase={supabase}
          onPatched={onPatchOrder}
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
}

const OrderCardItem = memo(function OrderCardItem({
  row,
  isDeleting,
  isSwiped,
  isExpanded,
  onToggleExpand,
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
  onToggleExpand: () => void;
  onEditOrder: () => void;
  onDuplicateOrder: () => void;
  onDelete: () => void;
  onSwipeLeft: () => void;
  onSwipeCancel: () => void;
  supabase: ReturnType<typeof createClient>;
  onPatchOrder: (o: OrderWithRelations) => void;
}) {
  const touchStartXRef = useRef(0);
  const platformName = row.platforms?.name ?? "";
  const platformTone = getChipTone(row.platforms?.color ?? DEFAULT_PLATFORM_COLOR);
  const hasProfit = row.profit_krw !== null && Number(row.profit_krw) !== 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800">
      {/* 스와이프 삭제 영역 */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 transition-all duration-200",
          isSwiped ? "w-20" : "w-0",
        )}
      >
        {isSwiped && (
          <button
            type="button"
            aria-label="삭제"
            disabled={isDeleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
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
          isSwiped && "-translate-x-20",
        )}
        onClick={() => {
          if (isSwiped) { onSwipeCancel(); return; }
          onToggleExpand();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleExpand(); }
        }}
        aria-expanded={isExpanded}
        onTouchStart={(e) => { touchStartXRef.current = e.changedTouches[0]?.clientX ?? 0; }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? 0;
          const diff = touchStartXRef.current - endX;
          if (diff > 50) { onSwipeLeft(); return; }
          if (diff < -35 && isSwiped) { onSwipeCancel(); }
        }}
      >
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
      {isExpanded ? (
        <OrderExpandPanel row={row} onEditOrder={onEditOrder} onDuplicateOrder={onDuplicateOrder} supabase={supabase} onPatchOrder={onPatchOrder} />
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
  | "undelivered"
  | "scheduleToday"
  | "overdue"
  | "scheduleUpcoming"
  | "missingDeposit"
  | "missingAi"
  | "missingTemplate";
type OrderSort = "newest" | "oldest" | "amountDesc" | "amountAsc";
type SavedOrderView = Database["public"]["Tables"]["saved_order_views"]["Row"];

type OrderFilterSnapshot = {
  q: string;
  status: OrderStatusFilter;
  attention: OrderAttentionFilter;
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
  "undelivered",
  "scheduleToday",
  "overdue",
  "scheduleUpcoming",
  "missingDeposit",
  "missingAi",
  "missingTemplate",
];
const orderSorts: OrderSort[] = ["newest", "oldest", "amountDesc", "amountAsc"];

function readSavedFilterSnapshot(value: Json): OrderFilterSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const readText = (key: keyof OrderFilterSnapshot) => typeof value[key] === "string" ? value[key] : "";
  const status = readText("status") as OrderStatusFilter;
  const attention = readText("attention") as OrderAttentionFilter;
  const sort = readText("sort") as OrderSort;
  if (!orderStatusFilters.includes(status) || !orderAttentionFilters.includes(attention) || !orderSorts.includes(sort)) {
    return null;
  }
  return {
    q: readText("q"),
    status,
    attention,
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

      if (filters.attention === "undelivered" && order.is_item_delivered) return false;
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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
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
  }, [items.length, totalSize, updateViewport]);

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

export function OrdersTable({
  userId,
  pendingOrders,
  completedOrders,
  counts,
  isCountsLoading,
  isPendingLoading,
  isCompletedLoading,
  onLoadCompleted,
  onOrderPatched,
  onOrderDeleted,
}: {
  userId: string;
  pendingOrders: OrderWithRelations[];
  completedOrders: OrderWithRelations[] | null;
  counts: OrderListCounts;
  isCountsLoading: boolean;
  isPendingLoading: boolean;
  isCompletedLoading: boolean;
  onLoadCompleted: () => Promise<void>;
  onOrderPatched: (previous: OrderWithRelations, updated: OrderWithRelations) => void;
  onOrderDeleted: (deleted: OrderWithRelations) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(() => {
    const value = searchParams.get("status") as OrderStatusFilter;
    return orderStatusFilters.includes(value) ? value : "all";
  });
  const [attentionFilter, setAttentionFilter] = useState<OrderAttentionFilter>(() => {
    const value = searchParams.get("attention") as OrderAttentionFilter;
    return orderAttentionFilters.includes(value) ? value : "all";
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
  const [savedViews, setSavedViews] = useState<SavedOrderView[]>([]);
  const [density, setDensity] = useState<LedgerDensity>("compact");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null);
  const [showCompletedOrders, setShowCompletedOrders] = useState(
    statusFilter === "completed" || attentionFilter === "missingDeposit",
  );
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [pendingCompleteMenuId, setPendingCompleteMenuId] = useState<string | null>(null);
  const [completedActionsMenuId, setCompletedActionsMenuId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);
  const completedList = useMemo(() => completedOrders ?? [], [completedOrders]);

  const filterSnapshot = useMemo<OrderFilterSnapshot>(() => ({
    q: deferredSearch,
    status: statusFilter,
    attention: attentionFilter,
    from: fromDate,
    to: toDate,
    sort,
    platform: platformFilter,
    payment: paymentFilter,
    account: accountFilter,
  }), [
    accountFilter,
    attentionFilter,
    deferredSearch,
    fromDate,
    paymentFilter,
    platformFilter,
    sort,
    statusFilter,
    toDate,
  ]);

  const pendingSearchableOrders = useMemo(() => prepareSearchableOrders(pendingOrders), [pendingOrders]);
  const completedSearchableOrders = useMemo(() => prepareSearchableOrders(completedList), [completedList]);

  const visiblePendingOrders = useMemo(
    () => statusFilter === "completed" ? [] : filterSearchableOrders(pendingSearchableOrders, filterSnapshot),
    [filterSnapshot, pendingSearchableOrders, statusFilter],
  );

  const visibleCompletedOrders = useMemo(
    () => statusFilter === "pending" ? [] : filterSearchableOrders(completedSearchableOrders, filterSnapshot),
    [completedSearchableOrders, filterSnapshot, statusFilter],
  );

  const totalCount = counts.total;
  const pendingCount = counts.pending;
  const completedCount = counts.completed;
  const completedPct =
    totalCount !== null && completedCount !== null && totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : null;

  const filterOptions = useMemo(() => {
    const allOrders = [...pendingOrders, ...completedList];
    return {
      platforms: [...new Set(allOrders.map((order) => order.platforms?.name).filter((name): name is string => Boolean(name)))].sort(),
      payments: [...new Set(allOrders.map((order) => order.payment_methods?.name).filter((name): name is string => Boolean(name)))].sort(),
      accounts: [...new Set(allOrders.map((order) => order.buyer_accounts?.label).filter((name): name is string => Boolean(name)))].sort(),
    };
  }, [completedList, pendingOrders]);

  const currentFilterSnapshot = useMemo<OrderFilterSnapshot>(() => ({
    q: search,
    status: statusFilter,
    attention: attentionFilter,
    from: fromDate,
    to: toDate,
    sort,
    platform: platformFilter,
    payment: paymentFilter,
    account: accountFilter,
  }), [accountFilter, attentionFilter, fromDate, paymentFilter, platformFilter, search, sort, statusFilter, toDate]);

  const applyFilterSnapshot = useCallback((next: OrderFilterSnapshot) => {
    setSearch(next.q);
    setStatusFilter(next.status);
    setAttentionFilter(next.attention);
    setFromDate(next.from);
    setToDate(next.to);
    setSort(next.sort);
    setPlatformFilter(next.platform);
    setPaymentFilter(next.payment);
    setAccountFilter(next.account);
  }, []);

  useEffect(() => {
    const nextStatus = searchParams.get("status") as OrderStatusFilter;
    const nextAttention = searchParams.get("attention") as OrderAttentionFilter;
    const nextSort = searchParams.get("sort") as OrderSort;
    applyFilterSnapshot({
      q: searchParams.get("q") ?? "",
      status: orderStatusFilters.includes(nextStatus) ? nextStatus : "all",
      attention: orderAttentionFilters.includes(nextAttention) ? nextAttention : "all",
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

  useEffect(() => {
    if (statusFilter !== "completed" && attentionFilter !== "missingDeposit") return;
    setShowCompletedOrders(true);
    void onLoadCompleted();
  }, [attentionFilter, onLoadCompleted, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams();
      if (search.trim()) nextParams.set("q", search.trim());
      if (statusFilter !== "all") nextParams.set("status", statusFilter);
      if (attentionFilter !== "all") nextParams.set("attention", attentionFilter);
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

  const setQuickFilter = (key: "all" | "pending" | Exclude<OrderAttentionFilter, "all">) => {
    if (key === "all") {
      setStatusFilter("all");
      setAttentionFilter("all");
      return;
    }
    if (key === "pending") {
      setStatusFilter("pending");
      setAttentionFilter("all");
      return;
    }
    if (key === "missingDeposit") {
      setStatusFilter("completed");
      setAttentionFilter("missingDeposit");
      return;
    }
    setStatusFilter(
      key === "undelivered" || key === "scheduleToday" || key === "overdue" || key === "scheduleUpcoming"
        ? "pending"
        : "all",
    );
    setAttentionFilter(key);
  };

  const activeQuickFilter = statusFilter === "pending" && attentionFilter === "all"
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

  const toggleExpanded = (id: string) => {
    setPendingCompleteMenuId(null);
    setCompletedActionsMenuId(null);
    setExpandedOrderId((prev) => (prev === id ? null : id));
  };

  const goToOrderDetail = (id: string) => {
    router.push(`/orders/detail?id=${encodeURIComponent(id)}`);
  };

  const handlePatched = useCallback(
    (previous: OrderWithRelations, updated: OrderWithRelations) => {
      setPendingCompleteMenuId(null);
      setCompletedActionsMenuId(null);
      setExpandedOrderId((prev) => (prev === previous.id && previous.is_processed !== updated.is_processed ? null : prev));
      onOrderPatched(previous, updated);
    },
    [onOrderPatched],
  );

  const handleDelete = async (row: OrderWithRelations) => {
    const confirmed = window.confirm(`"${row.product_name}" 주문을 삭제할까요?`);
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      const { error } = await supabase.from("orders").delete().eq("id", row.id);
      if (error) {
        window.alert(`삭제 중 오류: ${error.message}`);
        return;
      }
      onOrderDeleted(row);
      setSwipedRowId((prev) => (prev === row.id ? null : prev));
      setExpandedOrderId((prev) => (prev === row.id ? null : prev));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleCompletedOrders = () => {
    const next = !showCompletedOrders;
    setShowCompletedOrders(next);
    if (!next) return;
    void onLoadCompleted();
  };

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

  const pendingMobileVirtual = useVirtualRange(visiblePendingOrders, mobilePendingSize);
  const pendingTableVirtual = useVirtualRange(visiblePendingOrders, tableRowSize);
  const completedMobileVirtual = useVirtualRange(visibleCompletedOrders, mobileCompletedSize);
  const completedTableVirtual = useVirtualRange(visibleCompletedOrders, tableRowSize);

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
          <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
            <Button
              type="button"
              variant={showAdvancedFilter ? "default" : "outline"}
              size="sm"
              className="h-10 gap-1.5"
              onClick={() => setShowAdvancedFilter((current) => !current)}
            >
              <Filter className="h-4 w-4" aria-hidden />
              상세
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5" onClick={toggleDensity}>
              <Rows3 className="h-4 w-4" aria-hidden />
              {density === "compact" ? "촘촘하게" : "편안하게"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-10 gap-1.5" onClick={() => void saveCurrentView()}>
              <Save className="h-4 w-4" aria-hidden />
              보기 저장
            </Button>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {([
            ["all", "전체"],
            ["pending", "미완료"],
            ["undelivered", "미배송"],
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

      {/* ── 미완료 주문 섹션 ───────────────────────── */}
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
              ref={pendingTableVirtual.scrollRef}
              onScroll={pendingTableVirtual.onScroll}
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
                    {pendingTableVirtual.topPadding > 0 ? (
                      <TableRow aria-hidden>
                        <TableCell colSpan={6} className="border-0 p-0" style={{ height: pendingTableVirtual.topPadding }} />
                      </TableRow>
                    ) : null}
                    {pendingTableVirtual.virtualItems.map(({ item: row }) => (
                      <TableRow
                        key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`${row.product_name} 주문 상세`}
                      className="group cursor-pointer border-l-2 border-l-amber-400/90 bg-amber-50/30 transition-colors hover:bg-amber-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-l-amber-500/50 dark:hover:bg-amber-500/10"
                      onClick={() => goToOrderDetail(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToOrderDetail(row.id);
                        }
                      }}
                    >
                      <TableCell className={cn("relative max-w-[14rem] px-3 pr-20", density === "compact" ? "py-2" : "py-4")}>
                        <div>
                          {row.title?.trim() ? (
                            <p className="text-muted-foreground line-clamp-1 text-xs">{row.title}</p>
                          ) : null}
                          <p className="line-clamp-1 font-semibold">{row.product_name}</p>
                          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                            {row.notes?.trim() || "메모 없음"}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="주문 복제"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            router.push(`/orders/new?copy=${encodeURIComponent(row.id)}`);
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
                          <WebPendingCompleteDropdown
                            row={row}
                            isOpen={pendingCompleteMenuId === row.id}
                            onClose={() => setPendingCompleteMenuId(null)}
                          onToggle={() =>
                            setPendingCompleteMenuId((prev) => (prev === row.id ? null : row.id))
                          }
                          supabase={supabase}
                          onPatched={(updated) => handlePatched(row, updated)}
                        />
                      </TableCell>
                    </TableRow>
                    ))}
                    {pendingTableVirtual.bottomPadding > 0 ? (
                      <TableRow aria-hidden>
                        <TableCell colSpan={6} className="border-0 p-0" style={{ height: pendingTableVirtual.bottomPadding }} />
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
            ref={pendingMobileVirtual.scrollRef}
            onScroll={pendingMobileVirtual.onScroll}
            className="mt-4 max-h-[22rem] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y"
          >
            {isPendingLoading ? (
              <OrderListLoading label="미완료 주문" />
            ) : visiblePendingOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">조건에 맞는 미완료 주문이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pendingMobileVirtual.topPadding > 0 ? <div aria-hidden style={{ height: pendingMobileVirtual.topPadding }} /> : null}
                {pendingMobileVirtual.virtualItems.map(({ item: row }) => (
                  <OrderCardItem
                    key={row.id}
                    row={row}
                    isDeleting={deletingId === row.id}
                    isSwiped={swipedRowId === row.id}
                    isExpanded={expandedOrderId === row.id}
                    onToggleExpand={() => toggleExpanded(row.id)}
                    onEditOrder={() => goToOrderDetail(row.id)}
                    onDuplicateOrder={() => router.push(`/orders/new?copy=${encodeURIComponent(row.id)}`)}
                    onDelete={() => void handleDelete(row)}
                    onSwipeLeft={() => setSwipedRowId(row.id)}
                    onSwipeCancel={() => setSwipedRowId(null)}
                    supabase={supabase}
                    onPatchOrder={(updated) => handlePatched(row, updated)}
                  />
                ))}
                {pendingMobileVirtual.bottomPadding > 0 ? <div aria-hidden style={{ height: pendingMobileVirtual.bottomPadding }} /> : null}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 완료 주문 섹션 ─────────────────────────── */}
      <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-card shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]", density === "compact" ? "p-3" : "p-4")}>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleToggleCompletedOrders}
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
                ref={completedTableVirtual.scrollRef}
                onScroll={completedTableVirtual.onScroll}
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
                    {completedTableVirtual.topPadding > 0 ? (
                      <TableRow aria-hidden>
                        <TableCell colSpan={7} className="border-0 p-0" style={{ height: completedTableVirtual.topPadding }} />
                      </TableRow>
                    ) : null}
                    {completedTableVirtual.virtualItems.map(({ item: row }) => (
                      <TableRow
                        key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`${row.product_name} 주문 상세`}
                      className="group cursor-pointer border-l-2 border-l-emerald-400/70 bg-emerald-50/20 transition-colors hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-l-emerald-500/50 dark:hover:bg-emerald-500/10"
                      onClick={() => goToOrderDetail(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToOrderDetail(row.id);
                        }
                      }}
                    >
                      <TableCell className={cn("relative max-w-[14rem] px-3 pr-20", density === "compact" ? "py-2" : "py-4")}>
                        <div>
                          {row.title?.trim() ? (
                            <p className="text-muted-foreground line-clamp-1 text-xs">{row.title}</p>
                          ) : null}
                          <p className="line-clamp-1 font-semibold">{row.product_name}</p>
                          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
                            {row.notes?.trim() || "메모 없음"}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="주문 복제"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            router.push(`/orders/new?copy=${encodeURIComponent(row.id)}`);
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
                        <WebCompletedActionsDropdown
                          row={row}
                          isOpen={completedActionsMenuId === row.id}
                          onClose={() => setCompletedActionsMenuId(null)}
                          onToggle={() =>
                            setCompletedActionsMenuId((prev) => (prev === row.id ? null : row.id))
                          }
                          onEditOrder={() => {
                            setCompletedActionsMenuId(null);
                            goToOrderDetail(row.id);
                          }}
                          supabase={supabase}
                          onPatched={(updated) => handlePatched(row, updated)}
                        />
                      </TableCell>
                    </TableRow>
                    ))}
                    {completedTableVirtual.bottomPadding > 0 ? (
                      <TableRow aria-hidden>
                        <TableCell colSpan={7} className="border-0 p-0" style={{ height: completedTableVirtual.bottomPadding }} />
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
              ref={completedMobileVirtual.scrollRef}
              onScroll={completedMobileVirtual.onScroll}
              className="mt-4 max-h-[22rem] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y"
            >
              {isCompletedLoading && completedOrders === null ? (
                <OrderListLoading label="완료 주문" />
              ) : visibleCompletedOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm">조건에 맞는 완료 주문이 없습니다.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {completedMobileVirtual.topPadding > 0 ? <div aria-hidden style={{ height: completedMobileVirtual.topPadding }} /> : null}
                  {completedMobileVirtual.virtualItems.map(({ item: row }) => (
                    <OrderCardItem
                      key={row.id}
                      row={row}
                      isDeleting={deletingId === row.id}
                      isSwiped={swipedRowId === row.id}
                      isExpanded={expandedOrderId === row.id}
                      onToggleExpand={() => toggleExpanded(row.id)}
                      onEditOrder={() => goToOrderDetail(row.id)}
                      onDuplicateOrder={() => router.push(`/orders/new?copy=${encodeURIComponent(row.id)}`)}
                      onDelete={() => void handleDelete(row)}
                      onSwipeLeft={() => setSwipedRowId(row.id)}
                      onSwipeCancel={() => setSwipedRowId(null)}
                      supabase={supabase}
                      onPatchOrder={(updated) => handlePatched(row, updated)}
                    />
                  ))}
                  {completedMobileVirtual.bottomPadding > 0 ? <div aria-hidden style={{ height: completedMobileVirtual.bottomPadding }} /> : null}
                </div>
              )}
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
