"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PurchaseInfoTemplateForm } from "@/components/purchase-templates/purchase-info-template-form";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function NewPurchaseTemplatePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">구매 정보 템플릿 추가</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            제목으로 구분하고, 필요한 칸만 채워 저장할 수 있습니다.
          </p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit")}>
          설정으로
        </Link>
      </div>

      <PurchaseInfoTemplateForm />
    </div>
  );
}
