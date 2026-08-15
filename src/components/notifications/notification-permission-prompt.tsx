"use client";

import { Bell, BellOff, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

type PermissionState = NotificationPermission | "unsupported";

type NotificationPermissionPromptProps = {
  permission: PermissionState;
  isSubscribing: boolean;
  onAllow: () => Promise<void>;
  onClose: () => void;
  onDismissForever: () => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "앱 알림 설정에 실패했습니다.";
}

export function NotificationPermissionPrompt({
  permission,
  isSubscribing,
  onAllow,
  onClose,
  onDismissForever,
}: NotificationPermissionPromptProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBlocked = permission === "denied";
  const isUnsupported = permission === "unsupported";
  const canRequestPermission = !isBlocked && !isUnsupported;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleAllow = async () => {
    setErrorMessage(null);
    try {
      await onAllow();
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center bg-slate-950/50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-3xl border border-hairline bg-card p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-permission-prompt-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${!canRequestPermission ? "bg-amber-600" : "bg-primary"}`}>
            {!canRequestPermission ? <BellOff className="h-5 w-5" aria-hidden /> : <Bell className="h-5 w-5" aria-hidden />}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="앱 알림 안내 닫기"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold tracking-wide text-primary">앱 알림</p>
          <h2 id="notification-permission-prompt-title" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            {isUnsupported ? "이 브라우저에서는 앱 알림을 사용할 수 없어요" : "구매 예정 알림을 켜주세요"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {isUnsupported
              ? "HTTPS 환경의 최신 Chrome·Edge 또는 홈 화면에 설치한 Safari PWA에서 다시 이용해 주세요."
              : "구매 예정 시각 10분 전과 예정 시각에 알림을 보내드립니다. 주문을 놓치지 않도록 이 기기의 앱 알림을 허용해 주세요."}
          </p>
        </div>

        {isUnsupported ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            <p className="font-semibold">현재 환경에서는 Push 알림을 지원하지 않습니다.</p>
            <p className="mt-1 text-xs text-amber-800">
              앱으로 사용하려면 지원되는 브라우저에서 사이트를 열고 홈 화면에 설치해 주세요.
            </p>
          </div>
        ) : isBlocked ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            <p className="font-semibold">알림 권한이 차단되어 있습니다.</p>
            <p className="mt-1 text-xs text-amber-800">
              브라우저 주소창의 사이트 설정 또는 휴대폰 설정에서 리뷰 매니저 알림을 허용한 뒤 다시 이용해 주세요.
            </p>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3 text-xs leading-relaxed text-ink-muted">
            아래 버튼을 누르면 브라우저의 알림 권한 창이 바로 열립니다.
          </p>
        )}

        {errorMessage && canRequestPermission ? (
          <p className="mt-3 text-xs leading-relaxed text-destructive">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {!canRequestPermission ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-active sm:w-auto"
            >
              확인
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleAllow()}
              disabled={isSubscribing}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSubscribing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {isSubscribing ? "권한 설정 중…" : "앱 알림 허용하기"}
            </button>
          )}
          {canRequestPermission ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-hairline bg-card px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-muted sm:w-auto"
            >
              나중에
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onDismissForever}
          className="mx-auto mt-4 block min-h-9 px-2 text-xs text-ink-faint underline decoration-ink-faint/50 underline-offset-4 transition-colors hover:text-ink-muted"
        >
          다시 보지 않기
        </button>
      </section>
    </div>
  );
}
