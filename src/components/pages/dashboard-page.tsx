"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { OrdersDashboard } from "@/components/orders/orders-dashboard";
import { createClient } from "@/lib/supabase/client";
import { exportDashboardExcel } from "@/lib/export-dashboard-excel";
import type { OrderWithRelations } from "@/components/orders/orders-table";

export function DashboardPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // 초기값 false → 웹에서 바로 보임. Capacitor 환경이면 effect 후 숨김
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
      setIsNative(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/");
        return;
      }
      setEmail(user.email ?? user.id);
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, platforms(id, name, color), payment_methods(id, name, color), buyer_accounts(id, label, color), purchase_info_templates(*)",
        )
        .order("purchase_date", { ascending: false });
      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setPhase("error");
        return;
      }
      setOrders((data ?? []) as OrderWithRelations[]);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (phase === "loading") {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-screen-xl flex-1 flex-col gap-4 overflow-x-hidden p-4 sm:p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-screen-xl flex-1 flex-col gap-4 overflow-x-hidden p-4 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-screen-xl flex-1 flex-col gap-6 overflow-x-hidden p-4 sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground mt-1 text-sm break-words">
            {email} · 주문 데이터 집계
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {!isNative && (
            <button
              type="button"
              aria-label="엑셀로 내보내기"
              title="엑셀로 내보내기"
              disabled={exporting || orders.length === 0}
              onClick={() => {
                setExporting(true);
                try {
                  exportDashboardExcel(orders, email ?? "");
                } finally {
                  setExporting(false);
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-input bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Download size={16} />
            </button>
          )}
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>
      <OrdersDashboard orders={orders} />
    </div>
  );
}
