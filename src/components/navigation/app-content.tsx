"use client";

import { usePathname } from "next/navigation";

import { isAppChromeHiddenRoute } from "@/lib/app-routes";
import { cn } from "@/lib/utils";

export function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideAppChrome = isAppChromeHiddenRoute(pathname);

  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col",
        !hideAppChrome && "pb-16 lg:pl-60 lg:pb-0",
      )}
    >
      {children}
    </div>
  );
}

