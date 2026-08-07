"use client";

import { Search } from "lucide-react";

import { OPEN_GLOBAL_SEARCH_EVENT } from "@/components/navigation/global-command-palette";
import { cn } from "@/lib/utils";

/** 모바일 페이지 헤더에서도 어느 화면에서나 같은 전체 검색을 엽니다. */
export function GlobalSearchTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="전체 검색"
      title="전체 검색"
      onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-ink-muted shadow-sm transition-colors hover:bg-accent hover:text-primary lg:hidden",
        className,
      )}
    >
      <Search className="h-4 w-4" aria-hidden />
    </button>
  );
}
