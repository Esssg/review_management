"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bot,
  Building2,
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
import {
  setOrderDetailBackHandler,
  type OrderDetailBackResult,
} from "@/lib/order-detail-leave-guard";
import { buildKakaoPasteLine, type PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { streamAiReviewFromEdge } from "@/lib/stream-ai-review";
import { createClient } from "@/lib/supabase/client";
import type { BuyerAccount, PaymentMethod, Platform } from "@/lib/master-data";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

type OrderWithRelations = OrderRow & {
  platforms: { id: string; name: string; color: string } | null;
  payment_methods: { id: string; name: string; color: string } | null;
  buyer_accounts: { id: string; label: string; color: string } | null;
  purchase_info_templates?: PurchaseTemplateRow | null;
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
  ai_review_user_prompt: string;
};

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

const TOAST_MS = 3000;

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
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-md ring-1 ring-white/10 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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

export function OrderDetailForm({
  order,
  platforms,
  paymentMethods,
  buyerAccounts,
}: {
  order?: OrderWithRelations;
  platforms: Platform[];
  paymentMethods: PaymentMethod[];
  buyerAccounts: BuyerAccount[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const isEditMode = Boolean(order);

  const [kakaoRoomName, setKakaoRoomName] = useState(order?.title ?? "");
  const [orderNumber, setOrderNumber] = useState(order?.order_number ?? "");
  const [productName, setProductName] = useState(order?.product_name ?? "");
  const [platformId, setPlatformId] = useState(order?.platform_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(order?.payment_method_id ?? "");
  const [buyerAccountId, setBuyerAccountId] = useState(order?.buyer_account_id ?? "");
  const [linkedPurchaseTemplateId, setLinkedPurchaseTemplateId] = useState(
    order?.purchase_info_template_id ?? "",
  );
  const [purchaseDate, setPurchaseDate] = useState(() => {
    if (order?.purchase_date) return order.purchase_date;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  });
  const [depositDate, setDepositDate] = useState(order?.deposit_date ?? "");
  const [purchasePrice, setPurchasePrice] = useState<string>(String(order?.purchase_price_krw ?? "0"));
  const [reviewPhotoCount, setReviewPhotoCount] = useState<string>(
    order?.review_photo_count != null ? String(order.review_photo_count) : "",
  );
  const [reviewCharCount, setReviewCharCount] = useState<string>(
    order?.review_char_count != null ? String(order.review_char_count) : "",
  );
  const [depositAmount, setDepositAmount] = useState<string>(String(order?.deposit_amount_krw ?? ""));
  const [isItemDelivered, setIsItemDelivered] = useState(order ? (order.is_item_delivered ? "true" : "false") : "");
  const [isProcessed, setIsProcessed] = useState(order?.is_processed ? "true" : "false");
  const [depositMemo, setDepositMemo] = useState(order?.deposit_memo ?? "");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [purchaseTemplates, setPurchaseTemplates] = useState<PurchaseTemplateRow[]>([]);
  const [aiExtraInput, setAiExtraInput] = useState(order?.ai_review_user_prompt ?? "");
  const [aiReviewText, setAiReviewText] = useState(order?.ai_review ?? "");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStreamError, setAiStreamError] = useState<string | null>(null);
  const lastAiOrderIdRef = useRef<string | undefined>(undefined);
  /** 부모 `order.ai_review` 중 마지막으로 반영한 값(재생성 직후 DB는 아직 옛값일 때 로컬 결과를 덮지 않기 위함) */
  const lastSyncedServerAiReviewRef = useRef<string | undefined>(undefined);
  const isCurrentlyProcessed = isProcessed === "true";

  const [baseline, setBaseline] = useState<OrderFormSnapshot | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const leaveActionRef = useRef<
    | null
    | { kind: "back"; resolve: (r: OrderDetailBackResult) => void }
    | { kind: "link"; href: string }
  >(null);
  const leaveModalOpenRef = useRef(false);
  const isDirtyRef = useRef(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
      setIsNative(true);
    }
  }, []);

  const purchaseInfoHints = useMemo(
    () =>
      isNative
        ? {
            kakaoRoom: "카톡방 이름",
            product: "물품명 입력",
            delivery: "실 배송 여부",
          }
        : {
            kakaoRoom: "카톡방 이름을 입력해주세요",
            product: "알아보기 쉽게 물품명을 입력해주세요",
            delivery: "실 배송 여부를 선택해주세요",
          },
    [isNative],
  );

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
    aiExtraInput,
  ]);

  const isDirty = useMemo(() => {
    if (!isEditMode || !order || !baseline) return false;
    return JSON.stringify(getFormSnapshot()) !== JSON.stringify(baseline);
  }, [isEditMode, order, baseline, getFormSnapshot]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    leaveModalOpenRef.current = leaveModalOpen;
  }, [leaveModalOpen]);

  const requestAndroidBack = useCallback((): Promise<OrderDetailBackResult> => {
    if (!isDirtyRef.current) return Promise.resolve("proceed-with-back");
    return new Promise((resolve) => {
      leaveActionRef.current = { kind: "back", resolve };
      setLeaveModalOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setOrderDetailBackHandler(null);
      return;
    }
    setOrderDetailBackHandler(requestAndroidBack);
    return () => setOrderDetailBackHandler(null);
  }, [isEditMode, requestAndroidBack]);

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
    const oid = order?.id;
    const fromDb = order?.ai_review ?? "";
    if (oid !== lastAiOrderIdRef.current) {
      lastAiOrderIdRef.current = oid;
      lastSyncedServerAiReviewRef.current = fromDb;
      setAiReviewText(fromDb);
      return;
    }
    if (aiGenerating) return;
    if (fromDb === lastSyncedServerAiReviewRef.current) return;
    lastSyncedServerAiReviewRef.current = fromDb;
    setAiReviewText(fromDb);
  }, [order?.id, order?.ai_review, aiGenerating]);

  useEffect(() => {
    setAiExtraInput(order?.ai_review_user_prompt ?? "");
  }, [order?.id, order?.ai_review_user_prompt]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
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
  }, []);

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
      setToast({ type: "error", message: "복사에 실패했습니다. 앱을 다시 빌드(cap sync)한 뒤 다시 시도해 주세요." });
    }
  };

  const normalizeNumber = (value: unknown, fieldLabel: string) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      return { error: `${fieldLabel}을(를) 입력해 주세요.` as const };
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `${fieldLabel}은(는) 0 이상의 숫자만 입력할 수 있습니다.` as const };
    }

    return { value: parsed };
  };

  const normalizeOptionalNumber = (value: unknown, fieldLabel: string) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return { value: null };

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `${fieldLabel}은(는) 0 이상의 숫자만 입력할 수 있습니다.` as const };
    }

    return { value: parsed };
  };

  const buildPayload = (nextIsProcessed: boolean): { payload?: Database["public"]["Tables"]["orders"]["Insert"]; error?: string } => {
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
      !buyerAccountId ||
      !purchaseDateValue ||
      (isItemDelivered !== "true" && isItemDelivered !== "false")
    ) {
      return { error: "필수 입력값을 확인해 주세요." };
    }

    const selectedPlatform = platforms.find((p) => p.id === platformId);
    const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
    const selectedAccount = buyerAccounts.find((a) => a.id === buyerAccountId);

    if (!selectedPlatform || !selectedMethod || !selectedAccount) {
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

    return {
      payload: {
        title: kakaoRoomNameValue,
        order_number: orderNumberValue || null,
        product_name: productNameValue,
        platform_id: platformId,
        payment_method_id: paymentMethodId,
        buyer_account_id: buyerAccountId,
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
        ai_review_user_prompt: aiExtraInput.trim() || null,
      } satisfies Database["public"]["Tables"]["orders"]["Insert"],
    };
  };

  const persistOrder = async (nextIsProcessed: boolean): Promise<boolean> => {
    setToast(null);
    setIsSaving(true);
    try {
      const { payload, error } = buildPayload(nextIsProcessed);
      if (error || !payload) {
        setToast({ type: "error", message: error ?? "입력값을 확인해 주세요." });
        return false;
      }

      const query = isEditMode
        ? supabase.from("orders").update(payload).eq("id", order!.id)
        : supabase.from("orders").insert(payload);
      const { error: saveError } = await query;

      if (saveError) {
        setToast({ type: "error", message: saveError.message });
        return false;
      }

      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const saveOrder = async ({
    isProcessed: nextProcessed,
    onSuccess,
  }: {
    isProcessed: boolean;
    onSuccess: () => void;
  }) => {
    const ok = await persistOrder(nextProcessed);
    if (ok) onSuccess();
  };

  const closeLeaveFlow = () => {
    setLeaveModalOpen(false);
    leaveActionRef.current = null;
  };

  const onLeaveStay = () => {
    const ctx = leaveActionRef.current;
    if (ctx?.kind === "back") ctx.resolve("cancelled");
    closeLeaveFlow();
  };

  const onLeaveDiscardNavigate = () => {
    const ctx = leaveActionRef.current;
    setLeaveModalOpen(false);
    leaveActionRef.current = null;
    if (ctx?.kind === "link") {
      router.push(ctx.href);
      router.refresh();
      return;
    }
    if (ctx?.kind === "back") {
      ctx.resolve("handled");
      window.history.back();
    }
  };

  const onLeaveSaveNavigate = async () => {
    const ctx = leaveActionRef.current;
    const ok = await persistOrder(isProcessed === "true");
    if (!ok) {
      if (ctx?.kind === "back") ctx.resolve("cancelled");
      closeLeaveFlow();
      return;
    }
    setBaseline(getFormSnapshot());
    setLeaveModalOpen(false);
    leaveActionRef.current = null;
    if (ctx?.kind === "link") {
      router.push(ctx.href);
      router.refresh();
      return;
    }
    if (ctx?.kind === "back") {
      ctx.resolve("handled");
      window.history.back();
    }
  };

  const copyAiReviewResult = async () => {
    const t = aiReviewText.trim();
    if (!t) {
      setToast({ type: "error", message: "복사할 리뷰 내용이 없습니다." });
      return;
    }
    try {
      await copyTextToClipboard(t);
      setToast({ type: "success", message: "클립보드에 복사했습니다." });
    } catch {
      setToast({ type: "error", message: "복사에 실패했습니다. 앱을 다시 빌드(cap sync)한 뒤 다시 시도해 주세요." });
    }
  };

  const runAiReviewGeneration = async () => {
    if (!isEditMode || !order?.id) return;
    setAiStreamError(null);
    setAiGenerating(true);

    const { payload, error: payloadError } = buildPayload(isProcessed === "true");
    if (payloadError || !payload) {
      setAiGenerating(false);
      setToast({ type: "error", message: payloadError ?? "입력값을 확인해 주세요." });
      return;
    }

    const { error: preSaveError } = await supabase.from("orders").update(payload).eq("id", order.id);
    if (preSaveError) {
      setAiGenerating(false);
      setToast({ type: "error", message: preSaveError.message });
      return;
    }

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
        onDelta: (d) => setAiReviewText((t) => t + d),
      });
      if (!result.ok) {
        setAiStreamError(result.error);
        setToast({ type: "error", message: result.error });
      } else {
        setToast({ type: "success", message: "AI 리뷰가 생성되어 저장되었습니다." });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiStreamError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setAiGenerating(false);
    }
  };

  const deleteOrder = async () => {
    if (!isEditMode) return;

    const confirmed = window.confirm(`"${order!.product_name}" 주문을 삭제할까요?`);
    if (!confirmed) return;

    setToast(null);
    setIsSaving(true);

    try {
      const { error } = await supabase.from("orders").delete().eq("id", order!.id);
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
                    placeholder={purchaseInfoHints.kakaoRoom}
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
                    placeholder={purchaseInfoHints.product}
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
                        {purchaseInfoHints.delivery}
                      </option>
                    ) : null}
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </select>
                </FormRow>
              </div>
            </div>
            <div className="grid grid-cols-3 items-start gap-x-2 gap-y-0 sm:gap-x-3">
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
                </FormRow>
              </div>
              <div className="min-w-0">
                <FormRow label="구매 계정" required>
                  <EntitySelect
                    icon={UserCircle}
                    aria-label="구매 계정"
                    value={buyerAccountId}
                    onChange={setBuyerAccountId}
                    options={buyerAccounts.map((a) => ({ id: a.id, name: a.label }))}
                    placeholder="구매 계정을 선택해 주세요"
                    emptyHint="등록된 구매 계정이 없습니다. 설정에서 추가해 주세요."
                  />
                </FormRow>
              </div>
            </div>
            <FormRow label="주문번호" hint="선택 · 비워도 저장됩니다">
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
                  className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 md:text-sm"
                  autoComplete="off"
                  placeholder="쇼핑몰 주문번호 등"
                  inputMode="text"
                />
              </div>
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

      {isEditMode && order ? (
        <Card className="shadow-sm ring-border/60" size="sm">
          <CardHeader className="border-border/60 border-b pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-800 ring-1 ring-violet-500/20 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/25">
                <Bot className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">AI 리뷰</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Gemini로 초안을 만들고 이 주문에 자동 저장합니다. 생성 중에 다른 화면으로 이동해도 서버에서 끝까지 처리된 뒤 여기에 반영됩니다(다시 들어오면 최신 내용이 보입니다).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2 py-2">
              <Label className="text-foreground text-sm font-medium">AI에게 전달할 추가 정보</Label>
              <p className="text-muted-foreground text-xs">
                상품 특징·촬영 조건·톤 등 리뷰에 반영하고 싶은 내용을 적어 주세요. 비워도 됩니다.
              </p>
              <textarea
                rows={3}
                value={aiExtraInput}
                onChange={(e) => setAiExtraInput(e.target.value)}
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
        </Card>
      ) : null}

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
            {!isEditMode ? (
              <FormRow label="입금 완료 여부" hint="처음부터 완료로 넣을 때만 선택">
                <select
                  value={isProcessed}
                  onChange={(event) => setIsProcessed(event.target.value)}
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
                  onChange={(event) => setDepositDate(event.target.value)}
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
                  onChange={(event) => setDepositAmount(event.target.value)}
                  className="h-10 rounded-xl tabular-nums md:text-sm"
                />
              </FormRow>
            </div>
            <FormRow label="입금 메모">
              <textarea
                rows={3}
                value={depositMemo}
                onChange={(event) => setDepositMemo(event.target.value)}
                className={controlTextareaClass}
                placeholder="입금 확인 메모가 있으면 적어 주세요"
              />
            </FormRow>
          </div>
        </CardContent>
      </Card>

      {isEditMode ? (
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
          <button
            type="button"
            disabled={isSaving}
            className={cn(buttonVariants({ variant: "default", size: "default" }), "h-11 w-full touch-manipulation")}
            onClick={() =>
              saveOrder({
                isProcessed: isProcessed === "true",
                onSuccess: () => {
                  router.push("/");
                  router.refresh();
                },
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
