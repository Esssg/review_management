"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDashed, House, LayoutDashboard, Settings, SquarePlus } from "lucide-react";

import { cn } from "@/lib/utils";

const menuItems = [
  {
    id: 1,
    label: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    isActive: (pathname: string) => pathname.startsWith("/dashboard"),
  },
  {
    id: 2,
    label: "주문추가",
    href: "/orders/new",
    icon: SquarePlus,
    isActive: (pathname: string) => pathname.startsWith("/orders/new"),
  },
  {
    id: 3,
    label: "구매장부",
    href: "/",
    icon: House,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    id: 4,
    label: "메뉴4",
    href: "/menu-4",
    icon: CircleDashed,
    isActive: (pathname: string) => pathname.startsWith("/menu-4"),
  },
  {
    id: 5,
    label: "설정",
    href: "/settings",
    icon: Settings,
    isActive: (pathname: string) => pathname.startsWith("/settings"),
  },
] as const;

export function BottomMenu() {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-700/50 dark:bg-slate-900/95">
      <div className="mx-auto grid h-16 w-full max-w-4xl grid-cols-5">
        {menuItems.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-150",
                  active && "scale-110",
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-none font-medium",
                  active && "font-semibold",
                )}
              >
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
