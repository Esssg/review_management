"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  ClipboardList,
  House,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  SquarePlus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { OPEN_GLOBAL_SEARCH_EVENT } from "@/components/navigation/global-command-palette";

// 데스크톱에서 자주 쓰는 업무 흐름을 위에서부터 바로 이동할 수 있게 정리합니다.
const primaryItems = [
  {
    label: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    onboardingTarget: "dashboard",
    isActive: (pathname: string) => pathname.startsWith("/dashboard"),
  },
  {
    label: "주문 추가",
    href: "/orders/new",
    icon: SquarePlus,
    onboardingTarget: "new-order",
    isActive: (pathname: string) => pathname.startsWith("/orders/new"),
  },
  {
    label: "구매 장부",
    href: "/",
    icon: House,
    onboardingTarget: "ledger",
    isActive: (pathname: string) => pathname === "/",
  },
  {
    label: "자동 추천",
    href: "/menu-4",
    icon: Sparkles,
    onboardingTarget: "recommendations",
    isActive: (pathname: string) => pathname.startsWith("/menu-4"),
  },
] as const;

// 설정 화면은 별도 사이드바 대신 이 글로벌 메뉴에서 하위 화면까지 바로 엽니다.
const settingsItems = [
  { label: "설정 홈", href: "/settings", view: null },
  { label: "계정", href: "/settings?view=account", view: "account" },
  { label: "주문 기본값", href: "/settings?view=defaults", view: "defaults" },
  { label: "구매 정보 템플릿", href: "/settings?view=purchase-templates", view: "purchase-templates" },
  { label: "AI 리뷰", href: "/settings?view=ai", view: "ai" },
  { label: "결제 플랫폼", href: "/settings?view=platforms", view: "platforms" },
  { label: "결제 수단", href: "/settings?view=payment-methods", view: "payment-methods" },
  { label: "구매 계정", href: "/settings?view=buyer-accounts", view: "buyer-accounts" },
  { label: "주문 휴지통", href: "/settings?view=trash", view: "trash" },
] as const;

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onboardingTarget,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
  onboardingTarget: string;
}) {
  return (
    <Link
      href={href}
      data-onboarding-target={onboardingTarget}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-ink-muted hover:bg-surface-soft hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-primary" : "text-ink-faint group-hover:text-primary")} aria-hidden />
      <span>{label}</span>
      {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" aria-hidden /> : null}
    </Link>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSettingsRoute = pathname.startsWith("/settings");
  const activeSettingsView = searchParams.get("view");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isSettingsExpanded = isSettingsRoute || isSettingsOpen;

  if (pathname.startsWith("/login")) return null;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-hairline bg-card lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-hairline px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
          <ClipboardList className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">리뷰 매니저</p>
          <p className="text-ink-muted mt-0.5 text-[11px]">주문 운영 workspace</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-5" aria-label="주요 메뉴">
        <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-ink-faint">WORKSPACE</p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}
          className="mb-2 flex min-h-10 items-center gap-2 rounded-xl border border-hairline bg-surface-soft px-3 text-left text-xs text-ink-muted transition-colors hover:border-primary/30 hover:text-primary"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="min-w-0 flex-1 truncate">전체 검색</span>
          <kbd className="rounded border bg-card px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
        {primaryItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={item.isActive(pathname)}
            onboardingTarget={item.onboardingTarget}
          />
        ))}

        <div className="mt-5 border-t border-hairline pt-4">
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              data-onboarding-target="settings"
              className={cn(
                "group relative flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isSettingsRoute
                  ? "bg-primary/10 text-primary"
                  : "text-ink-muted hover:bg-surface-soft hover:text-foreground",
              )}
              aria-current={isSettingsRoute ? "page" : undefined}
            >
              <Settings className={cn("h-4.5 w-4.5 shrink-0", isSettingsRoute ? "text-primary" : "text-ink-faint group-hover:text-primary")} aria-hidden />
              <span>설정</span>
              {isSettingsRoute ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" aria-hidden /> : null}
            </Link>
            <button
              type="button"
              aria-label={isSettingsExpanded ? "설정 하위 메뉴 접기" : "설정 하위 메뉴 펼치기"}
              aria-expanded={isSettingsExpanded}
              onClick={() => setIsSettingsOpen((current) => !current)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-soft hover:text-primary"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", isSettingsExpanded && "rotate-180")} aria-hidden />
            </button>
          </div>

          {isSettingsExpanded ? (
            <div className="mt-1 ml-4 border-l border-hairline pl-3" aria-label="설정 하위 메뉴">
              {settingsItems.map((item) => {
                const active =
                  item.view === null
                    ? isSettingsRoute && !activeSettingsView
                    : isSettingsRoute && activeSettingsView === item.view;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-9 items-center rounded-lg px-3 text-xs transition-colors",
                      active ? "font-semibold text-primary" : "text-ink-muted hover:bg-surface-soft hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </nav>

      <div className="border-t border-hairline px-5 py-4">
        <p className="text-[11px] leading-relaxed text-ink-faint">
          오늘 할 일을 먼저 확인하고
          <br />
          주문 상태를 정리하세요.
        </p>
      </div>
    </aside>
  );
}
