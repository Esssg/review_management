"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Banknote, Building2, ChevronRight, CreditCard, RefreshCw, ShoppingBag, Sparkles, Trash2, UserCircle, Wallet } from "lucide-react";

import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { OrderDetailForm } from "@/components/orders/order-detail-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { normalizeHexColor } from "@/lib/color";
import { fetchMasterData, type BuyerAccount, type MasterData, type PaymentMethod, type Platform } from "@/lib/master-data";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type CrawlOrderRow = Database["public"]["Tables"]["crawl_orders"]["Row"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type PlatformAccountRow = Pick<Database["public"]["Tables"]["platform_accounts"]["Row"], "id" | "name" | "status">;
type CapacitorWindow = Window & typeof globalThis & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

type PagePhase = "loading" | "ready" | "error";

const crawlListHref = "/menu-4";
// 웹(Vercel) 빌드는 같은 도메인의 서버 프록시를 사용하고, 서버 라우트가 없는 APK 빌드만
// NEXT_PUBLIC_CRAWL_API_BASE_URL로 지정한 외부 크롤링 서버를 직접 호출합니다.
const crawlProxyPath = "/api/crawl/coupang";
const apkCrawlApiBaseUrl = process.env.NEXT_PUBLIC_CRAWL_API_BASE_URL?.trim() || crawlProxyPath;
const DEFAULT_PLATFORM_COLOR = "#64748b";
const DEFAULT_PAYMENT_METHOD_COLOR = "#7c3aed";
const DEFAULT_BUYER_ACCOUNT_COLOR = "#64748b";

function isNativeCapacitorRuntime() {
  if (typeof window === "undefined") return false;
  return (window as CapacitorWindow).Capacitor?.isNativePlatform?.() === true;
}

function getCrawlApiBaseUrl() {
  // 웹 번들에 APK용 환경변수가 섞여도 브라우저에서는 CORS를 피하려고 항상 프록시를 사용합니다.
  if (process.env.NEXT_PUBLIC_BUILD_TARGET === "apk" && isNativeCapacitorRuntime()) return apkCrawlApiBaseUrl;
  return crawlProxyPath;
}

function readValue(row: CrawlOrderRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function readText(row: CrawlOrderRow, keys: string[]) {
  const value = readValue(row, keys);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function readNumber(row: CrawlOrderRow, keys: string[]) {
  const value = readValue(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function readDate(row: CrawlOrderRow, keys: string[]) {
  const value = readText(row, keys);
  if (!value) return null;

  const dateOnly = value.includes("T") ? value.split("T")[0] : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
}

function readBoolean(row: CrawlOrderRow, keys: string[]) {
  const value = readValue(row, keys);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "완료", "배송"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "미완료", "미배송"].includes(normalized)) return false;
  return null;
}

function findByName<T extends Platform | PaymentMethod>(
  items: T[],
  row: CrawlOrderRow,
  idKeys: string[],
  nameKeys: string[],
) {
  const id = readText(row, idKeys);
  if (id && items.some((item) => item.id === id)) return id;

  const name = readText(row, nameKeys);
  if (!name) return "";
  return items.find((item) => item.name === name)?.id ?? "";
}

function findBuyerAccount(accounts: BuyerAccount[], row: CrawlOrderRow) {
  const id = readText(row, ["buyer_account_id", "buyerAccountId"]);
  if (id && accounts.some((account) => account.id === id)) return id;

  const label = readText(row, ["buyer_account_label", "buyerAccountLabel", "buyer_account", "buyerAccount"]);
  if (!label) return "";
  return accounts.find((account) => account.label === label)?.id ?? "";
}

function relationById<T extends { id: string }>(items: T[], id: string) {
  return id ? items.find((item) => item.id === id) ?? null : null;
}

function displayPlatformAccountName(account: PlatformAccountRow) {
  return account.name.trim() || "이름 없는";
}

function displayPrimary(row: CrawlOrderRow) {
  return (
    readText(row, ["product_name", "productName", "item_name", "itemName", "goods_name", "product_title", "name"]) ||
    readText(row, ["title", "kakao_room_name", "kakaoRoomName", "room_name", "chat_room_name"]) ||
    "이름 없는 크롤링 주문"
  );
}

function displaySecondary(row: CrawlOrderRow) {
  return [
    readText(row, ["title", "kakao_room_name", "kakaoRoomName", "room_name", "chat_room_name"]),
    readText(row, ["order_number", "orderNumber", "external_order_number", "mall_order_number"]),
    readDate(row, ["purchase_date", "purchaseDate", "order_date", "ordered_at", "purchased_at", "created_at"]),
  ]
    .filter(Boolean)
    .join(" · ");
}

function displayMeta(row: CrawlOrderRow, master: MasterData | null) {
  const platformId = readText(row, ["platform_id", "platformId"]);
  const paymentMethodId = readText(row, ["payment_method_id", "paymentMethodId"]);
  const buyerAccountId = readText(row, ["buyer_account_id", "buyerAccountId"]);
  const platformName = readText(row, ["platform_name", "platformName", "platform"]);
  const paymentMethodName = readText(row, ["payment_method_name", "paymentMethodName", "payment_method", "paymentMethod"]);
  const buyerAccountLabel = readText(row, ["buyer_account_label", "buyerAccountLabel", "buyer_account", "buyerAccount"]);
  const platform = master?.platforms.find((item) => item.id === platformId) ??
    master?.platforms.find((item) => item.name === platformName);
  const paymentMethod = master?.paymentMethods.find((item) => item.id === paymentMethodId) ??
    master?.paymentMethods.find((item) => item.name === paymentMethodName);
  const buyerAccount = master?.buyerAccounts.find((item) => item.id === buyerAccountId) ??
    master?.buyerAccounts.find((item) => item.label === buyerAccountLabel);

  return {
    platform: {
      label: platform?.name ?? (platformName || "미지정"),
      color: platform?.color ?? DEFAULT_PLATFORM_COLOR,
    },
    paymentMethod: {
      label: paymentMethod?.name ?? (paymentMethodName || "미지정"),
      color: paymentMethod?.color ?? DEFAULT_PAYMENT_METHOD_COLOR,
    },
    buyerAccount: {
      label: buyerAccount?.label ?? (buyerAccountLabel || "미지정"),
      color: buyerAccount?.color ?? DEFAULT_BUYER_ACCOUNT_COLOR,
    },
  };
}

function metaChipStyle(color: string, fallback: string): CSSProperties {
  const base = normalizeHexColor(color, fallback);
  return {
    color: base,
  };
}

function MetaChip({
  icon: Icon,
  label,
  color,
  fallback,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  color: string;
  fallback: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center rounded-lg border border-slate-200/80 bg-white font-medium shadow-xs dark:border-slate-600 dark:bg-slate-800/80",
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" style={metaChipStyle(color, fallback)} aria-hidden /> : null}
      <span className="truncate" style={metaChipStyle(color, fallback)}>{label}</span>
    </span>
  );
}

function getPaymentMethodIcon(name: string): LucideIcon {
  const lower = name.trim().toLowerCase();
  if (lower.includes("현금") || lower.includes("cash")) return Banknote;
  if (lower.includes("카드") || lower.includes("card")) return CreditCard;
  if (lower.includes("페이") || lower.includes("pay")) return Wallet;
  return Wallet;
}

function AutoRecommendMetaChips({
  row,
  master,
  compact = false,
}: {
  row: CrawlOrderRow;
  master: MasterData | null;
  compact?: boolean;
}) {
  const meta = displayMeta(row, master);
  const chipClass = cn(
    "gap-1 px-2 py-0.5",
    compact ? "text-[10px]" : "text-[11px]",
  );

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      <MetaChip
        icon={Building2}
        label={meta.platform.label}
        color={meta.platform.color}
        fallback={DEFAULT_PLATFORM_COLOR}
        className={chipClass}
      />
      <MetaChip
        icon={getPaymentMethodIcon(meta.paymentMethod.label)}
        label={meta.paymentMethod.label}
        color={meta.paymentMethod.color}
        fallback={DEFAULT_PAYMENT_METHOD_COLOR}
        className={chipClass}
      />
      <MetaChip
        icon={UserCircle}
        label={meta.buyerAccount.label}
        color={meta.buyerAccount.color}
        fallback={DEFAULT_BUYER_ACCOUNT_COLOR}
        className={chipClass}
      />
    </div>
  );
}

function crawlOrderToDraft(row: CrawlOrderRow, userId: string, master: MasterData) {
  const platformId = findByName(
    master.platforms,
    row,
    ["platform_id", "platformId"],
    ["platform_name", "platformName", "platform"],
  );
  const paymentMethodId = findByName(
    master.paymentMethods,
    row,
    ["payment_method_id", "paymentMethodId"],
    ["payment_method_name", "paymentMethodName", "payment_method", "paymentMethod"],
  );
  const buyerAccountId = findBuyerAccount(master.buyerAccounts, row);

  // crawl_orders 컬럼명이 바뀌어도 같은 의미의 값이면 기존 주문 입력칸에 미리 채웁니다.
  return {
    id: row.id,
    user_id: userId,
    title: readText(row, ["title", "kakao_room_name", "kakaoRoomName", "room_name", "chat_room_name"]) || null,
    order_number:
      readText(row, ["order_number", "orderNumber", "external_order_number", "mall_order_number"]) || null,
    product_name: displayPrimary(row) === "이름 없는 크롤링 주문" ? null : displayPrimary(row),
    platform_id: platformId || null,
    payment_method_id: paymentMethodId || null,
    buyer_account_id: buyerAccountId || null,
    purchase_date: readDate(row, ["purchase_date", "purchaseDate", "order_date", "ordered_at", "purchased_at"]),
    deposit_date: readDate(row, ["deposit_date", "depositDate"]),
    purchase_price_krw: readNumber(row, ["purchase_price_krw", "purchase_price", "price", "product_price", "amount", "total_price", "total_amount", "payment_amount"]),
    deposit_amount_krw: readNumber(row, ["deposit_amount_krw", "deposit_amount", "depositAmount"]),
    is_item_delivered: readBoolean(row, ["is_item_delivered", "item_delivered", "is_delivered", "delivered"]),
    is_processed: false,
    deposit_memo: readText(row, ["deposit_memo", "depositMemo"]) || null,
    notes: readText(row, ["notes", "memo", "description"]) || null,
    product_url: readText(row, ["product_url", "productUrl", "item_url", "url"]) || null,
    scheduled_purchase_at: readText(row, ["scheduled_purchase_at", "scheduledPurchaseAt"]) || null,
    screenshot_storage_path: readText(row, ["screenshot_storage_path", "screenshotStoragePath"]) || null,
    order_status: readText(row, ["order_status", "orderStatus", "status"]) || null,
    review_photo_count: readNumber(row, ["review_photo_count", "reviewPhotoCount"]),
    review_char_count: readNumber(row, ["review_char_count", "reviewCharCount"]),
    platforms: relationById(master.platforms, platformId),
    payment_methods: relationById(master.paymentMethods, paymentMethodId),
    buyer_accounts: relationById(master.buyerAccounts, buyerAccountId),
  };
}

export function CrawlOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id")?.trim() ?? "";

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<CrawlOrderRow[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CrawlOrderRow | null>(null);
  const [master, setMaster] = useState<MasterData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccountRow[]>([]);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const [crawlNotice, setCrawlNotice] = useState<string | null>(null);

  const loadPage = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/");
      return;
    }

    if (!silent) setPhase("loading");
    setErrorMessage(null);
    setEmail(user.email ?? user.id);
    setUserId(user.id);

    if (selectedId) {
      const [orderResult, masterData, platformAccountsResult] = await Promise.all([
        supabase
          .from("crawl_orders")
          .select("*")
          .eq("id", selectedId)
          .eq("user_id", user.id)
          .eq("crawl_order_status", 0)
          .maybeSingle(),
        fetchMasterData(supabase, user.id),
        supabase
          .from("platform_accounts")
          .select("id, name, status")
          .eq("user_id", user.id),
      ]);

      if (orderResult.error || platformAccountsResult.error) {
        setErrorMessage(orderResult.error?.message ?? platformAccountsResult.error?.message ?? "조회 오류가 발생했습니다.");
        setPhase("error");
        return;
      }
      if (!orderResult.data) {
        setErrorMessage("처리 대기 중인 크롤링 주문을 찾을 수 없습니다.");
        setPhase("error");
        return;
      }

      setSelectedOrder(orderResult.data);
      setMaster(masterData);
      setOrders([]);
      setPlatformAccounts(platformAccountsResult.data ?? []);
      setPhase("ready");
      return;
    }

    const [ordersResult, masterData, platformAccountsResult] = await Promise.all([
      supabase
        .from("crawl_orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("crawl_order_status", 0)
        .order("purchase_date", { ascending: false, nullsFirst: false }),
      fetchMasterData(supabase, user.id),
      supabase
        .from("platform_accounts")
        .select("id, name, status")
        .eq("user_id", user.id),
    ]);

    if (ordersResult.error || platformAccountsResult.error) {
      setErrorMessage(ordersResult.error?.message ?? platformAccountsResult.error?.message ?? "조회 오류가 발생했습니다.");
      setPhase("error");
      return;
    }

    setOrders(ordersResult.data ?? []);
    setSelectedOrder(null);
    setMaster(masterData);
    setPlatformAccounts(platformAccountsResult.data ?? []);
    setPhase("ready");
  }, [router, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  const draftOrder = useMemo(() => {
    if (!selectedOrder || !userId || !master) return null;
    return crawlOrderToDraft(selectedOrder, userId, master);
  }, [master, selectedOrder, userId]);

  const hasRunningCrawl = platformAccounts.some((account) => account.status === true);
  const isCrawlButtonDisabled = hasRunningCrawl || isStartingCrawl;
  const runningCrawlNotice =
    platformAccounts
      .filter((account) => account.status === true)
      .map((account) => `${displayPlatformAccountName(account)}계정 크롤링 중`)
      .join("\n") || "크롤링 실행중…";
  const visibleCrawlNotice = crawlNotice ?? (hasRunningCrawl ? runningCrawlNotice : null);
  const isCrawlNoticeSpinning = isStartingCrawl || (visibleCrawlNotice?.includes("크롤링 중") ?? false);

  useEffect(() => {
    if (!hasRunningCrawl) return;

    const timer = window.setInterval(() => void loadPage({ silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, [hasRunningCrawl, loadPage]);

  const startCrawl = () => {
    if (hasRunningCrawl) {
      setCrawlNotice(runningCrawlNotice);
      return;
    }

    if (platformAccounts.length === 0) {
      setCrawlNotice("연결된 플랫폼 계정이 없습니다.");
      return;
    }

    setIsStartingCrawl(true);
    setCrawlNotice(platformAccounts.map((account) => `${displayPlatformAccountName(account)}계정 크롤링 중`).join("\n"));

    const updateAccountNotice = (account: PlatformAccountRow, message: string) => {
      // 여러 계정을 동시에 요청하므로 응답이 돌아온 계정 줄만 교체합니다.
      const accountName = displayPlatformAccountName(account);
      setCrawlNotice((current) => {
        const before = current?.split("\n").filter(Boolean) ?? [];
        const runningMessage = `${accountName}계정 크롤링 중`;
        const next = before.length > 0 ? before : [runningMessage];
        const index = next.findIndex((item) => item === runningMessage || item.startsWith(`${accountName}계정 크롤링 `));

        if (index === -1) return [...next, message].join("\n");

        next[index] = message;
        return next.join("\n");
      });
    };

    const requests = platformAccounts.map((account) => {
      // 절대 URL(`http://...`)과 상대 경로(`/api/...`) 둘 다 받을 수 있게 직접 쿼리스트링을 붙입니다.
      const params = new URLSearchParams({
        platform_account_id: account.id,
        max_pages: "2",
      });
      const requestUrl = `${getCrawlApiBaseUrl()}?${params.toString()}`;

      // 응답 본문은 사용하지 않고, HTTP 성공 범위(2xx)로 계정별 요청 결과를 표시합니다.
      return fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
      }).then((response) => {
        const accountName = displayPlatformAccountName(account);
        const upstreamStatus = response.headers.get("X-Crawl-Upstream-Status") ?? String(response.status);
        const upstreamStatusText = response.headers.get("X-Crawl-Upstream-Status-Text") ?? response.statusText;

        console.info("[crawl] response", {
          accountId: account.id,
          accountName,
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          upstreamStatus,
          upstreamStatusText,
          url: response.url,
        });

        if (response.ok) {
          updateAccountNotice(account, `${accountName}계정 크롤링 완료`);
          return;
        }

        const statusLabel = upstreamStatusText ? `${upstreamStatus} ${upstreamStatusText}` : upstreamStatus;
        updateAccountNotice(account, `${accountName}계정 크롤링 실패 (HTTP ${statusLabel})`);
      }).catch((error: unknown) => {
        const accountName = displayPlatformAccountName(account);
        const errorMessage = error instanceof Error ? error.message : "알 수 없는 네트워크 오류";

        console.error("[crawl] request failed", {
          accountId: account.id,
          accountName,
          error,
          requestUrl,
        });
        updateAccountNotice(account, `${accountName}계정 크롤링 실패 (${errorMessage})`);
      });
    });

    void Promise.allSettled(requests).finally(() => {
      setIsStartingCrawl(false);
      window.setTimeout(() => void loadPage({ silent: true }), 1000);
    });
  };

  const deleteFromList = async (row: CrawlOrderRow) => {
    if (!userId) return;

    const confirmed = window.confirm(`"${displayPrimary(row)}" 항목을 삭제 처리할까요?`);
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      const supabase = createClient();
      // 목록 삭제도 상세 삭제와 동일하게 원본 행은 남기고 상태만 변경합니다.
      const { error, count } = await supabase
        .from("crawl_orders")
        .update({ crawl_order_status: 99 }, { count: "exact" })
        .eq("id", row.id)
        .eq("user_id", userId)
        .eq("crawl_order_status", 0);

      if (error) {
        window.alert(error.message);
        return;
      }
      if (count === 0) {
        window.alert("이미 처리된 추천 주문입니다.");
        await loadPage();
        return;
      }

      setOrders((prev) => prev.filter((item) => item.id !== row.id));
    } finally {
      setDeletingId(null);
    }
  };

  if (phase === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">크롤링 주문</h1>
        <p className="text-destructive text-sm">조회 오류: {errorMessage}</p>
        <Link href={crawlListHref} className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit")}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  if (selectedId && selectedOrder && draftOrder && master && userId) {
    return (
      <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">자동 추천 확인</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-snug break-words">
              저장하면 장부에 주문이 추가되고 이 항목은 처리됨으로 바뀝니다.
            </p>
          </div>
          <Link href={crawlListHref} className={cn(buttonVariants({ variant: "outline", size: "default" }), "shrink-0")}>
            목록으로
          </Link>
        </div>

        <OrderDetailForm
          key={selectedOrder.id}
          draftOrder={draftOrder}
          importActions={{
            afterSaveHref: crawlListHref,
            afterDeleteHref: crawlListHref,
            deleteConfirmLabel: `"${displayPrimary(selectedOrder)}" 항목을 삭제 처리할까요?`,
            onSave: async (payload: OrderInsert) => {
              const supabase = createClient();
              const insertResult = await supabase
                .from("orders")
                .insert({ ...payload, user_id: userId })
                .select("id")
                .single();

              if (insertResult.error) return { error: insertResult.error.message };

              // 주문 삽입 후 원본 상태를 바꿉니다. 상태 변경 실패 시 방금 넣은 주문을 되돌립니다.
              const statusResult = await supabase
                .from("crawl_orders")
                .update({ crawl_order_status: 1 }, { count: "exact" })
                .eq("id", selectedOrder.id)
                .eq("user_id", userId)
                .eq("crawl_order_status", 0);

              if (statusResult.error || statusResult.count === 0) {
                await supabase.from("orders").delete().eq("id", insertResult.data.id);
                return { error: statusResult.error?.message ?? "이미 처리된 크롤링 주문입니다." };
              }

              return {};
            },
            onDelete: async () => {
              const supabase = createClient();
              const { error, count } = await supabase
                .from("crawl_orders")
                .update({ crawl_order_status: 99 }, { count: "exact" })
                .eq("id", selectedOrder.id)
                .eq("user_id", userId)
                .eq("crawl_order_status", 0);

              if (error) return { error: error.message };
              if (count === 0) return { error: "이미 처리된 크롤링 주문입니다." };
              return {};
            },
          }}
          platforms={master.platforms}
          paymentMethods={master.paymentMethods}
          buyerAccounts={master.buyerAccounts}
        />
      </div>
    );
  }

  const matchedMetaCount = orders.filter((row) => {
    const meta = displayMeta(row, master);
    return (
      meta.platform.label !== "미지정" &&
      meta.paymentMethod.label !== "미지정" &&
      meta.buyerAccount.label !== "미지정"
    );
  }).length;
  const needsCheckCount = orders.length - matchedMetaCount;

  return (
    <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-24 pt-5 sm:px-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">자동 추천</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug break-words">
            처리 대기 상태인 추천 주문만 표시합니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10"
            disabled={isCrawlButtonDisabled}
            aria-label={isCrawlButtonDisabled ? "크롤링 실행중" : "크롤링 실행"}
            title={isCrawlButtonDisabled ? "크롤링 실행중…" : "크롤링 실행"}
            onClick={startCrawl}
          >
            <RefreshCw className={cn("h-4 w-4", isCrawlButtonDisabled ? "animate-spin" : null)} aria-hidden />
            <span className="sr-only">{isCrawlButtonDisabled ? "크롤링 실행중" : "크롤링 실행"}</span>
          </Button>
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>

      {visibleCrawlNotice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <RefreshCw className={cn("h-4 w-4 shrink-0", isCrawlNoticeSpinning ? "animate-spin" : null)} aria-hidden />
          <span className="whitespace-pre-line">{visibleCrawlNotice}</span>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-white p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-slate-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-slate-700">
            <Sparkles className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5 dark:text-slate-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-tight text-muted-foreground break-keep sm:text-xs">대기 추천</p>
            <p className="text-lg font-bold tabular-nums sm:text-2xl">{orders.length}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-emerald-50 p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-emerald-500/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-emerald-500/20">
            <ShoppingBag className="h-4 w-4 text-emerald-600 sm:h-5 sm:w-5 dark:text-emerald-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-tight break-keep text-emerald-700 sm:text-xs dark:text-emerald-300">
              자동 매칭
            </p>
            <p className="text-lg font-bold tabular-nums text-emerald-800 sm:text-2xl dark:text-emerald-200">
              {matchedMetaCount}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-amber-50 p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-amber-500/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-amber-500/20">
            <UserCircle className="h-4 w-4 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-tight break-keep text-amber-700 sm:text-xs dark:text-amber-300">
              확인 필요
            </p>
            <p className="text-lg font-bold tabular-nums text-amber-800 sm:text-2xl dark:text-amber-200">
              {needsCheckCount}
            </p>
          </div>
        </div>
      </div>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              추천 대기 목록
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {orders.length}
            </span>
          </div>
        </div>

        <div className="mt-4 max-h-[30rem] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y lg:hidden">
          {orders.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">처리할 크롤링 주문이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {orders.map((row) => (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${displayPrimary(row)} 자동 추천 확인`}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-left shadow-xs transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700/70 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                  onClick={() => router.push(`${crawlListHref}?id=${encodeURIComponent(row.id)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`${crawlListHref}?id=${encodeURIComponent(row.id)}`);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{displayPrimary(row)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {displaySecondary(row) || `ID ${row.id}`}
                    </p>
                    <div className="mt-2">
                      <AutoRecommendMetaChips row={row} master={master} />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === row.id}
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-destructive/35 bg-destructive/10 text-destructive transition-colors",
                      "hover:bg-destructive/15 active:bg-destructive/20 disabled:opacity-50",
                    )}
                    aria-label="추천 주문 삭제"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void deleteFromList(row);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-xl border shadow-xs dark:border-slate-700 lg:block">
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            <Table className="w-full table-fixed" containerClassName="overflow-visible">
              <TableHeader className="bg-slate-50/80 dark:bg-slate-700/40">
                <TableRow>
                  <TableHead className="w-[45%] px-3">추천 정보</TableHead>
                  <TableHead className="w-[13%] whitespace-nowrap px-2">플랫폼</TableHead>
                  <TableHead className="w-[13%] whitespace-nowrap px-2">결제수단</TableHead>
                  <TableHead className="w-[13%] whitespace-nowrap px-2">계정</TableHead>
                  <TableHead className="w-[7rem] whitespace-nowrap px-3 text-right">
                    <span className="sr-only">관리</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      처리할 크롤링 주문이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((row) => {
                    const meta = displayMeta(row, master);
                    const isDeleteVisible = hoveredOrderId === row.id || deletingId === row.id;
                    return (
                      <TableRow
                        key={row.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`${displayPrimary(row)} 자동 추천 확인`}
                        className="cursor-pointer border-l-2 border-l-slate-300 bg-slate-50/20 transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-l-slate-500/60 dark:hover:bg-slate-700/30"
                        onMouseEnter={() => setHoveredOrderId(row.id)}
                        onMouseLeave={() => {
                          setHoveredOrderId((currentId) => (currentId === row.id ? null : currentId));
                        }}
                        onFocus={() => setHoveredOrderId(row.id)}
                        onBlur={(event) => {
                          const nextTarget = event.relatedTarget;
                          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                            setHoveredOrderId((currentId) => (currentId === row.id ? null : currentId));
                          }
                        }}
                        onClick={() => router.push(`${crawlListHref}?id=${encodeURIComponent(row.id)}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`${crawlListHref}?id=${encodeURIComponent(row.id)}`);
                          }
                        }}
                      >
                        <TableCell className="min-w-0 px-3 py-3">
                          <p className="line-clamp-1 font-semibold">{displayPrimary(row)}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {displaySecondary(row) || `ID ${row.id}`}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-0 px-2">
                          <MetaChip
                            icon={Building2}
                            label={meta.platform.label}
                            color={meta.platform.color}
                            fallback={DEFAULT_PLATFORM_COLOR}
                            className="max-w-full gap-1 px-2 py-0.5 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="min-w-0 px-2">
                          <MetaChip
                            icon={getPaymentMethodIcon(meta.paymentMethod.label)}
                            label={meta.paymentMethod.label}
                            color={meta.paymentMethod.color}
                            fallback={DEFAULT_PAYMENT_METHOD_COLOR}
                            className="max-w-full gap-1 px-2 py-0.5 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="min-w-0 px-2">
                          <MetaChip
                            icon={UserCircle}
                            label={meta.buyerAccount.label}
                            color={meta.buyerAccount.color}
                            fallback={DEFAULT_BUYER_ACCOUNT_COLOR}
                            className="max-w-full gap-1 px-2 py-0.5 text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            tabIndex={isDeleteVisible ? 0 : -1}
                            className={cn(
                              buttonVariants({ variant: "destructive", size: "sm" }),
                              "h-8 rounded-full border-rose-200 bg-white/95 px-3 text-xs font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 focus-visible:ring-rose-300 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-rose-900/50 dark:hover:bg-rose-900/70",
                              isDeleteVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
                            )}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void deleteFromList(row);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            삭제하기
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {orders.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          삭제하면 해당 추천 주문은 목록에서 숨겨집니다.
        </p>
      ) : null}
    </div>
  );
}
