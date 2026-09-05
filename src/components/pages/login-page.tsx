"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LandingAuthPanel } from "@/components/auth/landing-auth-panel";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_SUPPORT_EMAIL } from "@/lib/app-info";
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
    <LandingAuthPanel tagline="세션을 확인하는 중입니다." wide>
        <Card className="shadow-md">
          <CardContent className="pt-8 pb-8">
            <p className="text-muted-foreground text-center text-sm">확인 중…</p>
          </CardContent>
        </Card>
      </LandingAuthPanel>
    );
  }

  return (
    <LandingAuthPanel tagline="쿠팡 리뷰 구매 내역을 한곳에서 정리하고 관리하세요." wide>
      <Card className="shadow-md">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg sm:text-xl">로그인</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/30 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            계정 발급이나 로그인에 도움이 필요하면{" "}
            <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              {APP_SUPPORT_EMAIL}
            </a>
            으로 문의해 주세요.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2" aria-label="이용자 정책">
            <Link href="/privacy" className="text-primary font-medium underline-offset-4 hover:underline">
              개인정보처리방침
            </Link>
            <Link href="/account-deletion" className="text-primary font-medium underline-offset-4 hover:underline">
              계정 및 데이터 삭제
            </Link>
          </nav>
        </CardFooter>
      </Card>
    </LandingAuthPanel>
  );
}
