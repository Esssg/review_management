"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function decodeEmailParam(q: string) {
  try {
    return decodeURIComponent(q);
  } catch {
    return q;
  }
}

type LoginFormFieldsProps = {
  initialEmail: string;
  /** 홈 등에서 로그인 후 라우팅 대신 호출 (예: 주문 목록 다시 불러오기) */
  onSignedIn?: () => void | Promise<void>;
  /** true면 폼 하단「홈으로」링크 숨김 */
  hideHomeLink?: boolean;
};

function LoginFormFields({ initialEmail, onSignedIn, hideHomeLink }: LoginFormFieldsProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (onSignedIn) {
      await onSignedIn();
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="email" className="text-foreground/90">
          아이디 (이메일)
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm transition-shadow focus-visible:ring-primary/30"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="text-foreground/90">
          비밀번호
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm transition-shadow focus-visible:ring-primary/30"
        />
      </div>
      <p className="text-muted-foreground rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed">
        계정 생성 시 문의주세요:{" "}
        <a href="tel:01036251217" className="font-medium text-foreground underline-offset-2 hover:underline">
          010-3625-1217
        </a>
      </p>
      {error ? (
        <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl text-base font-semibold shadow-md shadow-primary/20"
      >
        {pending ? "로그인 중…" : "로그인"}
      </Button>
      {!hideHomeLink ? (
        <p className="text-muted-foreground text-center text-xs">
          <Link href="/" className="text-primary font-medium underline-offset-4 hover:underline">
            홈으로
          </Link>
        </p>
      ) : null}
    </form>
  );
}

/** 쿼리의 email이 바뀌면 폼을 remount 해서 이메일 초기값 반영 */
function LoginFormWithQueryKey({
  onSignedIn,
  hideHomeLink,
}: Pick<LoginFormFieldsProps, "onSignedIn" | "hideHomeLink">) {
  const searchParams = useSearchParams();
  const q = searchParams.get("email");
  const initialEmail = q ? decodeEmailParam(q) : "";
  return (
    <LoginFormFields
      key={q ?? ""}
      initialEmail={initialEmail}
      onSignedIn={onSignedIn}
      hideHomeLink={hideHomeLink}
    />
  );
}

export type LoginFormProps = Pick<LoginFormFieldsProps, "onSignedIn" | "hideHomeLink">;

export function LoginForm(props?: LoginFormProps) {
  const { onSignedIn, hideHomeLink } = props ?? {};
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground grid gap-4 text-sm" aria-busy="true">
          <div className="bg-muted h-11 animate-pulse rounded-xl" />
          <div className="bg-muted h-11 animate-pulse rounded-xl" />
          <div className="bg-muted h-11 animate-pulse rounded-xl" />
        </div>
      }
    >
      <LoginFormWithQueryKey onSignedIn={onSignedIn} hideHomeLink={hideHomeLink} />
    </Suspense>
  );
}
