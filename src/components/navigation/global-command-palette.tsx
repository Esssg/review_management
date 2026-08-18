"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LayoutDashboard, Loader2, RefreshCw, Search, Settings, ShoppingBag, Sparkles, SquarePlus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const OPEN_GLOBAL_SEARCH_EVENT = "review-manager:open-global-search";

type SearchResult = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Search;
  action?: "refresh";
};

type RemoteSearchState = {
  query: string;
  results: SearchResult[];
};

const navigationResults: SearchResult[] = [
  { key: "dashboard", label: "대시보드", description: "기간별 실적과 분류 통계", href: "/dashboard", icon: LayoutDashboard },
  { key: "new-order", label: "주문 추가", description: "새 주문 등록", href: "/orders/new", icon: SquarePlus },
  { key: "ledger", label: "구매 장부", description: "주문 검색과 상태 관리", href: "/", icon: ShoppingBag },
  { key: "recommendations", label: "자동 추천", description: "크롤링 주문과 입금 추천", href: "/recommendations", icon: Sparkles },
  { key: "settings", label: "설정", description: "계정·템플릿·기본값 관리", href: "/settings", icon: Settings },
  { key: "settings-defaults", label: "주문 기본값", description: "기본 분류와 저장 후 동작 설정", href: "/settings?view=defaults", icon: Settings },
  { key: "settings-templates", label: "구매 정보 템플릿", description: "템플릿 복제·기본 지정·삭제", href: "/settings?view=purchase-templates", icon: FileText },
  { key: "settings-ai", label: "AI 리뷰 설정", description: "리뷰 생성 기본 정보", href: "/settings?view=ai", icon: Settings },
  { key: "settings-platforms", label: "결제 플랫폼 설정", description: "플랫폼과 표시 색상 관리", href: "/settings?view=platforms", icon: Settings },
  { key: "settings-payments", label: "결제 수단 설정", description: "결제 수단과 표시 색상 관리", href: "/settings?view=payment-methods", icon: Settings },
  { key: "settings-accounts", label: "구매 계정 설정", description: "구매 계정 별칭 관리", href: "/settings?view=buyer-accounts", icon: Settings },
  { key: "refresh", label: "현재 화면 새로고침", description: "최신 데이터 다시 불러오기", href: "", icon: RefreshCw, action: "refresh" },
];

function normalizeQuery(value: string) {
  return value.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ");
}

/** Ctrl/Cmd+K 한 곳에서 메뉴, 주문, 템플릿을 최대 20건까지 찾습니다. */
export function GlobalCommandPalette() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState>({ query: "", results: [] });
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const openSearch = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, openSearch);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, openSearch);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const localResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalized) return navigationResults;
    return navigationResults.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("ko-KR").includes(normalized));
  }, [query]);

  const normalizedQuery = normalizeQuery(query);
  const canSearchRemote = open && normalizedQuery.length >= 2;

  useEffect(() => {
    if (!canSearchRemote) return;

    let cancelled = false;
    const requestedQuery = normalizedQuery;
    const timer = window.setTimeout(() => {
      setLoadingQuery(requestedQuery);
      void (async () => {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return [];
        const pattern = `%${requestedQuery}%`;
        const [titleOrders, productOrders, numberOrders, noteOrders, templates] = await Promise.all([
          supabase.from("orders").select("id, title, product_name, purchase_date, order_number, purchase_price_krw, is_processed, is_item_delivered").is("deleted_at", null).ilike("title", pattern).limit(6),
          supabase.from("orders").select("id, title, product_name, purchase_date, order_number, purchase_price_krw, is_processed, is_item_delivered").is("deleted_at", null).ilike("product_name", pattern).limit(6),
          supabase.from("orders").select("id, title, product_name, purchase_date, order_number, purchase_price_krw, is_processed, is_item_delivered").is("deleted_at", null).ilike("order_number", pattern).limit(4),
          supabase.from("orders").select("id, title, product_name, purchase_date, order_number, purchase_price_krw, is_processed, is_item_delivered").is("deleted_at", null).ilike("notes", pattern).limit(4),
          supabase.from("purchase_info_templates").select("id, title").ilike("title", pattern).limit(4),
        ]);

        const orders = new Map<string, NonNullable<typeof titleOrders.data>[number]>();
        for (const row of [...(titleOrders.data ?? []), ...(productOrders.data ?? []), ...(numberOrders.data ?? []), ...(noteOrders.data ?? [])]) {
          orders.set(row.id, row);
        }
        const orderResults: SearchResult[] = [...orders.values()].map((row) => ({
          key: `order-${row.id}`,
          label: row.title?.trim() || row.product_name,
          description: `${row.product_name} · ${row.is_processed ? "완료" : "미완료"} · ${row.is_item_delivered ? "배송 있음" : "배송 없음"} · ${row.purchase_date} · ${Number(row.purchase_price_krw).toLocaleString("ko-KR")}원`,
          href: `/orders/detail?id=${encodeURIComponent(row.id)}`,
          icon: ShoppingBag,
        }));
        const templateResults: SearchResult[] = (templates.data ?? []).map((row) => ({
          key: `template-${row.id}`,
          label: row.title,
          description: "구매 정보 템플릿",
          href: "/settings?view=purchase-templates",
          icon: FileText,
        }));
        const moreResult: SearchResult = {
          key: `more-${requestedQuery}`,
          label: `“${requestedQuery}” 주문 더 보기`,
          description: "구매장부에서 같은 검색어로 전체 결과 보기",
          href: `/?q=${encodeURIComponent(requestedQuery)}`,
          icon: Search,
        };
        return [...orderResults, ...templateResults].slice(0, 19).concat(moreResult);
      })().then((results) => {
        if (!cancelled) setRemoteSearch({ query: requestedQuery, results });
      }).finally(() => {
        setLoadingQuery((current) => current === requestedQuery ? null : current);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSearchRemote, normalizedQuery, supabase]);

  const results = useMemo(() => {
    const visibleRemoteResults = canSearchRemote && remoteSearch.query === normalizedQuery
      ? remoteSearch.results
      : [];
    const moreResult = visibleRemoteResults.find((item) => item.key.startsWith("more-"));
    const primaryResults = [...localResults, ...visibleRemoteResults.filter((item) => item !== moreResult)];
    return moreResult ? [...primaryResults.slice(0, 19), moreResult] : primaryResults.slice(0, 20);
  }, [canSearchRemote, localResults, normalizedQuery, remoteSearch]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, results.length - 1));
  const loading = canSearchRemote && loadingQuery === normalizedQuery;

  const openResult = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (result.action === "refresh") {
      window.location.reload();
      return;
    }
    router.push(result.href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center bg-black/45 px-3 pt-[max(4rem,10vh)] backdrop-blur-[2px]" role="presentation" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="전체 검색"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => Math.min(Math.max(0, results.length - 1), current + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter" && results[safeActiveIndex]) {
                event.preventDefault();
                openResult(results[safeActiveIndex]);
              }
            }}
            placeholder="메뉴, 주문 제목·상품·주문번호, 템플릿 검색"
            className="h-11 flex-1 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
          <button type="button" aria-label="검색 닫기" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[min(28rem,65vh)] overflow-y-auto p-2">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          ) : results.map((result, index) => {
            const Icon = result.icon;
            return (
              <button
                key={result.key}
                type="button"
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", safeActiveIndex === index ? "bg-accent" : "hover:bg-accent/70")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => openResult(result)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="h-4 w-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{result.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{result.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">↑↓ 이동 · Enter 열기 · Esc 닫기 · Ctrl/Cmd+K</div>
      </div>
    </div>
  );
}
