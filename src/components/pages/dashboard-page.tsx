"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { GlobalSearchTrigger } from "@/components/navigation/global-search-trigger";
import { OrdersDashboard } from "@/components/orders/orders-dashboard";
import { createClient } from "@/lib/supabase/client";
import { exportDashboardExcel } from "@/lib/export-dashboard-excel";
import type { OrderWithRelations } from "@/types/orders";

export function DashboardPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "guest" | "ready" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
        .is("deleted_at", null)
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
      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-destructive text-sm">Supabase 조회 오류: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-6 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-1">
          <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground mt-1 text-sm break-words">
            {email} · 주문 데이터 집계
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <GlobalSearchTrigger />
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-card text-ink-muted shadow-sm transition-colors hover:bg-accent hover:text-primary disabled:opacity-40"
          >
            <Download size={16} />
          </button>
          <UserAccountMenu email={email ?? "?"} />
        </div>
      </div>
      <OrdersDashboard orders={orders} userEmail={email ?? ""} />
    </div>
  );
}
