"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bot,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Hash,
  ListChecks,
  Loader2,
  MessageCircle,
  Sparkles,
  UserCircle,
  Wallet,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EntitySelect } from "@/components/ui/entity-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { getKoreaDateInputValue } from "@/lib/korea-date";
import { normalizeOrderMatchText } from "@/lib/order-workflow";
import { streamAiReviewFromEdge } from "@/lib/stream-ai-review";
import { createClient } from "@/lib/supabase/client";
import type { BuyerAccount, PaymentMethod, Platform } from "@/lib/master-data";
import {
  getOrCreateUserPreferences,
  type OrderSaveAction,
  type UserPreferences,
} from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import type { OrderRow, OrderWithRelations } from "@/types/orders";

type DraftOrderWithRelations = Partial<
  Omit<
    OrderWithRelations,
    "id" | "user_id" | "product_name" | "purchase_date" | "purchase_price_krw" | "is_item_delivered" | "is_processed"
  >
> & {
  id: string;
  user_id: string;
  product_name?: string | null;
  purchase_date?: string | null;
  purchase_price_krw?: number | null;
  is_item_delivered?: boolean | null;
  is_processed?: boolean | null;
};

type ImportActions = {
  onSave: (payload: Database["public"]["Tables"]["orders"]["Insert"]) => Promise<{ error?: string; redirectHref?: string }>;
  onDelete: () => Promise<{ error?: string; redirectHref?: string }>;
  afterSaveHref: string;
  afterDeleteHref: string;
  deleteConfirmLabel?: string;
};

type NewOrderDraft = {
  version: 1;
  title: string;
  order_number: string;
  product_name: string;
  platform_id: string;
  payment_method_id: string;
  buyer_account_ids: string[];
  purchase_info_template_id: string;
  purchase_date: string;
  purchase_price: string;
  review_photo_count: string;
  review_char_count: string;
  is_item_delivered: string;
  is_processed: string;
  deposit_date: string;
  deposit_amount: string;
  deposit_memo: string;
  notes: string;
  product_url: string;
  scheduled_purchase_at: string;
  order_status: string;
  ai_review_user_prompt: string;
};

type UserOrderDraftData = Database["public"]["Tables"]["user_order_drafts"]["Row"]["draft_data"];

type DuplicateCandidate = Pick<
  OrderRow,
  "id" | "title" | "product_name" | "purchase_date" | "order_number" | "buyer_account_id" | "purchase_price_krw"
>;

function parseNewOrderDraft(value: Database["public"]["Tables"]["user_order_drafts"]["Row"]["draft_data"]): NewOrderDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) return null;

  const readText = (key: keyof NewOrderDraft) => {
    const field = value[key];
    return typeof field === "string" ? field : "";
  };
  const accountIds = Array.isArray(value.buyer_account_ids)
    ? value.buyer_account_ids.filter((id): id is string => typeof id === "string")
    : [];

  return {
    version: 1,
    title: readText("title"),
    order_number: readText("order_number"),
    product_name: readText("product_name"),
    platform_id: readText("platform_id"),
    payment_method_id: readText("payment_method_id"),
    buyer_account_ids: accountIds,
    purchase_info_template_id: readText("purchase_info_template_id"),
    purchase_date: readText("purchase_date"),
    purchase_price: readText("purchase_price"),
    review_photo_count: readText("review_photo_count"),
    review_char_count: readText("review_char_count"),
    is_item_delivered: readText("is_item_delivered"),
    is_processed: readText("is_processed"),
    deposit_date: readText("deposit_date"),
    deposit_amount: readText("deposit_amount"),
    deposit_memo: readText("deposit_memo"),
    notes: readText("notes"),
    product_url: readText("product_url"),
    scheduled_purchase_at: readText("scheduled_purchase_at"),
    order_status: readText("order_status"),
    ai_review_user_prompt: readText("ai_review_user_prompt"),
  };
}

export type OrderFormSummary = {
  title: string;
  productName: string;
  purchasePrice: number;
  depositAmount: number;
  isProcessed: boolean;
  isItemDelivered: boolean | null;
  platformName: string;
  paymentMethodName: string;
  buyerAccountNames: string[];
  templateName: string;
  scheduledPurchaseAt: string;
  missingFields: string[];
  duplicateCount: number;
};

/** buildPayload와 동일 범위의 필드만 비교(저장 여부 판단) */
type OrderFormSnapshot = {
  title: string;
  order_number: string;
  product_name: string;
  platform_id: string;
  payment_method_id: string;
  buyer_account_id: string;
  purchase_info_template_id: string;
  purchase_date: string;
  deposit_date: string;
  deposit_amount: string;
  purchase_price: string;
  review_photo: string;
  review_char: string;
  is_item_delivered: string;
  is_processed: string;
  deposit_memo: string;
  notes: string;
  product_url: string;
  scheduled_purchase_at: string;
  order_status: string;
  ai_review_user_prompt: string;
};

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function orderRowToSnapshot(o: OrderWithRelations): OrderFormSnapshot {
  return {
    title: (o.title ?? "").trim(),
    order_number: (o.order_number ?? "").trim(),
    product_name: (o.product_name ?? "").trim(),
    platform_id: o.platform_id ?? "",
    payment_method_id: o.payment_method_id ?? "",
    buyer_account_id: o.buyer_account_id ?? "",
    purchase_info_template_id: o.purchase_info_template_id ?? "",
    purchase_date: o.purchase_date ?? "",
    deposit_date: o.deposit_date ?? "",
    deposit_amount: o.deposit_amount_krw != null ? String(o.deposit_amount_krw) : "",
    purchase_price: String(o.purchase_price_krw ?? ""),
    review_photo: o.review_photo_count != null ? String(o.review_photo_count) : "",
    review_char: o.review_char_count != null ? String(o.review_char_count) : "",
    is_item_delivered: o.is_item_delivered ? "true" : "false",
    is_processed: o.is_processed ? "true" : "false",
    deposit_memo: (o.deposit_memo ?? "").trim(),
    notes: (o.notes ?? "").trim(),
    product_url: (o.product_url ?? "").trim(),
    scheduled_purchase_at: toDateTimeLocalValue(o.scheduled_purchase_at),
    order_status: (o.order_status ?? "").trim(),
    ai_review_user_prompt: (o.ai_review_user_prompt ?? "").trim(),
  };
}

function formatKrw(amount: number | string | null) {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(isoDate: string | null) {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(isoDate + "T00:00:00"));
}

const chevronDownBg =
  "[background-image:url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2720%27%20height=%2720%27%20fill=%27none%27%20stroke=%27%2364748b%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E')]";

const controlSelectClass = cn(
  "h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-background bg-[length:1rem_1rem] bg-[right_0.65rem_center] bg-no-repeat px-3 pr-10 text-sm outline-none transition-colors",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
  "dark:bg-input/30",
  chevronDownBg,
);

const controlTextareaClass = cn(
  "min-h-[5.5rem] w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors",
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
  "dark:bg-input/30",
);

type ToastState = { type: "error" | "success"; message: string };

type OrderPayloadBuildResult = {
  payloads?: Database["public"]["Tables"]["orders"]["Insert"][];
  error?: string;
};

const PURCHASE_INFO_HINTS = {
  kakaoRoom: "카톡방 이름을 입력해주세요",
  product: "알아보기 쉽게 물품명을 입력해주세요",
  delivery: "실 배송 여부를 선택해주세요",
} as const;

const TOAST_MS = 3000;

