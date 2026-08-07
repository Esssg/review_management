"use client";

import { ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";

type LandingAuthPanelProps = {
  children: React.ReactNode;
  /** 메인 히어로 아래 보조 문구 */
  tagline?: string;
  className?: string;
  /** PC에서는 서비스가 해결하는 업무와 로그인 카드를 함께 보여줍니다. */
  wide?: boolean;
};

export function LandingAuthPanel({
  children,
  tagline = "쿠팡 리뷰 구매 내역을 한곳에서 정리하고 관리하세요.",
  className,
  wide = false,
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
        <div className="absolute -bottom-32 -right-24 size-[min(100vw,32rem)] rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/50" />
      </div>

      <div className={cn("relative mx-auto w-full", wide ? "max-w-[980px]" : "max-w-[420px]")}>
        <div className={cn(wide && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:items-center lg:gap-12")}>
          <div className={cn("mb-8", wide ? "text-center lg:mb-0 lg:text-left" : "text-center")}>
            <header>
              <div className={cn("mb-5 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-4 ring-primary/10", wide ? "mx-auto lg:mx-0" : "mx-auto")}>
                <ClipboardList className="size-7" strokeWidth={2} />
              </div>
              <h1 className="font-heading text-balance text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
                리뷰 매니저
              </h1>
              <p className="text-muted-foreground mt-2.5 text-pretty text-sm leading-relaxed sm:text-[0.9375rem]">
                {tagline}
              </p>
            </header>

            {wide ? (
              <div className="mt-7 hidden gap-3 lg:grid">
                {[
                  ["구매장부", "미완료 주문과 입금 상태를 한 화면에서 정리"],
                  ["자동추천", "쿠팡 주문과 입금 내역의 후보를 빠르게 확인"],
                  ["대시보드", "구매·입금·수익 흐름을 기간별로 비교"],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-xl border border-hairline bg-card/75 p-4 shadow-sm">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
