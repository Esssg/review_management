"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallState = "checking" | "available" | "installed" | "manual";

function isStandaloneMode() {
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return displayModeStandalone || iosStandalone;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaInstallCard() {
  const [installState, setInstallState] = useState<InstallState>("checking");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstallState("installed");
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallState("available");
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstallState("installed");
      setMessage("홈 화면에 앱을 추가했습니다.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    const fallbackTimer = window.setTimeout(() => {
      setInstallState((current) => current === "checking" ? "manual" : current);
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt || isInstalling) return;
    setMessage("");
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setInstallState("installed");
        setMessage("앱 설치를 시작했습니다.");
      } else {
        setInstallState("manual");
        setMessage("설치를 취소했습니다. 브라우저 메뉴에서 다시 설치할 수 있습니다.");
      }
    } catch {
      setInstallState("manual");
      setMessage("자동 설치를 열지 못했습니다. 브라우저 메뉴의 앱 설치를 이용해 주세요.");
    } finally {
      setIsInstalling(false);
    }
  };

  const ios = isIosDevice();
  const isInstalled = installState === "installed";

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/[0.035] p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          {isInstalled ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Smartphone className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">앱으로 설치하기</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            리뷰 매니저를 홈 화면에 추가하면 브라우저 주소창 없이 앱처럼 바로 열 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {installState === "checking" ? (
          <p className="text-sm text-muted-foreground">이 브라우저에서 설치할 수 있는지 확인 중…</p>
        ) : null}

        {installState === "available" ? (
          <button
            type="button"
            onClick={() => void installApp()}
            disabled={isInstalling}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Download className="h-4 w-4" aria-hidden />
            {isInstalling ? "설치 창 여는 중…" : "앱으로 설치하기"}
          </button>
        ) : null}

        {isInstalled ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            이 기기에 앱으로 설치되어 있습니다.
          </p>
        ) : null}

        {installState === "manual" ? (
          <p className="rounded-xl border border-hairline bg-card px-3 py-2.5 text-sm leading-relaxed text-ink-muted">
            {ios
              ? "Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요."
              : "브라우저 주소창의 설치 아이콘 또는 메뉴에서 ‘앱 설치’·‘홈 화면에 추가’를 선택하세요."}
          </p>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground" role="status">{message}</p> : null}
    </section>
  );
}
