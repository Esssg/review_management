"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LandingAuthPanel } from "@/components/auth/landing-auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!url?.trim() || !anonKey?.trim()) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        router.replace("/");
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, url, anonKey]);

  if (!url?.trim() || !anonKey?.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>에 Supabase URL과 anon 키를
          설정한 뒤 <code className="rounded bg-muted px-1 py-0.5 text-xs">next build</code>로 다시 빌드하세요.
        </p>
      </div>
    );
  }

  if (checking) {
    return (
      <LandingAuthPanel tagline="세션을 확인하는 중입니다.">
        <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
          <CardContent className="pt-8 pb-8">
            <p className="text-muted-foreground text-center text-sm">확인 중…</p>
          </CardContent>
        </Card>
      </LandingAuthPanel>
    );
  }

  return (
    <LandingAuthPanel tagline="쿠팡 리뷰 구매 내역을 한곳에서 정리하고 관리하세요.">
      <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg sm:text-xl">로그인</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/30 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            사용자가 없다면 Supabase{" "}
            <span className="font-medium text-foreground">Authentication → Users → Add user</span>로 먼저
            만드세요.
          </p>
          <p className="leading-relaxed">
            시드 SQL의 <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">user_id</code>
            가 이 계정의 User UID와 같아야 목록에 보입니다.
          </p>
          <Link
            href="/"
            className="text-primary self-center text-sm font-medium underline-offset-4 hover:underline"
          >
            메인(구매 장부)으로
          </Link>
        </CardFooter>
      </Card>
    </LandingAuthPanel>
  );
}
