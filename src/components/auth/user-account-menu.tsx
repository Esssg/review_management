"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** 설정 홈에서 첫 번째 카드(회원님 / 이메일)와 동일하게 `계정` 화면으로 이동 */
export const SETTINGS_ACCOUNT_SEARCH = "?view=account" as const;

export function UserAccountMenu({
  email,
  className,
  align = "end",
}: {
  email: string;
  className?: string;
  align?: "end" | "start";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const letter = (email || "?").charAt(0).toUpperCase();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    close();
    router.replace("/");
    router.refresh();
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="계정 메뉴"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        {letter}
      </button>
      {open ? (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            "absolute z-[60] mt-1 min-w-[11rem] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <Link
            role="menuitem"
            href={`/settings${SETTINGS_ACCOUNT_SEARCH}`}
            onClick={() => close()}
            className="flex min-h-11 items-center px-3 text-sm font-medium transition-colors hover:bg-muted/60 active:bg-muted/80"
          >
            계정
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center px-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15"
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