function normalizeNumber(value: unknown, fieldLabel: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return { error: `${fieldLabel}을(를) 입력해 주세요.` as const };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${fieldLabel}은(는) 0 이상의 숫자만 입력할 수 있습니다.` as const };
  }

  return { value: parsed };
}

function normalizeOptionalNumber(value: unknown, fieldLabel: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return { value: null };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: `${fieldLabel}은(는) 0 이상의 숫자만 입력할 수 있습니다.` as const };
  }

  return { value: parsed };
}

function OrderFormToast({ toast }: { toast: ToastState }) {
  const isError = toast.type === "error";
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-5 sm:p-8">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={cn(
          "w-full max-w-md rounded-2xl border px-5 py-4 text-center shadow-xl ring-1 ring-black/10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 dark:ring-white/10 sm:max-w-lg sm:px-6 sm:py-5",
          isError
            ? "border-red-600 bg-white text-red-900 dark:border-red-400 dark:bg-zinc-950 dark:text-red-50"
            : "border-emerald-600 bg-white text-emerald-950 dark:border-emerald-500 dark:bg-zinc-950 dark:text-emerald-50",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          {isError ? (
            <AlertCircle className="h-7 w-7 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          ) : (
            <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          )}
          <p className="w-full break-words text-sm font-medium leading-relaxed sm:text-[0.9375rem]">
            {toast.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function FormRow({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 py-4">
      <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <Label className="text-foreground text-sm font-medium">
          {label}
          {required ? <span className="text-destructive ml-0.5">*</span> : null}
        </Label>
        {hint ? <span className="text-muted-foreground text-xs font-normal">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function OrderSummaryHero({ order }: { order: OrderWithRelations }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-brand-deep bg-gradient-to-br from-brand-deep via-[#1b286f] to-brand-deep p-5 text-white shadow-md ring-1 ring-white/10">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-40 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-white/55">주문 상세</p>
          <h2 className="text-lg font-semibold leading-snug tracking-tight break-words text-white sm:text-xl">
            {order.product_name}
          </h2>
          {order.title?.trim() ? (
            <p className="flex items-start gap-1.5 text-sm text-white/75">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />
              <span className="line-clamp-2">{order.title}</span>
            </p>
          ) : null}
          {order.order_number?.trim() ? (
            <p className="flex items-start gap-1.5 text-sm text-white/70">
              <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/45" aria-hidden />
              <span className="line-clamp-2 tabular-nums">{order.order_number.trim()}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              order.is_processed
                ? "bg-emerald-500/15 text-emerald-100 ring-emerald-400/35"
                : "bg-amber-400/15 text-amber-50 ring-amber-300/40",
            )}
          >
            {order.is_processed ? "입금 완료" : "입금 미완료"}
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              order.is_item_delivered
                ? "bg-sky-500/15 text-sky-50 ring-sky-300/35"
                : "bg-white/10 text-white/75 ring-white/15",
            )}
          >
            {order.is_item_delivered ? "배송" : "미배송"}
          </span>
        </div>
      </div>
      <dl className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] font-medium text-white/50">
            <Wallet className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            구매 금액
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold tabular-nums sm:text-base">
            {formatKrw(order.purchase_price_krw)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] font-medium text-white/50">
            <CalendarDays className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            구매일
          </dt>
          <dd className="mt-1 text-sm font-semibold">{formatDate(order.purchase_date)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] font-medium text-white/50">
            <Building2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            플랫폼
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold">{order.platforms?.name ?? "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[11px] font-medium text-white/50">
            <UserCircle className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            계정
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold">{order.buyer_accounts?.label ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

type AiReviewPanelProps = {
  order: OrderWithRelations;
  supabase: ReturnType<typeof createClient>;
  isSaving: boolean;
  aiExtraInput: string;
  onAiExtraInputChange: (value: string) => void;
  reviewCharCount: string;
  isProcessed: boolean;
  buildPayload: (nextIsProcessed: boolean) => OrderPayloadBuildResult;
  onToast: (toast: ToastState | null) => void;
};

const AiReviewPanel = memo(function AiReviewPanel({
  order,
  supabase,
  isSaving,
  aiExtraInput,
  onAiExtraInputChange,
  reviewCharCount,
  isProcessed,
  buildPayload,
  onToast,
}: AiReviewPanelProps) {
  const [aiReviewText, setAiReviewText] = useState(order.ai_review ?? "");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStreamError, setAiStreamError] = useState<string | null>(null);
  const lastAiOrderIdRef = useRef<string | undefined>(undefined);
  /** 부모 `order.ai_review` 중 마지막으로 반영한 값(재생성 직후 DB는 아직 옛값일 때 로컬 결과를 덮지 않기 위함) */
  const lastSyncedServerAiReviewRef = useRef<string | undefined>(undefined);
  const aiReviewTextRef = useRef(order.ai_review ?? "");
  const aiReviewFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const fromDb = order.ai_review ?? "";
    if (order.id !== lastAiOrderIdRef.current) {
      lastAiOrderIdRef.current = order.id;
      lastSyncedServerAiReviewRef.current = fromDb;
      aiReviewTextRef.current = fromDb;
      setAiReviewText(fromDb);
      return;
    }
    if (aiGenerating) return;
    if (fromDb === lastSyncedServerAiReviewRef.current) return;
    lastSyncedServerAiReviewRef.current = fromDb;
    aiReviewTextRef.current = fromDb;
    setAiReviewText(fromDb);
  }, [order.ai_review, order.id, aiGenerating]);

  const appendAiReviewDelta = useCallback((chunk: string) => {
    aiReviewTextRef.current += chunk;
    if (aiReviewFrameRef.current !== null) return;

    aiReviewFrameRef.current = window.requestAnimationFrame(() => {
      aiReviewFrameRef.current = null;
      setAiReviewText(aiReviewTextRef.current);
    });
  }, []);

  const flushAiReviewText = useCallback(() => {
    if (aiReviewFrameRef.current !== null) {
      window.cancelAnimationFrame(aiReviewFrameRef.current);
      aiReviewFrameRef.current = null;
    }
    setAiReviewText(aiReviewTextRef.current);
  }, []);

  useEffect(
    () => () => {
      if (aiReviewFrameRef.current !== null) {
        window.cancelAnimationFrame(aiReviewFrameRef.current);
      }
    },
    [],
  );

  const copyAiReviewResult = async () => {
    const t = aiReviewText.trim();
    if (!t) {
      onToast({ type: "error", message: "복사할 리뷰 내용이 없습니다." });
      return;
    }
    try {
      await copyTextToClipboard(t);
      onToast({ type: "success", message: "클립보드에 복사했습니다." });
    } catch {
      onToast({ type: "error", message: "복사에 실패했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요." });
    }
  };

  const runAiReviewGeneration = async () => {
    if (!order.id) return;
    setAiStreamError(null);
    setAiGenerating(true);

    const { payloads, error: payloadError } = buildPayload(isProcessed);
    if (payloadError || !payloads) {
      setAiGenerating(false);
      onToast({ type: "error", message: payloadError ?? "입력값을 확인해 주세요." });
      return;
    }

    const { error: preSaveError } = await supabase
      .from("orders")
      .update(payloads[0])
      .eq("id", order.id)
      .is("deleted_at", null);
    if (preSaveError) {
      setAiGenerating(false);
      onToast({ type: "error", message: preSaveError.message });
      return;
    }

    aiReviewTextRef.current = "";
    setAiReviewText("");
    try {
      const rcTrim = reviewCharCount.trim().replace(/,/g, "");
      let reviewCharCountForAi: number | null = null;
      if (rcTrim) {
        const n = Number(rcTrim);
        if (Number.isFinite(n) && n > 0) reviewCharCountForAi = Math.floor(n);
      }
      const result = await streamAiReviewFromEdge(supabase, {
        orderId: order.id,
        userPrompt: aiExtraInput,
        reviewCharCount: reviewCharCountForAi,
        onDelta: appendAiReviewDelta,
      });
      if (!result.ok) {
        setAiStreamError(result.error);
        onToast({ type: "error", message: result.error });
      } else {
        onToast({ type: "success", message: "AI 리뷰가 생성되어 저장되었습니다." });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiStreamError(msg);
      onToast({ type: "error", message: msg });
    } finally {
      flushAiReviewText();
      setAiGenerating(false);
    }
  };

  return (
    <details className="group rounded-2xl border bg-card text-card-foreground shadow-sm ring-1 ring-border/60">
      <summary className="cursor-pointer list-none border-border/60 px-4 py-4 marker:hidden group-open:border-b">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-800 ring-1 ring-violet-500/20 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/25">
            <Bot className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">AI 리뷰</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              OpenAI로 초안을 만들고 이 주문에 자동 저장합니다. 생성되는 문장은 바로 표시되며, 다른 화면으로 이동해도 서버에서 끝까지 처리된 뒤 저장됩니다.
            </CardDescription>
          </div>
          <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground group-open:hidden">펼치기</span>
          <span className="ml-auto hidden shrink-0 text-xs font-medium text-muted-foreground group-open:inline">접기</span>
        </div>
      </summary>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2 py-2">
          <Label className="text-foreground text-sm font-medium">AI에게 전달할 추가 정보</Label>
          <p className="text-muted-foreground text-xs">
            상품 특징·촬영 조건·톤 등 리뷰에 반영하고 싶은 내용을 적어 주세요. 비워도 됩니다.
          </p>
          <textarea
            rows={3}
            value={aiExtraInput}
            onChange={(e) => onAiExtraInputChange(e.target.value)}
            disabled={aiGenerating}
            className={controlTextareaClass}
            placeholder="예: 배송 빨랐고 포장 꼼꼼함을 강조해 줘"
          />
        </div>
        <button
          type="button"
          disabled={aiGenerating || isSaving}
          onClick={() => void runAiReviewGeneration()}
          className={cn(
            buttonVariants({ variant: "default", size: "default" }),
            "h-11 w-full touch-manipulation sm:w-auto",
          )}
        >
          {aiGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              생성 중…
            </>
          ) : (
            "AI리뷰 생성하기"
          )}
        </button>
        {aiStreamError ? (
          <p className="text-destructive text-sm" role="alert">
            {aiStreamError}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label className="text-foreground text-sm font-medium">결과</Label>
          <p className="text-muted-foreground text-xs">
            아래 영역을 누르면 표시된 리뷰 전체가 클립보드에 복사됩니다.
          </p>
          <textarea
            readOnly
            rows={10}
            value={aiReviewText}
            onClick={() => void copyAiReviewResult()}
            title={aiReviewText.trim() ? "탭하면 전체가 클립보드에 복사됩니다" : undefined}
            className={cn(
              controlTextareaClass,
              "min-h-[12rem] cursor-pointer touch-manipulation bg-muted/20",
              "hover:bg-muted/40 active:bg-muted/55",
            )}
            placeholder={aiGenerating ? "답변을 불러오는 중…" : "생성된 리뷰가 여기에 표시됩니다."}
            aria-live="polite"
          />
        </div>
      </CardContent>
    </details>
  );
});

const AdditionalOrderInfoSection = memo(function AdditionalOrderInfoSection({
  scheduledPurchaseAt,
  onScheduledPurchaseAtChange,
  orderStatus,
  onOrderStatusChange,
  productUrl,
  onProductUrlChange,
  notes,
  onNotesChange,
}: {
  scheduledPurchaseAt: string;
  onScheduledPurchaseAtChange: (value: string) => void;
  orderStatus: string;
  onOrderStatusChange: (value: string) => void;
  productUrl: string;
  onProductUrlChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <details
      className="group rounded-2xl border bg-card text-card-foreground shadow-sm ring-1 ring-border/60"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300">
            <CalendarClock className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">추가 정보</span>
            <span className="block text-xs text-muted-foreground">구매 일정·상품 링크·메모</span>
          </span>
        </span>
        <span className="text-xs font-medium text-muted-foreground group-open:hidden">펼치기</span>
        <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">접기</span>
      </summary>
      <div className="border-t border-border/60 px-4 pb-2">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormRow label="구매 예정 시각" hint="선택">
            <Input
              type="datetime-local"
              value={scheduledPurchaseAt}
              onChange={(event) => onScheduledPurchaseAtChange(event.target.value)}
              className="h-10 rounded-xl md:text-sm"
            />
          </FormRow>
          <FormRow label="주문 상태" hint="선택">
            <Input
              value={orderStatus}
              onChange={(event) => onOrderStatusChange(event.target.value)}
              placeholder="예: 결제 대기, 발송 준비"
              className="h-10 rounded-xl md:text-sm"
            />
          </FormRow>
        </div>
        <FormRow label="상품 URL" hint="선택">
          <Input
            type="url"
            value={productUrl}
            onChange={(event) => onProductUrlChange(event.target.value)}
            placeholder="https://"
            className="h-10 rounded-xl md:text-sm"
          />
        </FormRow>
        <FormRow label="메모" hint="선택">
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            className={controlTextareaClass}
            placeholder="주문 처리에 필요한 메모를 적어 주세요"
          />
        </FormRow>
      </div>
    </details>
  );
});

const OrderCompletionInfoSection = memo(function OrderCompletionInfoSection({
  isEditMode,
  isImportMode,
  isProcessed,
  onIsProcessedChange,
  depositDate,
  onDepositDateChange,
  depositAmount,
  onDepositAmountChange,
  depositMemo,
  onDepositMemoChange,
}: {
  isEditMode: boolean;
  isImportMode: boolean;
  isProcessed: string;
  onIsProcessedChange: (value: string) => void;
  depositDate: string;
  onDepositDateChange: (value: string) => void;
  depositAmount: string;
  onDepositAmountChange: (value: string) => void;
  depositMemo: string;
  onDepositMemoChange: (value: string) => void;
}) {
  return (
    <Card className="bg-muted/20 shadow-sm ring-border/50 dark:bg-muted/10" size="sm">
      <CardHeader className="border-border/50 border-b pb-4">
        <div className="flex items-start gap-3">
          <span className="bg-background text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-border/80">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">완료정보</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              입금이 끝난 주문이면 입금일·금액을 입력해 두면 장부 정리에 도움이 됩니다.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border/50">
          {!isEditMode && !isImportMode ? (
            <FormRow label="입금 완료 여부" hint="처음부터 완료로 넣을 때만 선택">
              <select
                value={isProcessed}
                onChange={(event) => onIsProcessedChange(event.target.value)}
                className={controlSelectClass}
              >
                <option value="false">미완료</option>
                <option value="true">완료</option>
              </select>
            </FormRow>
          ) : null}
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-4">
            <FormRow label="입금일">
              <Input
                type="date"
                value={depositDate}
                onChange={(event) => onDepositDateChange(event.target.value)}
                className="h-10 rounded-xl md:text-sm"
              />
            </FormRow>
            <FormRow label="실입금 금액" hint="원">
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={depositAmount}
                onChange={(event) => onDepositAmountChange(event.target.value)}
                className="h-10 rounded-xl tabular-nums md:text-sm"
              />
            </FormRow>
          </div>
          <FormRow label="입금 메모">
            <textarea
              rows={3}
              value={depositMemo}
              onChange={(event) => onDepositMemoChange(event.target.value)}
              className={controlTextareaClass}
              placeholder="입금 확인 메모가 있으면 적어 주세요"
            />
          </FormRow>
        </div>
      </CardContent>
    </Card>
  );
});

export function OrderDetailForm({
  order,
  draftOrder,
  importActions,
  crawlPaymentMethod,
  userId,
  onSummaryChange,
  platforms,
  paymentMethods,
  buyerAccounts,
  initialPurchaseTemplates,
  initialPreferences,
  initialDraftData,
}: {
  order?: OrderWithRelations;
  draftOrder?: DraftOrderWithRelations;
  importActions?: ImportActions;
  crawlPaymentMethod?: string;
  userId?: string;
  onSummaryChange?: (summary: OrderFormSummary) => void;
  platforms: Platform[];
  paymentMethods: PaymentMethod[];
  buyerAccounts: BuyerAccount[];
  initialPurchaseTemplates?: PurchaseTemplateRow[];
  initialPreferences?: UserPreferences;
  initialDraftData?: UserOrderDraftData | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isEditMode = Boolean(order);
  const isImportMode = Boolean(draftOrder && importActions);
  const isNewOrderMode = !isEditMode && !isImportMode;
  // 크롤링 주문은 실제 orders 행이 아니므로, 값 채우기용 초안으로만 사용합니다.
  const initialOrder = order ?? draftOrder;

  const [kakaoRoomName, setKakaoRoomName] = useState(initialOrder?.title ?? "");
  const [orderNumber, setOrderNumber] = useState(initialOrder?.order_number ?? "");
  const [productName, setProductName] = useState(initialOrder?.product_name ?? "");
  const [platformId, setPlatformId] = useState(initialOrder?.platform_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(initialOrder?.payment_method_id ?? "");
  const [buyerAccountId, setBuyerAccountId] = useState(initialOrder?.buyer_account_id ?? "");
  // 새 주문에서는 같은 구매 정보로 계정별 주문을 각각 만들기 위해 여러 계정을 보관합니다.
  const [buyerAccountIds, setBuyerAccountIds] = useState<string[]>(() =>
    initialOrder?.buyer_account_id ? [initialOrder.buyer_account_id] : [],
  );
  const [linkedPurchaseTemplateId, setLinkedPurchaseTemplateId] = useState(
    initialOrder?.purchase_info_template_id ?? "",
  );
  const [purchaseDate, setPurchaseDate] = useState(() => {
    if (initialOrder?.purchase_date) return initialOrder.purchase_date;
    if (isImportMode) return "";
    return getKoreaDateInputValue();
  });
  const [depositDate, setDepositDate] = useState(initialOrder?.deposit_date ?? "");
  const [purchasePrice, setPurchasePrice] = useState<string>(
    initialOrder?.purchase_price_krw != null ? String(initialOrder.purchase_price_krw) : isImportMode ? "" : "0",
  );
  const [reviewPhotoCount, setReviewPhotoCount] = useState<string>(
    initialOrder?.review_photo_count != null ? String(initialOrder.review_photo_count) : "",
  );
  const [reviewCharCount, setReviewCharCount] = useState<string>(
    initialOrder?.review_char_count != null ? String(initialOrder.review_char_count) : "",
  );
  const [depositAmount, setDepositAmount] = useState<string>(String(initialOrder?.deposit_amount_krw ?? ""));
  const [isItemDelivered, setIsItemDelivered] = useState(
    initialOrder?.is_item_delivered == null ? "" : initialOrder.is_item_delivered ? "true" : "false",
  );
  const [isProcessed, setIsProcessed] = useState(initialOrder?.is_processed ? "true" : "false");
  const [depositMemo, setDepositMemo] = useState(initialOrder?.deposit_memo ?? "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [productUrl, setProductUrl] = useState(initialOrder?.product_url ?? "");
  const [scheduledPurchaseAt, setScheduledPurchaseAt] = useState(
    toDateTimeLocalValue(initialOrder?.scheduled_purchase_at),
  );
  const [orderStatus, setOrderStatus] = useState(initialOrder?.order_status ?? "");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [purchaseTemplates, setPurchaseTemplates] = useState<PurchaseTemplateRow[]>(initialPurchaseTemplates ?? []);
  const [aiExtraInput, setAiExtraInput] = useState(initialOrder?.ai_review_user_prompt ?? "");
  const [workflowUserId, setWorkflowUserId] = useState(userId ?? "");
  const [preferences, setPreferences] = useState<UserPreferences | null>(initialPreferences ?? null);
  const [orderSaveAction, setOrderSaveAction] = useState<OrderSaveAction>(
    (initialPreferences?.order_save_action as OrderSaveAction) ?? "ledger",
  );
  const [availableDraft, setAvailableDraft] = useState<NewOrderDraft | null>(null);
  const [draftReady, setDraftReady] = useState(!isNewOrderMode);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const pendingDuplicateSaveRef = useRef<{
    isProcessed: boolean;
    onSuccess: () => void;
  } | null>(null);
  const importRedirectHrefRef = useRef<string | null>(null);
  const isCurrentlyProcessed = isProcessed === "true";
  const isMultipleBuyerAccounts = isNewOrderMode && buyerAccountIds.length > 1;
  const shouldApplyNewOrderDefaults = !initialOrder;
  const selectedBuyerAccountIds = useMemo(
    () => (isNewOrderMode ? buyerAccountIds : buyerAccountId ? [buyerAccountId] : []),
    [buyerAccountId, buyerAccountIds, isNewOrderMode],
  );

  const [baseline, setBaseline] = useState<OrderFormSnapshot | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const leaveActionRef = useRef<
    | null
    | { kind: "link"; href: string }
  >(null);
  const leaveModalOpenRef = useRef(false);
  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (!order?.id) return;
    setBaseline(orderRowToSnapshot(order));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 동일 id일 때 부분 갱신으로 baseline을 덮지 않음
  }, [order?.id]);

  const getFormSnapshot = useCallback((): OrderFormSnapshot => {
    return {
      title: kakaoRoomName.trim(),
      order_number: orderNumber.trim(),
      product_name: productName.trim(),
      platform_id: platformId,
      payment_method_id: paymentMethodId,
      buyer_account_id: buyerAccountId,
      purchase_info_template_id: linkedPurchaseTemplateId.trim(),
      purchase_date: purchaseDate.trim(),
      deposit_date: depositDate.trim(),
      deposit_amount: String(depositAmount ?? "").trim(),
      purchase_price: String(purchasePrice ?? "").trim(),
      review_photo: reviewPhotoCount.trim(),
      review_char: reviewCharCount.trim(),
      is_item_delivered: isItemDelivered,
      is_processed: isProcessed,
      deposit_memo: depositMemo.trim(),
      notes: notes.trim(),
      product_url: productUrl.trim(),
      scheduled_purchase_at: scheduledPurchaseAt,
      order_status: orderStatus.trim(),
      ai_review_user_prompt: aiExtraInput.trim(),
    };
  }, [
    kakaoRoomName,
    orderNumber,
    productName,
    platformId,
    paymentMethodId,
    buyerAccountId,
    linkedPurchaseTemplateId,
    purchaseDate,
    depositDate,
    depositAmount,
    purchasePrice,
    reviewPhotoCount,
    reviewCharCount,
    isItemDelivered,
    isProcessed,
    depositMemo,
    notes,
    productUrl,
    scheduledPurchaseAt,
    orderStatus,
    aiExtraInput,
  ]);

  const serializedFormSnapshot = useMemo(() => JSON.stringify(getFormSnapshot()), [getFormSnapshot]);
  const serializedBaseline = useMemo(() => (baseline ? JSON.stringify(baseline) : null), [baseline]);
  const isDirty = useMemo(() => {
    if (!isEditMode || !order || !baseline) return false;
    return serializedFormSnapshot !== serializedBaseline;
  }, [baseline, isEditMode, order, serializedBaseline, serializedFormSnapshot]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    leaveModalOpenRef.current = leaveModalOpen;
  }, [leaveModalOpen]);

  useEffect(() => {
    if (!isEditMode) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) return;

    const onClickCapture = (e: MouseEvent) => {
      if (!isDirtyRef.current || leaveModalOpenRef.current) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = e.target as HTMLElement | null;
      if (!el) return;
      const a = el.closest("a[href]");
      if (!a) return;
      if (a.hasAttribute("data-skip-leave-guard")) return;
      if (a.getAttribute("target") === "_blank") return;

      const rawHref = a.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(rawHref, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const targetPath = `${url.pathname}${url.search}`;
      const here = `${window.location.pathname}${window.location.search}`;
      if (targetPath === here) return;

      e.preventDefault();
      e.stopPropagation();
      leaveActionRef.current = { kind: "link", href: targetPath };
      setLeaveModalOpen(true);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isEditMode]);

  useEffect(() => {
    setAiExtraInput(order?.ai_review_user_prompt ?? "");
  }, [order?.id, order?.ai_review_user_prompt]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (initialPurchaseTemplates !== undefined) {
      setPurchaseTemplates(initialPurchaseTemplates);
      return;
    }

    let cancelled = false;
    (async () => {
      const supa = createClient();
      const { data } = await supa
        .from("purchase_info_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setPurchaseTemplates(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPurchaseTemplates]);

  const applyNewOrderDraft = useCallback((draft: NewOrderDraft) => {
    setKakaoRoomName(draft.title);
    setOrderNumber(draft.order_number);
    setProductName(draft.product_name);
    setPlatformId(draft.platform_id);
    setPaymentMethodId(draft.payment_method_id);
    setBuyerAccountIds(draft.buyer_account_ids);
    setLinkedPurchaseTemplateId(draft.purchase_info_template_id);
    setPurchaseDate(draft.purchase_date);
    setPurchasePrice(draft.purchase_price);
    setReviewPhotoCount(draft.review_photo_count);
    setReviewCharCount(draft.review_char_count);
    setIsItemDelivered(draft.is_item_delivered);
    setIsProcessed(draft.is_processed || "false");
    setDepositDate(draft.deposit_date);
    setDepositAmount(draft.deposit_amount);
    setDepositMemo(draft.deposit_memo);
    setNotes(draft.notes);
    setProductUrl(draft.product_url);
    setScheduledPurchaseAt(draft.scheduled_purchase_at);
    setOrderStatus(draft.order_status);
    setAiExtraInput(draft.ai_review_user_prompt);
  }, []);

  const applyNewOrderWorkflowData = useCallback(
    (nextPreferences: UserPreferences, draftData: UserOrderDraftData | null) => {
      setPreferences(nextPreferences);
      setOrderSaveAction(nextPreferences.order_save_action as OrderSaveAction);

      // 복제 주문에는 복제된 값을 유지하고, 완전히 새 주문일 때만 기본값 또는 최근값을 채웁니다.
      if (shouldApplyNewOrderDefaults) {
        setPlatformId(nextPreferences.default_platform_id ?? nextPreferences.recent_platform_id ?? "");
        setPaymentMethodId(
          nextPreferences.default_payment_method_id ?? nextPreferences.recent_payment_method_id ?? "",
        );
        const preferredAccountId =
          nextPreferences.default_buyer_account_id ?? nextPreferences.recent_buyer_account_id;
        setBuyerAccountIds(preferredAccountId ? [preferredAccountId] : []);
        setLinkedPurchaseTemplateId(
          nextPreferences.default_purchase_info_template_id
            ?? nextPreferences.recent_purchase_info_template_id
            ?? "",
        );
      }

      const parsedDraft = draftData ? parseNewOrderDraft(draftData) : null;
      if (parsedDraft) {
        setAvailableDraft(parsedDraft);
        setDraftReady(false);
      } else {
        setDraftReady(true);
      }
    },
    [shouldApplyNewOrderDefaults],
  );

  useEffect(() => {
    if (!isNewOrderMode) return;

    if (initialPreferences !== undefined && initialDraftData !== undefined && userId) {
      setWorkflowUserId(userId);
      applyNewOrderWorkflowData(initialPreferences, initialDraftData);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        let currentUserId = userId ?? "";
        if (!currentUserId) {
          const { data } = await supabase.auth.getUser();
          currentUserId = data.user?.id ?? "";
        }
        if (!currentUserId || cancelled) return;

        setWorkflowUserId(currentUserId);
        const [nextPreferences, draftResult] = await Promise.all([
          getOrCreateUserPreferences(supabase, currentUserId),
          supabase.from("user_order_drafts").select("draft_data").eq("user_id", currentUserId).maybeSingle(),
        ]);
        if (cancelled) return;
        if (draftResult.error) throw draftResult.error;

        applyNewOrderWorkflowData(nextPreferences, draftResult.data?.draft_data ?? null);
      } catch (error) {
        if (cancelled) return;
        setDraftReady(true);
        setToast({
          type: "error",
          message: error instanceof Error ? error.message : "사용자 설정을 불러오지 못했습니다.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyNewOrderWorkflowData, initialDraftData, initialPreferences, isNewOrderMode, supabase, userId]);

  const newOrderDraft = useMemo<NewOrderDraft>(() => ({
    version: 1,
    title: kakaoRoomName,
    order_number: orderNumber,
    product_name: productName,
    platform_id: platformId,
    payment_method_id: paymentMethodId,
    buyer_account_ids: buyerAccountIds,
    purchase_info_template_id: linkedPurchaseTemplateId,
    purchase_date: purchaseDate,
    purchase_price: purchasePrice,
    review_photo_count: reviewPhotoCount,
    review_char_count: reviewCharCount,
    is_item_delivered: isItemDelivered,
    is_processed: isProcessed,
    deposit_date: depositDate,
    deposit_amount: depositAmount,
    deposit_memo: depositMemo,
    notes,
    product_url: productUrl,
    scheduled_purchase_at: scheduledPurchaseAt,
    order_status: orderStatus,
    ai_review_user_prompt: aiExtraInput,
  }), [
    aiExtraInput,
    buyerAccountIds,
    depositAmount,
    depositDate,
    depositMemo,
    isItemDelivered,
    isProcessed,
    kakaoRoomName,
    linkedPurchaseTemplateId,
    notes,
    orderNumber,
    orderStatus,
    paymentMethodId,
    platformId,
    productName,
    productUrl,
    purchaseDate,
    purchasePrice,
    reviewCharCount,
    reviewPhotoCount,
    scheduledPurchaseAt,
  ]);

  useEffect(() => {
    if (!isNewOrderMode || !workflowUserId || !draftReady) return;

    const hasMeaningfulInput = Boolean(
      newOrderDraft.title.trim()
      || newOrderDraft.order_number.trim()
      || newOrderDraft.product_name.trim()
      || (Number(newOrderDraft.purchase_price) || 0) > 0
      || newOrderDraft.review_photo_count.trim()
      || newOrderDraft.review_char_count.trim()
      || newOrderDraft.is_item_delivered
      || newOrderDraft.deposit_date
      || newOrderDraft.deposit_amount.trim()
      || newOrderDraft.deposit_memo.trim()
      || newOrderDraft.notes.trim()
      || newOrderDraft.product_url.trim()
      || newOrderDraft.scheduled_purchase_at,
    );

    const timer = window.setTimeout(() => {
      if (hasMeaningfulInput) {
        void supabase.from("user_order_drafts").upsert(
          { user_id: workflowUserId, draft_data: newOrderDraft },
          { onConflict: "user_id" },
        );
      } else {
        void supabase.from("user_order_drafts").delete().eq("user_id", workflowUserId);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [draftReady, isNewOrderMode, newOrderDraft, supabase, workflowUserId]);

  useEffect(() => {
    if (!isNewOrderMode || !draftReady) return;
    const normalizedProduct = normalizeOrderMatchText(productName);
    const normalizedOrderNumber = orderNumber.trim();
    if ((!normalizedProduct || !purchaseDate) && !normalizedOrderNumber) {
      setDuplicateCandidates([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const fields = "id, title, product_name, purchase_date, order_number, buyer_account_id, purchase_price_krw";
        const matches = new Map<string, DuplicateCandidate>();

        const orderNumberQuery = normalizedOrderNumber
          ? supabase
            .from("orders")
            .select(fields)
            .is("deleted_at", null)
            .eq("order_number", normalizedOrderNumber)
            .limit(5)
          : Promise.resolve({ data: null });
        const productDateQuery = normalizedProduct && purchaseDate
          ? supabase
            .from("orders")
            .select(fields)
            .is("deleted_at", null)
            .eq("purchase_date", purchaseDate)
            .limit(100)
          : Promise.resolve({ data: null });

        const [{ data: orderNumberMatches }, { data: productDateMatches }] = await Promise.all([
          orderNumberQuery,
          productDateQuery,
        ]);

        for (const row of orderNumberMatches ?? []) matches.set(row.id, row);
        for (const row of productDateMatches ?? []) {
            const sameProduct = normalizeOrderMatchText(row.product_name) === normalizedProduct;
            const sameAccount = buyerAccountIds.length === 0 || buyerAccountIds.includes(row.buyer_account_id ?? "");
            if (sameProduct && sameAccount) matches.set(row.id, row);
        }

        if (!cancelled) setDuplicateCandidates([...matches.values()].slice(0, 5));
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [buyerAccountIds, draftReady, isNewOrderMode, orderNumber, productName, purchaseDate, supabase]);

  const formSummary = useMemo<OrderFormSummary>(() => {
    const missingFields: string[] = [];
    if (!kakaoRoomName.trim()) missingFields.push("카톡방 이름");
    if (!productName.trim()) missingFields.push("물품명");
    if (!platformId) missingFields.push("플랫폼");
    if (!paymentMethodId) missingFields.push("결제 방식");
    if (selectedBuyerAccountIds.length === 0) missingFields.push("구매 계정");
    if (!purchaseDate) missingFields.push("구매일");
    if (!String(purchasePrice).trim()) missingFields.push("구매가격");
    if (isItemDelivered !== "true" && isItemDelivered !== "false") missingFields.push("배송 여부");

    return {
      title: kakaoRoomName.trim(),
      productName: productName.trim(),
      purchasePrice: Number(purchasePrice) || 0,
      depositAmount: Number(depositAmount) || 0,
      isProcessed: isProcessed === "true",
      isItemDelivered: isItemDelivered === "true" ? true : isItemDelivered === "false" ? false : null,
      platformName: platforms.find((item) => item.id === platformId)?.name ?? "",
      paymentMethodName: paymentMethods.find((item) => item.id === paymentMethodId)?.name ?? "",
      buyerAccountNames: selectedBuyerAccountIds
        .map((id) => buyerAccounts.find((item) => item.id === id)?.label)
        .filter((name): name is string => Boolean(name)),
      templateName: purchaseTemplates.find((item) => item.id === linkedPurchaseTemplateId)?.title ?? "",
      scheduledPurchaseAt,
      missingFields,
      duplicateCount: duplicateCandidates.length,
    };
  }, [
    buyerAccounts,
    duplicateCandidates.length,
    depositAmount,
    isItemDelivered,
    isProcessed,
    kakaoRoomName,
    linkedPurchaseTemplateId,
    paymentMethodId,
    paymentMethods,
    platformId,
    platforms,
    productName,
    purchaseDate,
    purchasePrice,
    purchaseTemplates,
    scheduledPurchaseAt,
    selectedBuyerAccountIds,
  ]);

  useEffect(() => {
    onSummaryChange?.(formSummary);
  }, [formSummary, onSummaryChange]);

  const kakaoPasteLine = useMemo(() => {
    if (!linkedPurchaseTemplateId) return "";
    const t = purchaseTemplates.find((x) => x.id === linkedPurchaseTemplateId);
    if (!t) return "";
    return buildKakaoPasteLine(t, orderNumber, purchasePrice);
  }, [linkedPurchaseTemplateId, purchaseTemplates, orderNumber, purchasePrice]);

  const copyKakaoPasteLine = async () => {
    if (!linkedPurchaseTemplateId) {
      setToast({ type: "error", message: "템플릿을 선택해 주세요." });
      return;
    }
    try {
      await copyTextToClipboard(kakaoPasteLine);
      setToast({ type: "success", message: "클립보드에 복사했습니다." });
    } catch {
      setToast({ type: "error", message: "복사에 실패했습니다. 브라우저의 클립보드 권한을 확인한 뒤 다시 시도해 주세요." });
    }
  };

  // 같은 계정을 두 번 저장하지 않도록, 새 주문의 선택 목록에서만 계정을 추가하거나 뺍니다.
  const toggleBuyerAccountId = (accountId: string) => {
    const nextBuyerAccountIds = buyerAccountIds.includes(accountId)
      ? buyerAccountIds.filter((id) => id !== accountId)
      : [...buyerAccountIds, accountId];
    // 두 주문 이상에 같은 번호가 저장되지 않도록, 두 번째 계정을 고를 때 주문번호를 비웁니다.
    if (nextBuyerAccountIds.length > 1) setOrderNumber("");
    setBuyerAccountIds(nextBuyerAccountIds);
  };

  const buildPayload = useCallback((nextIsProcessed: boolean): OrderPayloadBuildResult => {
    const kakaoRoomNameValue = kakaoRoomName.trim();
    const orderNumberValue = orderNumber.trim();
    const productNameValue = productName.trim();
    const purchaseDateValue = purchaseDate.trim();
    const depositDateValue = depositDate.trim();
    const depositAmountValue = String(depositAmount ?? "").trim();

    if (
      !kakaoRoomNameValue ||
      !productNameValue ||
      !platformId ||
      !paymentMethodId ||
      selectedBuyerAccountIds.length === 0 ||
      !purchaseDateValue ||
      (isItemDelivered !== "true" && isItemDelivered !== "false")
    ) {
      return { error: "필수 입력값을 확인해 주세요." };
    }

    const selectedPlatform = platforms.find((p) => p.id === platformId);
    const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
    const hasValidBuyerAccounts = selectedBuyerAccountIds.every((id) => buyerAccounts.some((account) => account.id === id));

    if (!selectedPlatform || !selectedMethod || !hasValidBuyerAccounts) {
      return { error: "선택한 항목이 유효하지 않습니다. 페이지를 새로고침 후 다시 시도해 주세요." };
    }

    const purchasePriceResult = normalizeNumber(purchasePrice, "구매가격");
    if ("error" in purchasePriceResult) return purchasePriceResult;

    const reviewPhotoResult = normalizeOptionalNumber(reviewPhotoCount, "리뷰 사진 개수");
    if ("error" in reviewPhotoResult) return reviewPhotoResult;
    const reviewCharResult = normalizeOptionalNumber(reviewCharCount, "리뷰 글자 수");
    if ("error" in reviewCharResult) return reviewCharResult;

    if (nextIsProcessed) {
      if (!depositDateValue) {
        return { error: "완료처리를 하려면 입금일자 칸을 입력해야됩니다." };
      }

      if (!depositAmountValue) {
        return { error: "완료처리를 하려면 실입금금액 칸을 입력해야됩니다." };
      }
    }

    const clearingDepositBecauseUncomplete =
      isEditMode && order?.is_processed === true && !nextIsProcessed;

    let deposit_amount_krw: number | null;
    if (clearingDepositBecauseUncomplete) {
      deposit_amount_krw = null;
    } else {
      const depositAmountResult = normalizeOptionalNumber(depositAmount, "입금금액");
      if ("error" in depositAmountResult) return depositAmountResult;
      deposit_amount_krw = depositAmountResult.value;
    }

    const deposit_date = clearingDepositBecauseUncomplete ? null : depositDateValue || null;
    const deposit_memo = clearingDepositBecauseUncomplete ? null : depositMemo.trim() || null;

    const templateIdValue = linkedPurchaseTemplateId.trim();
    if (templateIdValue && !purchaseTemplates.some((x) => x.id === templateIdValue)) {
      return { error: "선택한 구매 정보 템플릿을 찾을 수 없습니다. 다시 선택해 주세요." };
    }

    let scheduledPurchaseIso: string | null = null;
    if (scheduledPurchaseAt) {
      const scheduledDate = new Date(scheduledPurchaseAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        return { error: "구매 예정 시각을 다시 확인해 주세요." };
      }
      scheduledPurchaseIso = scheduledDate.toISOString();
    }

    return {
      // 여러 계정 선택 시 주문번호는 주문별 고유값이므로 모든 새 주문에서 비웁니다.
      payloads: selectedBuyerAccountIds.map((selectedBuyerAccountId) => ({
        title: kakaoRoomNameValue,
        order_number: isMultipleBuyerAccounts ? null : orderNumberValue || null,
        product_name: productNameValue,
        platform_id: platformId,
        payment_method_id: paymentMethodId,
        buyer_account_id: selectedBuyerAccountId,
        purchase_info_template_id: templateIdValue || null,
        purchase_date: purchaseDateValue,
        deposit_date,
        purchase_price_krw: purchasePriceResult.value,
        review_photo_count: reviewPhotoResult.value,
        review_char_count: reviewCharResult.value,
        deposit_amount_krw,
        is_item_delivered: isItemDelivered === "true",
        is_processed: nextIsProcessed,
        deposit_memo,
        notes: notes.trim() || null,
        product_url: productUrl.trim() || null,
        scheduled_purchase_at: scheduledPurchaseIso,
        order_status: orderStatus.trim() || null,
        ...(isImportMode
          ? {
              screenshot_storage_path: draftOrder?.screenshot_storage_path ?? null,
            }
          : {}),
        ai_review_user_prompt: aiExtraInput.trim() || null,
      })) satisfies Database["public"]["Tables"]["orders"]["Insert"][],
    };
  }, [
    aiExtraInput,
    buyerAccounts,
    depositAmount,
    depositDate,
    depositMemo,
    draftOrder?.screenshot_storage_path,
    isEditMode,
    isImportMode,
    isItemDelivered,
    isMultipleBuyerAccounts,
    kakaoRoomName,
    linkedPurchaseTemplateId,
    notes,
    order?.is_processed,
    orderNumber,
    orderStatus,
    paymentMethodId,
    paymentMethods,
    platformId,
    platforms,
    productName,
    productUrl,
    purchaseDate,
    purchasePrice,
    purchaseTemplates,
    reviewCharCount,
    reviewPhotoCount,
    scheduledPurchaseAt,
    selectedBuyerAccountIds,
  ]);

  const persistOrder = async (nextIsProcessed: boolean): Promise<boolean> => {
    setToast(null);
    setIsSaving(true);
    try {
      const { payloads, error } = buildPayload(nextIsProcessed);
      if (error || !payloads) {
        setToast({ type: "error", message: error ?? "입력값을 확인해 주세요." });
        return false;
      }

      if (isImportMode && importActions) {
        const result = await importActions.onSave(payloads[0]);
        if (result.error) {
          setToast({ type: "error", message: result.error });
          return false;
        }
        importRedirectHrefRef.current = result.redirectHref ?? null;
        return true;
      }

      const query = isEditMode
        ? supabase.from("orders").update(payloads[0]).eq("id", order!.id).is("deleted_at", null)
        : supabase.from("orders").insert(payloads);
      const { error: saveError } = await query;

      if (saveError) {
        setToast({ type: "error", message: saveError.message });
        return false;
      }

      if (isNewOrderMode && workflowUserId) {
        // 주문 저장 성공은 설정 저장 실패와 분리해 중복 주문이 생기지 않도록 합니다.
        await Promise.allSettled([
          supabase.from("user_preferences").upsert(
            {
              user_id: workflowUserId,
              recent_platform_id: platformId || null,
              recent_payment_method_id: paymentMethodId || null,
              recent_buyer_account_id: selectedBuyerAccountIds[0] ?? null,
              recent_purchase_info_template_id: linkedPurchaseTemplateId || null,
              order_save_action: orderSaveAction,
            },
            { onConflict: "user_id" },
          ),
          supabase.from("user_order_drafts").delete().eq("user_id", workflowUserId),
        ]);
        setPreferences((current) => current ? {
          ...current,
          recent_platform_id: platformId || null,
          recent_payment_method_id: paymentMethodId || null,
          recent_buyer_account_id: selectedBuyerAccountIds[0] ?? null,
          recent_purchase_info_template_id: linkedPurchaseTemplateId || null,
          order_save_action: orderSaveAction,
        } : current);
      }

      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDraftOrder = async () => {
    if (!isImportMode || !importActions) return;

    const confirmed = window.confirm(importActions.deleteConfirmLabel ?? "이 크롤링 주문을 삭제할까요?");
    if (!confirmed) return;

    setToast(null);
    setIsSaving(true);

    try {
      const result = await importActions.onDelete();
      if (result.error) {
        setToast({ type: "error", message: result.error });
        return;
      }

      router.push(result.redirectHref ?? importActions.afterDeleteHref);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const commitSaveOrder = async ({
    isProcessed: nextProcessed,
    onSuccess,
  }: {
    isProcessed: boolean;
    onSuccess: () => void;
  }) => {
    const ok = await persistOrder(nextProcessed);
    if (ok) onSuccess();
  };

  const saveOrder = (request: { isProcessed: boolean; onSuccess: () => void }) => {
    if (isNewOrderMode && duplicateCandidates.length > 0) {
      pendingDuplicateSaveRef.current = request;
      setDuplicateConfirmOpen(true);
      return;
    }
    void commitSaveOrder(request);
  };

  const confirmDuplicateSave = () => {
    const request = pendingDuplicateSaveRef.current;
    pendingDuplicateSaveRef.current = null;
    setDuplicateConfirmOpen(false);
    if (request) void commitSaveOrder(request);
  };

  const resetNewOrderFields = (keepSharedValues: boolean) => {
    setOrderNumber("");
    setDepositDate("");
    setDepositAmount("");
    setDepositMemo("");
    setIsProcessed("false");
    setScheduledPurchaseAt("");
    setOrderStatus("");
    setNotes("");
    setAiExtraInput("");
    if (keepSharedValues) return;

    setKakaoRoomName("");
    setProductName("");
    setPurchasePrice("0");
    setReviewPhotoCount("");
    setReviewCharCount("");
    setProductUrl("");
    setIsItemDelivered("");
    setPurchaseDate(getKoreaDateInputValue());
    // 방금 저장한 선택값이 서버 상태 반영을 기다리지 않아도 다음 빈 주문에 바로 이어지게 합니다.
    setPlatformId(preferences?.default_platform_id ?? platformId ?? preferences?.recent_platform_id ?? "");
    setPaymentMethodId(
      preferences?.default_payment_method_id ?? paymentMethodId ?? preferences?.recent_payment_method_id ?? "",
    );
    const preferredAccountId = preferences?.default_buyer_account_id
      ?? selectedBuyerAccountIds[0]
      ?? preferences?.recent_buyer_account_id;
    setBuyerAccountIds(preferredAccountId ? [preferredAccountId] : []);
    setLinkedPurchaseTemplateId(
      preferences?.default_purchase_info_template_id
        ?? linkedPurchaseTemplateId
        ?? preferences?.recent_purchase_info_template_id
        ?? "",
    );
  };

  const handleNewOrderSaved = () => {
    if (orderSaveAction === "ledger") {
      router.push("/");
      router.refresh();
      return;
    }

    resetNewOrderFields(orderSaveAction === "same");
    setDuplicateCandidates([]);
    setToast({
      type: "success",
      message: orderSaveAction === "same" ? "저장했습니다. 같은 정보로 다음 주문을 입력할 수 있습니다." : "저장했습니다. 새 입력 화면을 비웠습니다.",
    });
  };

  const updateOrderSaveAction = (action: OrderSaveAction) => {
    setOrderSaveAction(action);
    setPreferences((current) => (current ? { ...current, order_save_action: action } : current));
    if (workflowUserId) {
      void supabase.from("user_preferences").upsert(
        { user_id: workflowUserId, order_save_action: action },
        { onConflict: "user_id" },
      );
    }
  };

  const restoreAvailableDraft = () => {
    if (availableDraft) applyNewOrderDraft(availableDraft);
    setAvailableDraft(null);
    setDraftReady(true);
    setToast({ type: "success", message: "다른 기기에도 저장된 임시 내용을 불러왔습니다." });
  };

  const discardAvailableDraft = () => {
    setAvailableDraft(null);
    setDraftReady(true);
    if (workflowUserId) {
      void supabase.from("user_order_drafts").delete().eq("user_id", workflowUserId);
    }
  };

  const closeLeaveFlow = () => {
    setLeaveModalOpen(false);
    leaveActionRef.current = null;
  };

  const onLeaveStay = () => {
    closeLeaveFlow();
  };

  const onLeaveDiscardNavigate = () => {
    const ctx = leaveActionRef.current;
    setLeaveModalOpen(false);
    leaveActionRef.current = null;
    if (ctx?.kind === "link") {
      router.push(ctx.href);
      router.refresh();
    }
  };

  const onLeaveSaveNavigate = async () => {
    const ctx = leaveActionRef.current;
    const ok = await persistOrder(isProcessed === "true");
    if (!ok) {
      closeLeaveFlow();
      return;
    }
    setBaseline(getFormSnapshot());
    setLeaveModalOpen(false);
    leaveActionRef.current = null;
    if (ctx?.kind === "link") {
      router.push(ctx.href);
      router.refresh();
    }
  };

  const deleteOrder = async () => {
    if (!isEditMode) return;

    const confirmed = window.confirm(`"${order!.product_name}" 주문을 휴지통으로 이동할까요?`);
    if (!confirmed) return;

    setToast(null);
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", order!.id)
        .eq("user_id", order!.user_id)
        .is("deleted_at", null);
      if (error) {
        setToast({ type: "error", message: error.message });
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-5 pb-8">
      {toast ? <OrderFormToast toast={toast} /> : null}

      {availableDraft && !draftReady ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs" role="status">
          <div className="flex items-start gap-3">
            <Clipboard className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">저장 중이던 주문이 있습니다</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                서버에 자동 저장된 임시 내용을 이어서 입력하거나, 현재 화면의 값으로 새로 시작할 수 있습니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={restoreAvailableDraft}>이어 작성</Button>
                <Button type="button" size="sm" variant="outline" onClick={discardAvailableDraft}>임시 내용 버리기</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {duplicateCandidates.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950 shadow-xs dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">비슷한 기존 주문 {duplicateCandidates.length}건을 찾았습니다</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">주문번호가 같거나 구매일·상품·구매계정이 일치합니다.</p>
              <div className="mt-3 grid gap-2">
                {duplicateCandidates.map((candidate) => (
                  <Link
                    key={candidate.id}
                    href={`/orders/detail?id=${candidate.id}`}
                    target="_blank"
                    className="rounded-lg border border-amber-300/60 bg-background/70 px-3 py-2 text-sm hover:bg-background"
                  >
                    <span className="font-medium">{candidate.title || candidate.product_name}</span>
                    <span className="ml-2 opacity-70">{candidate.purchase_date} · {formatKrw(candidate.purchase_price_krw)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {duplicateConfirmOpen ? (
        <div
          className="fixed inset-0 z-[195] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          role="presentation"
          onClick={() => setDuplicateConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-save-title"
            className="w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground shadow-2xl ring-1 ring-black/10"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="duplicate-save-title" className="text-lg font-semibold">그래도 주문을 추가할까요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              비슷한 주문 {duplicateCandidates.length}건이 있습니다. 기존 주문을 확인했으며 별도 주문이 맞을 때만 추가해 주세요.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setDuplicateConfirmOpen(false)}>취소</Button>
              <Button type="button" disabled={isSaving} onClick={confirmDuplicateSave}>그래도 추가</Button>
            </div>
          </div>
        </div>
      ) : null}

      {leaveModalOpen ? (
        <div
          className="fixed inset-0 z-[190] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          role="presentation"
          onClick={onLeaveStay}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-save-title"
            className="bg-card text-card-foreground w-full max-w-sm rounded-2xl p-5 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h2 id="leave-save-title" className="text-lg font-semibold tracking-tight">
              변경 사항을 저장하시겠습니까?
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              「예」는 현재 입력 내용을 저장한 뒤 이동합니다. 「아니오」는 저장하지 않고 이동합니다.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <Button type="button" variant="outline" size="lg" className="h-11 rounded-xl" onClick={onLeaveStay}>
                취소
              </Button>
              <Button type="button" variant="outline" size="lg" className="h-11 rounded-xl" onClick={onLeaveDiscardNavigate}>
                아니오
              </Button>
              <Button
                type="button"
                variant="default"
                size="lg"
                className="h-11 rounded-xl"
                disabled={isSaving}
                onClick={() => void onLeaveSaveNavigate()}
              >
                예
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditMode && order ? <OrderSummaryHero order={order} /> : null}

      <Card className="shadow-sm ring-border/60" size="sm">
        {purchaseTemplates.length === 0 ? (
          <>
            <CardHeader className="border-border/60 border-b pb-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-800 ring-1 ring-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/25">
                  <Clipboard className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base">카톡방 붙여넣기 정보</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-muted-foreground text-sm">
                등록된 템플릿이 없습니다.{" "}
                <Link href="/settings" className="text-primary font-medium underline-offset-2 hover:underline">
                  설정
                </Link>
                에서 추가할 수 있습니다.
              </p>
            </CardContent>
          </>
        ) : (
          <CardContent className="px-3 pb-3 pt-3">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-5">
              <div className="flex min-w-0 min-h-0 flex-[1] flex-col gap-2">
                <div className="flex shrink-0 items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-800 ring-1 ring-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/25">
                    <Clipboard className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <CardTitle className="text-base leading-tight">카톡방 붙여넣기 정보</CardTitle>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label className="text-foreground text-sm font-medium" htmlFor="purchase-template-select">
                    구매 정보 템플릿
                  </Label>
                  <select
                    id="purchase-template-select"
                    value={linkedPurchaseTemplateId}
                    onChange={(event) => setLinkedPurchaseTemplateId(event.target.value)}
                    className={controlSelectClass}
                    aria-label="구매 정보 템플릿 (주문에 저장)"
                  >
                    <option value="">연결 안 함</option>
                    {purchaseTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-[2] flex-col gap-1 border-t border-border/50 pt-3 md:border-t-0 md:border-l md:border-border/50 md:pl-5 md:pt-0">
                <Label className="text-foreground shrink-0 text-sm font-medium">템플릿</Label>
                <button
                  type="button"
                  disabled={!linkedPurchaseTemplateId}
                  onClick={() => void copyKakaoPasteLine()}
                  title="누르면 클립보드에 복사"
                  aria-label="선택한 템플릿 한 줄 복사"
                  className={cn(
                    "flex min-h-[3rem] w-full min-w-0 flex-1 rounded-xl border border-input bg-muted/30 px-3 py-2 text-left text-sm break-all outline-none transition-colors",
                    "items-start justify-start text-left",
                    "hover:bg-muted/55 active:bg-muted/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "touch-manipulation font-mono leading-relaxed dark:bg-muted/15",
                  )}
                >
                  {linkedPurchaseTemplateId
                    ? kakaoPasteLine
                    : "템플릿을 선택하면 주문번호·구매가격이 반영된 한 줄이 표시됩니다."}
                </button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-sm ring-border/60" size="sm">
        <CardHeader className="border-border/60 border-b pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25">
              <ListChecks className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">구매정보</CardTitle>
              <CardDescription className="text-xs leading-relaxed">구매 정보를 입력해주세요</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border/50">
            <FormRow label="구매일" required>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                className="h-10 rounded-xl md:text-sm"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0 sm:gap-x-4">
              <div className="min-w-0">
                <FormRow label="카톡방 이름" required>
                  <Input
                    value={kakaoRoomName}
                    onChange={(event) => setKakaoRoomName(event.target.value)}
                    className="h-10 rounded-xl md:text-sm"
                    autoComplete="off"
                    placeholder={PURCHASE_INFO_HINTS.kakaoRoom}
                  />
                </FormRow>
              </div>
              <div className="min-w-0">
                <FormRow label="구매 물품" required>
                  <Input
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className="h-10 rounded-xl md:text-sm"
                    autoComplete="off"
                    placeholder={PURCHASE_INFO_HINTS.product}
                  />
                </FormRow>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0 sm:gap-x-4">
              <div className="min-w-0">
                <FormRow label="구매 가격" required>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    className="h-10 rounded-xl tabular-nums md:text-sm"
                    placeholder="단위: 원"
                  />
                </FormRow>
              </div>
              <div className="min-w-0">
                <FormRow label="실 배송 여부" required>
                  <select
                    value={isItemDelivered}
                    onChange={(event) => setIsItemDelivered(event.target.value)}
                    className={controlSelectClass}
                    aria-label="실 배송 여부"
                  >
                    {!isEditMode ? (
                      <option value="" disabled>
                        {PURCHASE_INFO_HINTS.delivery}
                      </option>
                    ) : null}
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </select>
                </FormRow>
              </div>
            </div>
            <div className={cn("grid items-start gap-x-2 gap-y-0 sm:gap-x-3", isNewOrderMode ? "grid-cols-2" : "grid-cols-3")}>
              <div className="min-w-0">
                <FormRow label="결제 플랫폼" required>
                  <EntitySelect
                    icon={Building2}
                    aria-label="결제 플랫폼"
                    value={platformId}
                    onChange={setPlatformId}
                    options={platforms.map((p) => ({ id: p.id, name: p.name }))}
                    placeholder="플랫폼을 선택해 주세요"
                    emptyHint="등록된 플랫폼이 없습니다. 설정에서 추가해 주세요."
                  />
                </FormRow>
              </div>
              <div className="min-w-0">
                <FormRow label="결제 방식" required>
                  <EntitySelect
                    icon={CreditCard}
                    aria-label="결제 방식"
                    value={paymentMethodId}
                    onChange={setPaymentMethodId}
                    options={paymentMethods.map((m) => ({ id: m.id, name: m.name }))}
                    placeholder="결제 방식을 선택해 주세요"
                    emptyHint="등록된 결제 수단이 없습니다. 설정에서 추가해 주세요."
                  />
                  {isImportMode ? (
                    // 자동 추천을 검수할 때 선택된 결제 방식과 크롤링 원문을 바로 비교할 수 있게 보여줍니다.
                    <p className="text-muted-foreground mt-1.5 break-words px-1 text-xs leading-relaxed">
                      크롤링 결제방식: <span className="text-foreground font-medium">{crawlPaymentMethod || "—"}</span>
                    </p>
                  ) : null}
                </FormRow>
              </div>
              <div className={cn("min-w-0", isNewOrderMode && "col-span-2")}>
                <FormRow label="구매 계정" required>
                  {isNewOrderMode ? (
                    buyerAccounts.length === 0 ? (
                      <EntitySelect
                        icon={UserCircle}
                        aria-label="구매 계정"
                        value=""
                        onChange={() => undefined}
                        options={[]}
                        emptyHint="등록된 구매 계정이 없습니다. 설정에서 추가해 주세요."
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {buyerAccounts.map((account) => {
                          const isSelected = buyerAccountIds.includes(account.id);
                          return (
                            <button
                              key={account.id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => toggleBuyerAccountId(account.id)}
                              className={cn(
                                "flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors touch-manipulation",
                                isSelected
                                  ? "border-primary bg-primary/12 text-foreground ring-1 ring-primary/25 dark:bg-primary/20"
                                  : "border-input bg-background hover:bg-muted/50 active:bg-muted/70 dark:bg-input/30",
                              )}
                            >
                              <span className="truncate">{account.label}</span>
                              {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                            </button>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <EntitySelect
                      icon={UserCircle}
                      aria-label="구매 계정"
                      value={buyerAccountId}
                      onChange={setBuyerAccountId}
                      options={buyerAccounts.map((a) => ({ id: a.id, name: a.label }))}
                      placeholder="구매 계정을 선택해 주세요"
                      emptyHint="등록된 구매 계정이 없습니다. 설정에서 추가해 주세요."
                    />
                  )}
                </FormRow>
              </div>
            </div>
            <FormRow
              label="주문번호"
              hint={isMultipleBuyerAccounts ? "다중 선택 시 입력할 수 없습니다" : "선택 · 비워도 저장됩니다"}
            >
              <div className="flex h-10 w-full min-w-0 overflow-hidden rounded-xl border border-input bg-background shadow-sm transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <span
                  className="flex w-10 shrink-0 items-center justify-center self-stretch border-r border-border/60 bg-muted/40 dark:bg-muted/25"
                  aria-hidden
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                </span>
                <Input
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  disabled={isMultipleBuyerAccounts}
                  className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 md:text-sm"
                  autoComplete="off"
                  placeholder={isMultipleBuyerAccounts ? "여러 주문 생성 시 주문번호는 비워집니다" : "쇼핑몰 주문번호 등"}
                  inputMode="text"
                />
              </div>
              {isMultipleBuyerAccounts ? (
                <p className="text-muted-foreground mt-2 text-xs leading-snug">
                  여러 구매계정의 주문을 함께 만들면 주문번호는 저장되지 않습니다.
                </p>
              ) : null}
            </FormRow>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0 sm:gap-x-4">
              <div className="min-w-0">
                <FormRow label="리뷰 사진 개수" hint="선택">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="예: 3"
                    value={reviewPhotoCount}
                    onChange={(event) => setReviewPhotoCount(event.target.value)}
                    className="h-10 rounded-xl tabular-nums md:text-sm"
                  />
                </FormRow>
              </div>
              <div className="min-w-0">
                <FormRow label="리뷰 글자 수" hint="선택">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="예: 120"
                    value={reviewCharCount}
                    onChange={(event) => setReviewCharCount(event.target.value)}
                    className="h-10 rounded-xl tabular-nums md:text-sm"
                  />
                </FormRow>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AdditionalOrderInfoSection
        scheduledPurchaseAt={scheduledPurchaseAt}
        onScheduledPurchaseAtChange={setScheduledPurchaseAt}
        orderStatus={orderStatus}
        onOrderStatusChange={setOrderStatus}
        productUrl={productUrl}
        onProductUrlChange={setProductUrl}
        notes={notes}
        onNotesChange={setNotes}
      />

      {isEditMode && order ? (
        <AiReviewPanel
          order={order}
          supabase={supabase}
          isSaving={isSaving}
          aiExtraInput={aiExtraInput}
          onAiExtraInputChange={setAiExtraInput}
          reviewCharCount={reviewCharCount}
          isProcessed={isProcessed === "true"}
          buildPayload={buildPayload}
          onToast={setToast}
        />
      ) : null}

      <OrderCompletionInfoSection
        isEditMode={isEditMode}
        isImportMode={isImportMode}
        isProcessed={isProcessed}
        onIsProcessedChange={setIsProcessed}
        depositDate={depositDate}
        onDepositDateChange={setDepositDate}
        depositAmount={depositAmount}
        onDepositAmountChange={setDepositAmount}
        depositMemo={depositMemo}
        onDepositMemoChange={setDepositMemo}
      />

      {isImportMode && importActions ? (
        <div
          className={cn(
            "sticky z-20 -mx-1 rounded-2xl border bg-background/95 px-3 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.45)] sm:mx-0",
            "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] supports-[padding:max(0px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              disabled={isSaving}
              className={cn(buttonVariants({ variant: "default", size: "default" }), "h-11 w-full touch-manipulation")}
              onClick={() =>
                saveOrder({
                  isProcessed: false,
                  onSuccess: () => {
                    router.push(importRedirectHrefRef.current ?? importActions.afterSaveHref);
                    router.refresh();
                  },
                })
              }
            >
              저장하기
            </button>
            <button
              type="button"
              disabled={isSaving}
              className={cn(
                buttonVariants({ variant: "destructive", size: "default" }),
                "h-11 w-full touch-manipulation border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white dark:border-destructive dark:bg-destructive dark:text-white dark:hover:bg-destructive/90",
              )}
              onClick={() => void deleteDraftOrder()}
            >
              삭제하기
            </button>
          </div>
        </div>
      ) : isEditMode ? (
        <>
          <div
            className={cn(
              "mt-2 flex flex-col gap-3 border-t border-border/60 pt-5",
              isDirty
                ? "pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))]"
                : "pb-[calc(4rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {isCurrentlyProcessed ? (
                <button
                  type="button"
                  disabled={isSaving}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "h-11 w-full touch-manipulation",
                  )}
                  onClick={() =>
                    saveOrder({
                      isProcessed: false,
                      onSuccess: () => {
                        setIsProcessed("false");
                        setDepositDate("");
                        setDepositAmount("");
                        setDepositMemo("");
                        router.push("/");
                        router.refresh();
                      },
                    })
                  }
                >
                  미완료처리
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSaving}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "h-11 w-full touch-manipulation",
                  )}
                  onClick={() =>
                    saveOrder({
                      isProcessed: true,
                      onSuccess: () => {
                        setIsProcessed("true");
                        router.push("/");
                        router.refresh();
                      },
                    })
                  }
                >
                  완료처리
                </button>
              )}
              <button
                type="button"
                disabled={isSaving}
                className={cn(
                  buttonVariants({ variant: "destructive", size: "default" }),
                  "h-11 w-full touch-manipulation border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white dark:border-destructive dark:bg-destructive dark:text-white dark:hover:bg-destructive/90",
                )}
                onClick={() => void deleteOrder()}
              >
                삭제하기
              </button>
            </div>
          </div>
          {isDirty ? (
            <div
              className={cn(
                "sticky z-20 -mx-1 rounded-2xl border bg-background/95 px-3 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.45)] sm:mx-0",
                "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] supports-[padding:max(0px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]",
              )}
            >
              <button
                type="button"
                disabled={isSaving}
                className={cn(buttonVariants({ variant: "default", size: "default" }), "h-11 w-full touch-manipulation")}
                onClick={() =>
                  saveOrder({
                    isProcessed: isProcessed === "true",
                    onSuccess: () => {
                      setBaseline(getFormSnapshot());
                      setToast({ type: "success", message: "저장했습니다." });
                    },
                  })
                }
              >
                저장하기
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div
          className={cn(
            "sticky z-20 -mx-1 rounded-2xl border bg-background/95 px-3 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.45)] sm:mx-0",
            "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] supports-[padding:max(0px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <Label htmlFor="order-save-action" className="shrink-0 text-xs font-medium text-muted-foreground">
              저장 후
            </Label>
            <select
              id="order-save-action"
              value={orderSaveAction}
              onChange={(event) => updateOrderSaveAction(event.target.value as OrderSaveAction)}
              className={cn(controlSelectClass, "h-9 max-w-56 text-xs")}
            >
              <option value="ledger">구매장부로 이동</option>
              <option value="same">같은 정보로 계속 등록</option>
              <option value="blank">빈 입력 화면 열기</option>
            </select>
          </div>
          <button
            type="button"
            disabled={isSaving || !draftReady}
            className={cn(buttonVariants({ variant: "default", size: "default" }), "h-11 w-full touch-manipulation")}
            onClick={() =>
              saveOrder({
                isProcessed: isProcessed === "true",
                onSuccess: handleNewOrderSaved,
              })
            }
          >
            {isProcessed === "true" ? "완료로 처리하기" : "추가하기"}
          </button>
        </div>
      )}
    </div>
  );
}
