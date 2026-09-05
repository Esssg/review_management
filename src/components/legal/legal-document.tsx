import Link from "next/link";
import { ArrowLeft, ClipboardList, Mail } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { APP_DEVELOPER_NAME, APP_NAME, APP_SUPPORT_EMAIL } from "@/lib/app-info";

export function LegalDocument({
  title,
  description,
  effectiveDate,
  children,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <article className="mx-auto w-full max-w-3xl">
        <Link
          href="/login"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-ink-muted transition-colors hover:bg-card hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          로그인으로 돌아가기
        </Link>

        <header className="mb-6 rounded-xl border border-hairline bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] sm:p-7">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <ClipboardList className="size-6" aria-hidden />
          </div>
          <p className="text-xs font-semibold tracking-[0.08em] text-primary">{APP_NAME}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">{description}</p>
          <p className="mt-4 text-xs text-ink-faint">시행일: {effectiveDate}</p>
        </header>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-8 px-5 py-6 text-sm leading-7 text-ink-secondary sm:px-8 sm:py-8 sm:text-[0.9375rem]">
            {children}
          </CardContent>
        </Card>

        <footer className="mt-6 rounded-xl border border-hairline bg-card px-5 py-5 text-sm text-ink-muted sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {APP_NAME} · {APP_DEVELOPER_NAME}
            </p>
            <a
              href={`mailto:${APP_SUPPORT_EMAIL}`}
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-md px-2 font-medium text-primary hover:bg-accent sm:self-auto"
            >
              <Mail className="h-4 w-4" aria-hidden />
              {APP_SUPPORT_EMAIL}
            </a>
          </div>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-3" aria-label="개인정보 관련 문서">
            <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
              개인정보처리방침
            </Link>
            <Link href="/account-deletion" className="font-medium text-primary underline-offset-4 hover:underline">
              계정 및 데이터 삭제
            </Link>
          </nav>
        </footer>
      </article>
    </main>
  );
}

