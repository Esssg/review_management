"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getOrderDetailBackHandler } from "@/lib/order-detail-leave-guard";
import { Button } from "@/components/ui/button";

function normalizePath(path: string) {
  const p = path.replace(/\/$/, "") || "/";
  return p === "" ? "/" : p;
}

function isOrderDetailPath(path: string) {
  return path.startsWith("/orders/detail");
}

/** 설정 탭 하위 화면(구매 템플릿 상세·추가 등). 하드웨어 뒤로가기는 설정(`/settings`)으로 복귀해야 함. */
function isSettingsNestedPath(path: string) {
  return path.startsWith("/settings/");
}

/**
 * Android 하드웨어 뒤로가기:
 * - 구매 장부(`/`) → 종료 확인
 * - 주문 상세: 히스토리 있으면 한 단계 뒤로
 * - 설정 하위 URL(`/settings/...`): 히스토리 있으면 뒤로, 없으면 설정 루트로
 * - 그 외 탭 → 구매 장부(`/`)로 이동
 */
export function CapacitorAndroidBackHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const routerRef = useRef(router);
  routerRef.current = router;

  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const exitDialogRef = useRef(false);

  useEffect(() => {
    exitDialogRef.current = false;
    setExitDialogOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;

    void import("@capacitor/app")
      .then(({ App }) => {
        if (cancelled) return undefined;
        return App.addListener("backButton", ({ canGoBack }) => {
          const p = normalizePath(pathnameRef.current);

          if (exitDialogRef.current) {
            exitDialogRef.current = false;
            setExitDialogOpen(false);
            return;
          }

          if (p === "/") {
            exitDialogRef.current = true;
            setExitDialogOpen(true);
            return;
          }

          if (isOrderDetailPath(p) && canGoBack) {
            const orderBack = getOrderDetailBackHandler();
            if (orderBack) {
              void (async () => {
                const r = await orderBack();
                if (r === "cancelled" || r === "handled") return;
                window.history.back();
              })();
              return;
            }
            window.history.back();
            return;
          }

          if (isSettingsNestedPath(p)) {
            if (canGoBack) {
              window.history.back();
              return;
            }
            routerRef.current.replace("/settings");
            return;
          }

          routerRef.current.replace("/");
        });
      })
      .then((h) => {
        if (!h) return;
        if (cancelled) {
          void h.remove();
          return;
        }
        handle = h;
      });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  const closeExitDialog = () => {
    exitDialogRef.current = false;
    setExitDialogOpen(false);
  };

  const confirmExit = async () => {
    exitDialogRef.current = false;
    setExitDialogOpen(false);
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
    } catch {
      /* 웹 등 */
    }
  };

  if (!exitDialogOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      role="presentation"
      onClick={closeExitDialog}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-app-title"
        className="bg-card text-card-foreground w-full max-w-sm rounded-2xl p-5 shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 id="exit-app-title" className="text-lg font-semibold tracking-tight">
          앱을 종료할까요?
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">「예」를 누르면 앱이 완전히 종료됩니다.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" size="lg" className="h-11 w-full rounded-xl" onClick={closeExitDialog}>
            아니오
          </Button>
          <Button type="button" variant="default" size="lg" className="h-11 w-full rounded-xl" onClick={() => void confirmExit()}>
            예
          </Button>
        </div>
      </div>
    </div>
  );
}
