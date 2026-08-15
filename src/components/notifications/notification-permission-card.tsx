"use client";

import { Bell, BellOff, CheckCircle2, Loader2, Settings2, Smartphone } from "lucide-react";

import { useNotifications } from "@/components/notifications/notification-provider";

export function NotificationPermissionCard() {
  const {
    permission,
    isPushSubscribed,
    isSubscribing,
    subscribeToPush,
    disablePush,
  } = useNotifications();

  const isUnsupported = permission === "unsupported";
  const isBlocked = permission === "denied";
  const isEnabled = permission === "granted" && isPushSubscribed;

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/[0.035] p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          {isBlocked ? <BellOff className="h-5 w-5" aria-hidden /> : <Bell className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">앱 알림</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            구매 예정 시각 10분 전과 예정 시각에 이 기기로 알림을 받을 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isUnsupported ? (
          <p className="rounded-xl border border-hairline bg-card px-3 py-2.5 text-sm leading-relaxed text-ink-muted">
            현재 브라우저는 앱 푸시를 지원하지 않습니다. HTTPS 환경의 최신 Chrome, Edge, Safari 홈 화면 앱에서 이용해 주세요.
          </p>
        ) : null}

        {isBlocked ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900">
            <p className="font-medium">알림 권한이 차단되어 있습니다.</p>
            <p className="mt-1 text-xs text-amber-800">
              브라우저의 사이트 권한 또는 휴대폰 설정에서 리뷰 매니저 알림을 허용한 뒤 이 화면을 다시 열어 주세요.
            </p>
          </div>
        ) : null}

        {!isUnsupported && !isBlocked && !isEnabled ? (
          <button
            type="button"
            onClick={() => void subscribeToPush().catch(() => undefined)}
            disabled={isSubscribing}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isSubscribing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Settings2 className="h-4 w-4" aria-hidden />}
            {isSubscribing ? "권한 설정 중…" : "앱 사용 권한 설정하기"}
          </button>
        ) : null}

        {isEnabled ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              이 기기에서 앱 푸시를 허용했습니다.
            </p>
            <button
              type="button"
              onClick={() => void disablePush()}
              disabled={isSubscribing}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-hairline bg-card px-3 text-xs font-medium text-ink-muted transition-colors hover:bg-muted disabled:opacity-50"
            >
              {isSubscribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Smartphone className="h-3.5 w-3.5" aria-hidden />}
              이 기기에서 해제
            </button>
          </div>
        ) : null}

        {!isUnsupported && !isBlocked && permission === "default" ? (
          <p className="mt-2 text-xs text-muted-foreground">버튼을 누른 뒤 브라우저 권한 창에서 허용을 선택해 주세요.</p>
        ) : null}
      </div>
    </section>
  );
}
