import type { ReactNode } from "react";

import { PendingFrameAnimation } from "@/components/loading/frame-sequence";
import { cn } from "@/lib/utils";

const loadingRowKeys = ["one", "two", "three", "four", "five"];

function Placeholder({ className }: { className: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function LoadingStatus({ label = "페이지를 불러오는 중입니다." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-card px-3 py-2.5 shadow-sm">
      <PendingFrameAnimation className="h-14 w-14" />
      <div className="min-w-0">
        <p role="status" className="text-sm font-semibold text-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">잠시만 기다려주세요.</p>
      </div>
    </div>
  );
}

function LoadingPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-5 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8",
        className,
      )}
    >
      <LoadingStatus />
      {children}
    </div>
  );
}

function LoadingHeader({ titleWidth = "w-40", actionWidth = "w-24" }: { titleWidth?: string; actionWidth?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Placeholder className={cn("h-8", titleWidth)} />
        <Placeholder className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <Placeholder className={cn("h-10 shrink-0", actionWidth)} />
    </div>
  );
}

function LoadingPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="card" className={cn("rounded-xl bg-card p-4", className)}>
      {children}
    </div>
  );
}

function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
      {loadingRowKeys.slice(0, count).map((key) => (
        <div key={key} className="flex items-center gap-3 px-4 py-4">
          <Placeholder className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Placeholder className="h-4 w-2/3" />
            <Placeholder className="h-3 w-1/2" />
          </div>
          <Placeholder className="hidden h-8 w-20 shrink-0 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function LedgerLoadingSkeleton() {
  return (
    <LoadingPageShell>
      <LoadingHeader titleWidth="w-36" actionWidth="w-10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => (
          <LoadingPanel key={key} className="space-y-3">
            <Placeholder className="h-3 w-20" />
            <Placeholder className="h-7 w-28" />
            <Placeholder className="h-3 w-16" />
          </LoadingPanel>
        ))}
      </div>
      <LoadingPanel className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Placeholder className="h-10 min-w-48 flex-1" />
          <Placeholder className="h-10 w-20" />
          <Placeholder className="h-10 w-20" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {["one", "two", "three", "four", "five"].map((key) => <Placeholder key={key} className="h-8 w-20 shrink-0" />)}
        </div>
      </LoadingPanel>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <LoadingPanel className="space-y-4">
          <div className="flex items-center justify-between"><Placeholder className="h-6 w-32" /><Placeholder className="h-5 w-10" /></div>
          <LoadingRows count={5} />
        </LoadingPanel>
        <LoadingPanel className="hidden min-h-64 space-y-4 xl:block">
          <Placeholder className="h-6 w-32" />
          <Placeholder className="h-24 w-full" />
          <Placeholder className="h-24 w-full" />
        </LoadingPanel>
      </div>
    </LoadingPageShell>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <LoadingPageShell>
      <LoadingHeader titleWidth="w-32" actionWidth="w-10" />
      <LoadingPanel className="space-y-5">
        <div className="flex items-center justify-between gap-3"><Placeholder className="h-5 w-40" /><Placeholder className="h-9 w-28" /></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {["one", "two", "three", "four"].map((key) => <Placeholder key={key} className="h-24 w-full" />)}
        </div>
      </LoadingPanel>
      <div className="grid gap-5 xl:grid-cols-2">
        {["one", "two", "three", "four"].map((key) => (
          <LoadingPanel key={key} className="space-y-4">
            <Placeholder className="h-6 w-40" />
            <Placeholder className="h-56 w-full" />
          </LoadingPanel>
        ))}
      </div>
    </LoadingPageShell>
  );
}

export function MonthlyDashboardLoadingSkeleton() {
  return (
    <LoadingPageShell className="max-w-screen-md">
      <div className="flex items-center gap-2"><Placeholder className="h-10 w-10" /><Placeholder className="h-8 flex-1" /><Placeholder className="h-10 w-10" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => <LoadingPanel key={key} className="space-y-3"><Placeholder className="h-3 w-20" /><Placeholder className="h-7 w-28" /><Placeholder className="h-3 w-16" /></LoadingPanel>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <LoadingPanel className="space-y-4"><Placeholder className="h-6 w-44" /><Placeholder className="h-64 w-full" /></LoadingPanel>
        <LoadingPanel className="space-y-4"><Placeholder className="h-6 w-36" /><LoadingRows count={3} /></LoadingPanel>
      </div>
    </LoadingPageShell>
  );
}

