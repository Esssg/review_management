"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Banknote, Building2, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, RefreshCw, ShoppingBag, Trash2, UserCircle, Wallet } from "lucide-react";

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
type BankAccountDepositRow = Database["public"]["Tables"]["bank_account_deposit"]["Row"];
type BankAccountRow = Database["public"]["Tables"]["bank_account"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type PlatformAccountRow = Pick<Database["public"]["Tables"]["platform_accounts"]["Row"], "id" | "name" | "status">;
type DepositBankAccount = Pick<BankAccountRow, "bank_account_name" | "bank" | "bank_account_number">;
type DepositBankAccountSummary = Pick<BankAccountRow, "id" | "bank_account_name" | "bank" | "bank_account_number">;
type DepositWithAccount = BankAccountDepositRow & {
  bank_account: DepositBankAccount | null;
};
type PendingDepositOrder = Pick<
  OrderRow,
  | "id"
  | "title"
  | "product_name"
  | "purchase_date"
  | "purchase_price_krw"
  | "deposit_date"
  | "deposit_amount_krw"
  | "is_processed"
  | "is_item_delivered"
  | "platform_id"
  | "buyer_account_id"
>;
type PreparedDepositOrder = PendingDepositOrder & {
  normalizedTitle: string;
  purchaseMonthDay: string;
};
type DepositRecommendationStatus = "pending" | "completed";
type DepositRecommendation = {
  order: PendingDepositOrder;
  reason: "title" | "date";
  similarity: number | null;
};
type DepositRecommendationSection = {
  status: DepositRecommendationStatus;
  title: string;
  emptyMessage: string;
  recommendations: DepositRecommendation[];
};

type PagePhase = "loading" | "ready" | "error";

const crawlListHref = "/menu-4";
// 웹과 앱 모두 CORS가 허용된 같은 HTTPS 크롤링 API를 직접 호출합니다.
const crawlApiUrl =
  process.env.NEXT_PUBLIC_CRAWL_API_BASE_URL?.trim() ||
  "https://review-manager-api.jinitlab.com/crawl/coupang";
const DEFAULT_PLATFORM_COLOR = "#64748b";
const DEFAULT_PAYMENT_METHOD_COLOR = "#7c3aed";
const DEFAULT_BUYER_ACCOUNT_COLOR = "#64748b";
const DEPOSIT_TITLE_SIMILARITY_MIN = 1;
const DEPOSIT_TIED_SIMILARITY_MIN = 1;
const PENDING_DEPOSIT_RECOMMENDATION_LIMIT = 3;
const COMPLETED_DEPOSIT_RECOMMENDATION_LIMIT = 2;
const DEPOSIT_RECOMMENDATION_PAGE_SIZE = 1000;

const krwFormatter = new Intl.NumberFormat("ko-KR");

type RecommendationPageResult<T> = {
  data: T[];
  error: { message: string } | null;
};

// Supabase API의 최대 반환 건수를 넘어도 추천 후보를 빠짐없이 모읍니다.
async function fetchAllRecommendationPages<T>(
  fetchPage: (from: number, to: number) => Promise<RecommendationPageResult<T>>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += DEPOSIT_RECOMMENDATION_PAGE_SIZE) {
    const page = await fetchPage(from, from + DEPOSIT_RECOMMENDATION_PAGE_SIZE - 1);
    if (page.error) return { data: null, error: page.error };

    rows.push(...page.data);
    if (page.data.length < DEPOSIT_RECOMMENDATION_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
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

function formatKrw(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${krwFormatter.format(Number(value))}원`;
}

function formatDepositDate(date: string) {
  return date.replaceAll("-", ".");
}

function formatDepositTime(time: string | null) {
  if (!time) return "-";
  return time.slice(0, 5);
}

function displayPendingOrderTitle(order: PendingDepositOrder) {
  return order.title?.trim() || order.product_name || "이름 없는 주문";
}

function normalizeForSimilarity(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function similarityPercent(left: string, right: string) {
  const a = normalizeForSimilarity(left);
  const b = normalizeForSimilarity(right);
  return similarityPercentNormalized(a, b);
}

function similarityPercentNormalized(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 100;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return Math.max(0, Math.round((1 - previous[b.length] / Math.max(a.length, b.length)) * 100));
}

function areNamesLikelySamePerson(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeForSimilarity(left ?? "");
  const b = normalizeForSimilarity(right ?? "");
  if (!a || !b) return false;

  // 계좌주명은 성까지 있고 구매계정명은 이름만 있는 경우가 많아 포함 관계도 같은 사람으로 봅니다.
  return a.includes(b) || b.includes(a) || similarityPercent(a, b) >= 60;
}

function isDepositBuyerAccountMatched(deposit: DepositWithAccount, buyerAccount: BuyerAccount | null) {
  return areNamesLikelySamePerson(deposit.bank_account?.bank_account_name, buyerAccount?.label);
}

function isCompletedDepositAmountMatched(deposit: DepositWithAccount, order: PendingDepositOrder) {
  return order.is_processed && Number(order.deposit_amount_krw) === deposit.amount;
}

function readCounterpartyDatePrefix(counterparty: string) {
  const prefix = counterparty.trim().slice(0, 4);
  return /^\d{4}$/.test(prefix) ? prefix : null;
}

function purchaseDateToMonthDay(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[2]}${match[3]}` : "";
}

function includeTiedTitleRecommendations(candidates: DepositRecommendation[], limit: number) {
  if (candidates.length <= limit) return candidates;

  const limited = candidates.slice(0, limit);
  const boundarySimilarity = limited.at(-1)?.similarity ?? null;
  if (boundarySimilarity == null || boundarySimilarity < DEPOSIT_TIED_SIMILARITY_MIN) return limited;

  const tiedCount = candidates.filter((candidate) => candidate.similarity === boundarySimilarity).length;
  if (tiedCount < 3) return limited;

  // 제한선에 걸린 일치율이 3건 이상 동율이면 같은 점수의 주문을 숨기지 않습니다.
  return candidates.filter((candidate, index) => index < limit || candidate.similarity === boundarySimilarity);
}

function getDepositRecommendations(
  deposit: DepositWithAccount,
  orders: PreparedDepositOrder[],
  limit: number,
) {
  const counterparty = deposit.counterparty.trim();
  const normalizedCounterparty = normalizeForSimilarity(counterparty);

  // 입금자명 후보는 운영자가 바로 판단할 수 있게 정확/유사 일치율이 높은 순서로 제한합니다.
  const titleMatches = orders
    .map((order) => ({
      order,
      reason: "title" as const,
      similarity: similarityPercentNormalized(normalizedCounterparty, order.normalizedTitle),
    }))
    .filter((candidate) => candidate.similarity >= DEPOSIT_TITLE_SIMILARITY_MIN)
    .sort((a, b) => b.similarity - a.similarity);

  if (titleMatches.length > 0) return includeTiedTitleRecommendations(titleMatches, limit);

  const monthDay = readCounterpartyDatePrefix(counterparty);
  if (!monthDay) return [];

  return orders
    .filter((order) => order.purchaseMonthDay === monthDay)
    .slice(0, limit)
    .map((order) => ({
      order,
      reason: "date" as const,
      similarity: null,
    }));
}

function getDepositRecommendationSections(deposit: DepositWithAccount, orders: PreparedDepositOrder[]): DepositRecommendationSection[] {
  // 입금 한 건에서 바로 처리할 수 있도록 미완료와 이미 완료된 주문 후보를 함께 보여줍니다.
  const pendingOrders = orders.filter((order) => !order.is_processed);
  const completedOrders = orders.filter((order) => order.is_processed);

  return [
    {
      status: "pending",
      title: "미완료 주문",
      emptyMessage: "추천할 미완료 주문이 없습니다.",
      recommendations: getDepositRecommendations(deposit, pendingOrders, PENDING_DEPOSIT_RECOMMENDATION_LIMIT),
    },
    {
      status: "completed",
      title: "완료 주문",
      emptyMessage: "추천할 완료 주문이 없습니다.",
      recommendations: getDepositRecommendations(deposit, completedOrders, COMPLETED_DEPOSIT_RECOMMENDATION_LIMIT),
    },
  ];
}

function findTopSimilarityRecommendationOrderId(
  deposit: DepositWithAccount,
  sections: DepositRecommendationSection[],
) {
  const candidates = sections
    .flatMap((section) => section.recommendations)
    // 완료 주문은 기존 입금금액이 현재 입금액과 같을 때만 강조 후보가 됩니다.
    .filter((recommendation) => !recommendation.order.is_processed || isCompletedDepositAmountMatched(deposit, recommendation.order))
    .filter((recommendation) => recommendation.similarity != null);

  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) => (
    (candidate.similarity ?? 0) > (best.similarity ?? 0) ? candidate : best
  )).order.id;
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
  const sliderTouchStartXRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeAutoRecommendPage, setActiveAutoRecommendPage] = useState(0);
  const [orders, setOrders] = useState<CrawlOrderRow[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CrawlOrderRow | null>(null);
  const [master, setMaster] = useState<MasterData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccountRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<DepositBankAccountSummary[]>([]);
  const [deposits, setDeposits] = useState<DepositWithAccount[]>([]);
  const [depositRecommendationOrders, setDepositRecommendationOrders] = useState<PendingDepositOrder[]>([]);
  const [hasLoadedDepositData, setHasLoadedDepositData] = useState(false);
  const [isDepositDataLoading, setIsDepositDataLoading] = useState(false);
  const [expandedDepositId, setExpandedDepositId] = useState<number | null>(null);
  const [completingDepositId, setCompletingDepositId] = useState<number | null>(null);
  const [deletingDepositId, setDeletingDepositId] = useState<number | null>(null);
  const [hoveredDepositId, setHoveredDepositId] = useState<number | null>(null);
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
      setErrorMessage(
        ordersResult.error?.message ??
        platformAccountsResult.error?.message ??
        "조회 오류가 발생했습니다.",
      );
      setPhase("error");
      return;
    }

    setOrders(ordersResult.data ?? []);
    setSelectedOrder(null);
    setMaster(masterData);
    setPlatformAccounts(platformAccountsResult.data ?? []);
    if (!silent) {
      setBankAccounts([]);
      setDeposits([]);
      setDepositRecommendationOrders([]);
      setExpandedDepositId(null);
      setHasLoadedDepositData(false);
    }
    setPhase("ready");
  }, [router, selectedId]);

  const loadDepositRecommendationData = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!userId || isDepositDataLoading) return;
    if (!force && hasLoadedDepositData) return;

    setIsDepositDataLoading(true);
    try {
      const supabase = createClient();
      const [bankAccountsResult, depositsResult, pendingOrdersResult] = await Promise.all([
        // 입금 자동추천 화면에는 민감 인증값을 빼고 운영자가 확인할 계좌 정보만 가져옵니다.
        supabase
          .from("bank_account")
          .select("id, bank_account_name, bank, bank_account_number")
          .eq("user_id", userId)
          .order("id", { ascending: true }),
        // 미완료 입금 내역은 오래된 순서를 유지하며 모든 페이지를 가져옵니다.
        fetchAllRecommendationPages<DepositWithAccount>(async (from, to) => {
          const result = await supabase
            .from("bank_account_deposit")
            .select(`
              id,
              bank_account_id,
              date,
              time,
              counterparty,
              amount,
              bank_account_deposit_status,
              bank_account:bank_account_id (
                bank_account_name,
                bank,
                bank_account_number
              )
            `)
            .eq("bank_account_deposit_status", 0)
            .order("date", { ascending: true })
            .order("time", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to);

          return {
            data: (result.data ?? []) as DepositWithAccount[],
            error: result.error,
          };
        }),
        // 주문도 구매일과 ID 순서로 끝까지 가져와 최근 주문이 추천에서 누락되지 않게 합니다.
        fetchAllRecommendationPages<PendingDepositOrder>(async (from, to) => {
          const result = await supabase
            .from("orders")
            .select(
              "id, title, product_name, purchase_date, purchase_price_krw, deposit_date, deposit_amount_krw, is_processed, is_item_delivered, platform_id, buyer_account_id",
            )
            .eq("user_id", userId)
            .order("purchase_date", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to);

          return {
            data: (result.data ?? []) as PendingDepositOrder[],
            error: result.error,
          };
        }),
      ]);

      if (bankAccountsResult.error || depositsResult.error || pendingOrdersResult.error) {
        setErrorMessage(
          bankAccountsResult.error?.message ??
          depositsResult.error?.message ??
          pendingOrdersResult.error?.message ??
          "조회 오류가 발생했습니다.",
        );
        setPhase("error");
        return;
      }

      setBankAccounts((bankAccountsResult.data ?? []) as DepositBankAccountSummary[]);
      setDeposits(depositsResult.data ?? []);
      setDepositRecommendationOrders(pendingOrdersResult.data ?? []);
      setHasLoadedDepositData(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setPhase("error");
    } finally {
      setIsDepositDataLoading(false);
    }
  }, [hasLoadedDepositData, isDepositDataLoading, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  useEffect(() => {
    if (phase !== "ready" || selectedId || activeAutoRecommendPage !== 1) return;
    void loadDepositRecommendationData();
  }, [activeAutoRecommendPage, loadDepositRecommendationData, phase, selectedId]);

  const draftOrder = useMemo(() => {
    if (!selectedOrder || !userId || !master) return null;
    return crawlOrderToDraft(selectedOrder, userId, master);
  }, [master, selectedOrder, userId]);

  const preparedDepositRecommendationOrders = useMemo<PreparedDepositOrder[]>(
    () =>
      depositRecommendationOrders.map((order) => ({
        ...order,
        normalizedTitle: normalizeForSimilarity(order.title?.trim() ?? ""),
        purchaseMonthDay: purchaseDateToMonthDay(order.purchase_date),
      })),
    [depositRecommendationOrders],
  );

  const depositRecommendationVersion = useMemo(
    () => preparedDepositRecommendationOrders.map((order) => `${order.id}:${order.is_processed}:${order.deposit_amount_krw ?? ""}`).join("|"),
    [preparedDepositRecommendationOrders],
  );

  const recommendationCacheRef = useRef(new Map<string, {
    sections: DepositRecommendationSection[];
    highlightedOrderId: string | null;
    totalRecommendationCount: number;
  }>());

  useEffect(() => {
    recommendationCacheRef.current.clear();
  }, [depositRecommendationVersion]);

  const platformById = useMemo(
    () => new Map((master?.platforms ?? []).map((item) => [item.id, item])),
    [master?.platforms],
  );
  const buyerAccountById = useMemo(
    () => new Map((master?.buyerAccounts ?? []).map((item) => [item.id, item])),
    [master?.buyerAccounts],
  );

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
      // 계정별 크롤링 범위를 쿼리스트링에 담아 HTTPS API로 직접 요청합니다.
      const params = new URLSearchParams({
        platform_account_id: account.id,
        max_pages: "5",
      });
      const requestUrl = `${crawlApiUrl}?${params.toString()}`;

      // 응답 본문은 사용하지 않고, HTTP 성공 범위(2xx)로 계정별 요청 결과를 표시합니다.
      return fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
      }).then((response) => {
        const accountName = displayPlatformAccountName(account);

        console.info("[crawl] response", {
          accountId: account.id,
          accountName,
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: response.url,
        });

        if (response.ok) {
          updateAccountNotice(account, `${accountName}계정 크롤링 완료`);
          return;
        }

        const statusLabel = response.statusText
          ? `${response.status} ${response.statusText}`
          : String(response.status);
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

  const showAutoRecommendPage = (page: number) => {
    setActiveAutoRecommendPage(Math.min(1, Math.max(0, page)));
  };

  const handleSliderTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    sliderTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleSliderTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = sliderTouchStartXRef.current;
    sliderTouchStartXRef.current = null;
    if (startX == null) return;

    const endX = event.changedTouches[0]?.clientX;
    if (endX == null) return;

    const distance = endX - startX;
    if (Math.abs(distance) < 48) return;
    showAutoRecommendPage(activeAutoRecommendPage + (distance < 0 ? 1 : -1));
  };

  const deleteDepositFromList = async (deposit: DepositWithAccount) => {
    // 입금 내역도 주문 자동추천처럼 원본은 남기고 상태값만 99(삭제)로 바꿔서 목록에서 숨깁니다.
    const confirmed = window.confirm(`"${deposit.counterparty}" 입금 내역을 삭제 처리할까요?`);
    if (!confirmed) return;

    setDeletingDepositId(deposit.id);
    try {
      const supabase = createClient();
      const { error, count } = await supabase
        .from("bank_account_deposit")
        .update({ bank_account_deposit_status: 99 }, { count: "exact" })
        .eq("id", deposit.id)
        .eq("bank_account_deposit_status", 0);

      if (error) {
        window.alert(error.message);
        return;
      }
      if (count === 0) {
        window.alert("이미 처리된 입금 내역입니다.");
        await loadDepositRecommendationData({ force: true });
        return;
      }

      setDeposits((prev) => prev.filter((item) => item.id !== deposit.id));
      setExpandedDepositId((current) => (current === deposit.id ? null : current));
    } finally {
      setDeletingDepositId(null);
    }
  };

  const completeDepositRecommendation = async (deposit: DepositWithAccount, order: PendingDepositOrder) => {
    if (!userId) return;

    const confirmed = window.confirm(
      `"${displayPendingOrderTitle(order)}" 주문을 입금완료 처리하고 이 입금 내역을 매핑완료로 바꿀까요?`,
    );
    if (!confirmed) return;

    setCompletingDepositId(deposit.id);
    try {
      const supabase = createClient();
      const purchase = Number(order.purchase_price_krw);
      const profit = deposit.amount - purchase;
      // 주문 완료값을 먼저 저장한 뒤 입금 내역을 매핑완료로 바꿉니다.
      const orderResult = await supabase
        .from("orders")
        .update({
          is_processed: true,
          deposit_date: deposit.date,
          deposit_amount_krw: deposit.amount,
          deposit_memo: deposit.counterparty.trim() || null,
          profit_krw: Number.isFinite(profit) ? profit : null,
        })
        .eq("id", order.id)
        .eq("user_id", userId)
        .eq("is_processed", false)
        .select("id")
        .single();

      if (orderResult.error) {
        window.alert(orderResult.error.message);
        return;
      }

      const depositResult = await supabase
        .from("bank_account_deposit")
        .update({ bank_account_deposit_status: 1 }, { count: "exact" })
        .eq("id", deposit.id)
        .eq("bank_account_deposit_status", 0);

      if (depositResult.error) {
        window.alert(`주문은 완료 처리됐지만 입금 내역 상태 변경에 실패했습니다: ${depositResult.error.message}`);
        return;
      }

      if (depositResult.count === 0) {
        window.alert("이미 처리된 입금 내역입니다.");
        await loadDepositRecommendationData({ force: true });
        return;
      }

      setDeposits((prev) => prev.filter((item) => item.id !== deposit.id));
      setDepositRecommendationOrders((prev) => prev.filter((item) => item.id !== order.id));
      setExpandedDepositId(null);
    } finally {
      setCompletingDepositId(null);
    }
  };

  const mapCompletedDepositRecommendation = async (deposit: DepositWithAccount, order: PendingDepositOrder) => {
    const confirmed = window.confirm(
      `"${displayPendingOrderTitle(order)}" 완료 주문으로 확인하고 이 입금 내역을 매핑완료로 바꿀까요?`,
    );
    if (!confirmed) return;

    setCompletingDepositId(deposit.id);
    try {
      const supabase = createClient();
      // 이미 완료된 주문은 입금 정보를 덮어쓰지 않고 입금 내역만 처리 완료로 숨깁니다.
      const { error, count } = await supabase
        .from("bank_account_deposit")
        .update({ bank_account_deposit_status: 1 }, { count: "exact" })
        .eq("id", deposit.id)
        .eq("bank_account_deposit_status", 0);

      if (error) {
        window.alert(error.message);
        return;
      }
      if (count === 0) {
        window.alert("이미 처리된 입금 내역입니다.");
        await loadDepositRecommendationData({ force: true });
        return;
      }

      setDeposits((prev) => prev.filter((item) => item.id !== deposit.id));
      setExpandedDepositId(null);
    } finally {
      setCompletingDepositId(null);
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
  const activePageTitle = activeAutoRecommendPage === 0 ? "주문 내역 자동 추천" : "입금 내역 자동 추천";
  const activePageDescription =
    activeAutoRecommendPage === 0
      ? "구매장부에 등록되지 않은 구매 주문 건을 표시합니다"
      : "입금 내역과 일치할 가능성이 높은 주문건을 표시합니다";
  const canGoPrev = activeAutoRecommendPage > 0;
  const canGoNext = activeAutoRecommendPage < 1;
  const renderDepositRecommendationList = (deposit: DepositWithAccount) => {
    const cacheKey = `${deposit.id}:${deposit.amount}:${deposit.counterparty}:${depositRecommendationVersion}`;
    const cached = recommendationCacheRef.current.get(cacheKey);
    const recommendationResult = cached ?? (() => {
      const sections = getDepositRecommendationSections(deposit, preparedDepositRecommendationOrders);
      const highlightedOrderId = findTopSimilarityRecommendationOrderId(deposit, sections);
      const totalRecommendationCount = sections.reduce(
        (sum, section) => sum + section.recommendations.length,
        0,
      );
      const next = { sections, highlightedOrderId, totalRecommendationCount };
      recommendationCacheRef.current.set(cacheKey, next);
      return next;
    })();
    const recommendationSections = recommendationResult.sections;
    const highlightedOrderId = recommendationResult.highlightedOrderId;
    const totalRecommendationCount = recommendationResult.totalRecommendationCount;

    if (totalRecommendationCount === 0) {
      return (
        <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-muted-foreground dark:bg-slate-900/50">
          추천할 주문이 없습니다.
        </p>
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {recommendationSections.map((section) => (
          <div key={section.status} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{section.title}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {section.recommendations.length}
              </span>
            </div>
            {section.recommendations.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-muted-foreground dark:bg-slate-900/50">
                {section.emptyMessage}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {section.recommendations.map(({ order, reason, similarity }) => {
                  // 후보 한 줄에 어떤 플랫폼/계정으로 구매했는지 한눈에 보여주려고 마스터에서 색상을 찾아 옵니다.
                  const platform = order.platform_id ? platformById.get(order.platform_id) ?? null : null;
                  const buyerAccount = order.buyer_account_id ? buyerAccountById.get(order.buyer_account_id) ?? null : null;
                  const platformColor = normalizeHexColor(platform?.color ?? "", DEFAULT_PLATFORM_COLOR);
                  const buyerAccountColor = normalizeHexColor(buyerAccount?.color ?? "", DEFAULT_BUYER_ACCOUNT_COLOR);
                  const isAccountOwnerMatched = isDepositBuyerAccountMatched(deposit, buyerAccount);
                  const isAmountMatched = isCompletedDepositAmountMatched(deposit, order);
                  const isTopSimilarity = highlightedOrderId === order.id;
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "flex min-w-0 flex-col gap-3 rounded-xl border p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between",
                        isTopSimilarity
                          ? "border-amber-200 bg-amber-50/80 ring-1 ring-amber-200 dark:border-amber-500/40 dark:bg-amber-500/10 dark:ring-amber-500/25"
                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold">{displayPendingOrderTitle(order)}</p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              reason === "title" && similarity === 100
                                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/30"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
                            )}
                          >
                            {reason === "title" ? `일치율 ${similarity ?? 0}%` : "구매일 일치"}
                          </span>
                          {isAccountOwnerMatched ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/30">
                              계좌주 일치
                            </span>
                          ) : null}
                          {isAmountMatched ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-500/30">
                              입금금액 일치
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium dark:border-slate-700 dark:bg-slate-800"
                            title={platform?.name ?? "플랫폼 미지정"}
                            aria-label={`플랫폼 ${platform?.name ?? "미지정"}`}
                          >
                            <Building2 className="h-3.5 w-3.5" style={{ color: platformColor }} aria-hidden />
                            <span className="truncate" style={{ color: platformColor }}>{platform?.name ?? "미지정"}</span>
                          </span>
                          <span
                            className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium dark:border-slate-700 dark:bg-slate-800"
                            title={buyerAccount?.label ?? "구매계정 미지정"}
                            aria-label={`구매계정 ${buyerAccount?.label ?? "미지정"}`}
                          >
                            <UserCircle className="h-3.5 w-3.5" style={{ color: buyerAccountColor }} aria-hidden />
                            <span className="truncate" style={{ color: buyerAccountColor }}>{buyerAccount?.label ?? "미지정"}</span>
                          </span>
                          <p className="min-w-0 flex-1 basis-full truncate text-xs text-slate-700 sm:basis-auto dark:text-slate-300">
                            {order.product_name || "상품명 미정"}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          구매일 {formatDepositDate(order.purchase_date)} · 구매금액 {formatKrw(order.purchase_price_krw)}
                        </p>
                        {order.is_processed ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            기존 입금일 {order.deposit_date ? formatDepositDate(order.deposit_date) : "-"} · 기존 입금금액 {formatKrw(order.deposit_amount_krw)}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={order.is_processed ? "outline" : "default"}
                        className="w-full sm:w-auto"
                        disabled={completingDepositId === deposit.id}
                        onClick={() => {
                          if (order.is_processed) {
                            void mapCompletedDepositRecommendation(deposit, order);
                            return;
                          }
                          void completeDepositRecommendation(deposit, order);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        {order.is_processed ? "매핑완료" : "완료처리"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  const renderOrderAutoRecommendPage = () => (
    <div className="flex w-full shrink-0 flex-col gap-5">
      <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-white p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-slate-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-slate-700">
            <ShoppingBag className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5 dark:text-slate-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-tight text-muted-foreground break-keep sm:text-xs">대기 추천</p>
            <p className="text-lg font-bold tabular-nums sm:text-2xl">{orders.length}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-emerald-50 p-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:p-4 dark:bg-emerald-500/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 sm:h-11 sm:w-11 sm:rounded-2xl dark:bg-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 sm:h-5 sm:w-5 dark:text-emerald-300" aria-hidden />
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
  const renderDepositAutoRecommendPage = () => (
    <div className="flex w-full shrink-0 flex-col gap-5">
      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">입금 계좌</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {bankAccounts.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {isDepositDataLoading && !hasLoadedDepositData ? (
            <p className="text-muted-foreground py-4 text-center text-sm sm:col-span-2">불러오는 중…</p>
          ) : bankAccounts.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm sm:col-span-2">등록된 입금 계좌가 없습니다.</p>
          ) : (
            bankAccounts.map((account) => (
              <div
                key={account.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <p className="truncate text-sm font-semibold">{account.bank_account_name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {account.bank} · {account.bank_account_number}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              입금 미완료 목록
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {deposits.length}
            </span>
          </div>
        </div>

        <div className="mt-4 max-h-[30rem] min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y lg:hidden">
          {isDepositDataLoading && !hasLoadedDepositData ? (
            <p className="text-muted-foreground py-8 text-center text-sm">불러오는 중…</p>
          ) : deposits.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">처리할 입금 내역이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {deposits.map((deposit) => {
                const isExpanded = expandedDepositId === deposit.id;
                return (
                  <div
                    key={deposit.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/60 shadow-xs dark:border-slate-700/70 dark:bg-slate-900/40"
                  >
                    <div className="flex min-w-0 items-center gap-2 pr-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedDepositId((current) => (current === deposit.id ? null : deposit.id))}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{deposit.counterparty}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {formatDepositDate(deposit.date)} {formatDepositTime(deposit.time)} · {deposit.bank_account?.bank_account_name ?? "계좌 미확인"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums">{formatKrw(deposit.amount)}</p>
                        <ChevronRight
                          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isExpanded ? "rotate-90" : null)}
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        disabled={deletingDepositId === deposit.id}
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-destructive/35 bg-destructive/10 text-destructive transition-colors",
                          "hover:bg-destructive/15 active:bg-destructive/20 disabled:opacity-50",
                        )}
                        aria-label="입금 내역 삭제"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void deleteDepositFromList(deposit);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                        {renderDepositRecommendationList(deposit)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-xl border shadow-xs dark:border-slate-700 lg:block">
          <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
            <Table className="w-full table-fixed" containerClassName="overflow-visible">
              <TableHeader className="bg-slate-50/80 dark:bg-slate-700/40">
                <TableRow>
                  <TableHead className="w-[16%] px-3">입금일</TableHead>
                  <TableHead className="w-[16%] px-2">계좌</TableHead>
                  <TableHead className="w-[28%] px-2">입금자</TableHead>
                  <TableHead className="w-[16%] px-2 text-right">금액</TableHead>
                  <TableHead className="w-[10rem] px-3 text-right">
                    <span className="sr-only">관리</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDepositDataLoading && !hasLoadedDepositData ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      불러오는 중…
                    </TableCell>
                  </TableRow>
                ) : deposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      처리할 입금 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  deposits.map((deposit) => {
                    const isExpanded = expandedDepositId === deposit.id;
                    const isDeleteVisible = hoveredDepositId === deposit.id || deletingDepositId === deposit.id;
                    return (
                      <Fragment key={deposit.id}>
                        <TableRow
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          className="cursor-pointer border-l-2 border-l-slate-300 bg-slate-50/20 transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-l-slate-500/60 dark:hover:bg-slate-700/30"
                          onMouseEnter={() => setHoveredDepositId(deposit.id)}
                          onMouseLeave={() => {
                            setHoveredDepositId((currentId) => (currentId === deposit.id ? null : currentId));
                          }}
                          onFocus={() => setHoveredDepositId(deposit.id)}
                          onBlur={(event) => {
                            const nextTarget = event.relatedTarget;
                            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                              setHoveredDepositId((currentId) => (currentId === deposit.id ? null : currentId));
                            }
                          }}
                          onClick={() => setExpandedDepositId((current) => (current === deposit.id ? null : deposit.id))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setExpandedDepositId((current) => (current === deposit.id ? null : deposit.id));
                            }
                          }}
                        >
                          <TableCell className="px-3 py-3">
                            <p className="font-semibold">{formatDepositDate(deposit.date)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDepositTime(deposit.time)}</p>
                          </TableCell>
                          <TableCell className="min-w-0 px-2">
                            <p className="truncate text-sm">{deposit.bank_account?.bank_account_name ?? "계좌 미확인"}</p>
                          </TableCell>
                          <TableCell className="min-w-0 px-2">
                            <p className="truncate font-semibold">{deposit.counterparty}</p>
                          </TableCell>
                          <TableCell className="px-2 text-right font-bold tabular-nums">{formatKrw(deposit.amount)}</TableCell>
                          <TableCell className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={deletingDepositId === deposit.id}
                                tabIndex={isDeleteVisible ? 0 : -1}
                                className={cn(
                                  buttonVariants({ variant: "destructive", size: "sm" }),
                                  "h-8 rounded-full border-rose-200 bg-white/95 px-3 text-xs font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 focus-visible:ring-rose-300 dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-rose-900/50 dark:hover:bg-rose-900/70",
                                  isDeleteVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
                                )}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void deleteDepositFromList(deposit);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                삭제하기
                              </button>
                              <ChevronRight
                                className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isExpanded ? "rotate-90" : null)}
                                aria-hidden
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow key={`${deposit.id}-recommendations`} className="bg-slate-50/60 hover:bg-slate-50/60 dark:bg-slate-900/30">
                            <TableCell colSpan={5} className="px-3 py-3">
                              {renderDepositRecommendationList(deposit)}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {deposits.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          삭제하면 해당 입금 내역은 목록에서 숨겨집니다.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-24 pt-5 sm:px-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{activePageTitle}</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug break-words">
            {activePageDescription}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeAutoRecommendPage === 0 ? (
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
          ) : null}
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>

      {visibleCrawlNotice && activeAutoRecommendPage === 0 ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <RefreshCw className={cn("h-4 w-4 shrink-0", isCrawlNoticeSpinning ? "animate-spin" : null)} aria-hidden />
          <span className="whitespace-pre-line">{visibleCrawlNotice}</span>
        </div>
      ) : null}

      <div className="flex justify-center gap-1.5" aria-hidden>
        <span className={cn("h-1.5 w-6 rounded-full transition-colors", activeAutoRecommendPage === 0 ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-700")} />
        <span className={cn("h-1.5 w-6 rounded-full transition-colors", activeAutoRecommendPage === 1 ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-300 dark:bg-slate-700")} />
      </div>

      <div className="relative">
        {canGoPrev ? (
          <button
            type="button"
            aria-label="이전 자동추천 페이지"
            title="이전"
            className="absolute left-1 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white sm:left-2 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => showAutoRecommendPage(activeAutoRecommendPage - 1)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {canGoNext ? (
          <button
            type="button"
            aria-label="다음 자동추천 페이지"
            title="다음"
            className="absolute right-1 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white sm:right-2 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => showAutoRecommendPage(activeAutoRecommendPage + 1)}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <div
          className="overflow-hidden touch-pan-y"
          onTouchStart={handleSliderTouchStart}
          onTouchEnd={handleSliderTouchEnd}
        >
          <div className="transition-opacity duration-150 ease-out">
            {activeAutoRecommendPage === 0 ? renderOrderAutoRecommendPage() : renderDepositAutoRecommendPage()}
          </div>
        </div>
      </div>
    </div>
  );
}
