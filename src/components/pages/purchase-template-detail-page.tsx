"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PurchaseInfoTemplateForm } from "@/components/purchase-templates/purchase-info-template-form";
import { buttonVariants } from "@/components/ui/button";
import type { PurchaseTemplateRow } from "@/lib/kakao-purchase-paste";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function PurchaseTemplateDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [phase, setPhase] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [row, setRow] = useState<PurchaseTemplateRow | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setPhase("missing");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("purchase_info_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setPhase("error");
        return;
      }
      if (!data) {
        setPhase("missing");
        return;
      }
      setRow(data as PurchaseTemplateRow);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (phase === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      </div>
    );
  }

  if (phase === "missing") {
    return (
      <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
        <p className="text-muted-foreground text-sm">템플릿을 찾을 수 없습니다.</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
          설정으로
        </Link>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
        <p className="text-destructive text-sm">{errorMessage}</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
          설정으로
        </Link>
      </div>
    );
  }

  if (!row) return null;

  return (
    <div className="text-foreground mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">템플릿 수정</h1>
          <p className="text-muted-foreground mt-1 text-sm">필드를 고친 뒤 저장하면 설정 목록에 반영됩니다.</p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-fit shrink-0")}>
          설정으로
        </Link>
      </div>

      <PurchaseInfoTemplateForm template={row} />
    </div>
  );
}