export function SettingsLoadingSkeleton() {
  return (
    <LoadingPageShell>
      <LoadingHeader titleWidth="w-24" actionWidth="w-10" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["one", "two", "three", "four", "five", "six", "seven", "eight"].map((key) => (
          <LoadingPanel key={key} className="space-y-3"><Placeholder className="h-5 w-32" /><Placeholder className="h-4 w-full" /><Placeholder className="h-4 w-2/3" /></LoadingPanel>
        ))}
      </div>
    </LoadingPageShell>
  );
}

export function RecommendationsLoadingSkeleton() {
  return (
    <LoadingPageShell>
      <LoadingHeader titleWidth="w-52" actionWidth="w-10" />
      <div className="flex gap-2 overflow-hidden"><Placeholder className="h-10 w-40 shrink-0" /><Placeholder className="h-10 w-40 shrink-0" /><Placeholder className="h-10 w-40 shrink-0" /></div>
      <div className="grid grid-cols-3 gap-3">
        {["one", "two", "three"].map((key) => <LoadingPanel key={key} className="space-y-3"><Placeholder className="h-3 w-20" /><Placeholder className="h-7 w-14" /></LoadingPanel>)}
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
        <LoadingPanel className="space-y-4"><Placeholder className="h-6 w-36" /><LoadingRows count={5} /></LoadingPanel>
        <LoadingPanel className="min-h-96 space-y-4"><Placeholder className="h-7 w-48" /><Placeholder className="h-4 w-2/3" /><div className="grid gap-3 sm:grid-cols-2"><Placeholder className="h-48 w-full" /><Placeholder className="h-48 w-full" /></div></LoadingPanel>
      </div>
    </LoadingPageShell>
  );
}

function FormLoadingFields({ count = 7 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={`field-${index}`} className={index === count - 1 ? "sm:col-span-2" : ""}>
          <Placeholder className="mb-2 h-4 w-24" />
          <Placeholder className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function NewOrderLoadingSkeleton() {
  return (
    <LoadingPageShell>
      <LoadingHeader titleWidth="w-32" actionWidth="w-10" />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <LoadingPanel className="space-y-5"><Placeholder className="h-6 w-40" /><FormLoadingFields count={9} /><Placeholder className="h-11 w-32" /></LoadingPanel>
        <LoadingPanel className="hidden space-y-4 lg:block"><Placeholder className="h-6 w-36" /><Placeholder className="h-24 w-full" /><Placeholder className="h-24 w-full" /><Placeholder className="h-24 w-full" /></LoadingPanel>
      </div>
    </LoadingPageShell>
  );
}

export function OrderDetailLoadingSkeleton() {
  return (
    <LoadingPageShell>
      <LoadingHeader titleWidth="w-40" actionWidth="w-24" />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <LoadingPanel className="space-y-5"><Placeholder className="h-6 w-44" /><FormLoadingFields count={8} /><Placeholder className="h-11 w-32" /></LoadingPanel>
        <LoadingPanel className="hidden space-y-4 lg:block"><Placeholder className="h-6 w-36" /><Placeholder className="h-28 w-full" /><Placeholder className="h-28 w-full" /></LoadingPanel>
      </div>
    </LoadingPageShell>
  );
}

export function PurchaseTemplateFormLoadingSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <LoadingPageShell className="max-w-4xl">
      <LoadingHeader titleWidth={detail ? "w-48" : "w-40"} actionWidth="w-24" />
      <LoadingPanel className="space-y-5"><Placeholder className="h-6 w-48" /><FormLoadingFields count={7} /><div className="flex justify-end gap-2"><Placeholder className="h-10 w-20" /><Placeholder className="h-10 w-28" /></div></LoadingPanel>
    </LoadingPageShell>
  );
}

export function LoginLoadingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-10">
      <LoadingPanel className="w-full space-y-5"><Placeholder className="mx-auto h-8 w-32" /><Placeholder className="h-10 w-full" /><Placeholder className="h-10 w-full" /><Placeholder className="h-11 w-full" /></LoadingPanel>
    </div>
  );
}
