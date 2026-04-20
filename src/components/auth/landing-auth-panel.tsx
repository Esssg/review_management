"use client";

import { ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";

type LandingAuthPanelProps = {
  children: React.ReactNode;
  /** 메인 히어로 아래 보조 문구 */
  tagline?: string;
  className?: string;
};

export function LandingAuthPanel({
  children,
  tagline = "쿠팡 리뷰 구매 내역을 한곳에서 정리하고 관리하세요.",
  className,
}: LandingAuthPanelProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[calc(100dvh-4.5rem)] flex-1 flex-col justify-center px-4 py-10 sm:px-6",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-[min(100vw,28rem)] rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.12]" />
        <div className="absolute -bottom-32 -right-24 size-[min(100vw,32rem)] rounded-full bg-sky-500/[0.08] blur-3xl dark:bg-sky-400/[0.1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/50" />
      </div>

      <div className="relative mx-auto w-full max-w-[420px]">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-primary/15">
            <ClipboardList className="size-7" strokeWidth={2} />
          </div>
          <h1 className="font-heading text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
            리뷰 매니저
          </h1>
          <p className="text-muted-foreground mt-2.5 text-pretty text-sm leading-relaxed sm:text-[0.9375rem]">
            {tagline}
          </p>
        </header>

        {children}
      </div>
    </div>
  );
}
