"use client";

import { Bell, BellRing, CalendarClock, Inbox, Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useNotifications, type NotificationGroupPreview } from "@/components/notifications/notification-provider";
import { cn } from "@/lib/utils";

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function NotificationGroupItem({ group }: { group: NotificationGroupPreview }) {
  const { openNotification, openNotificationGroup } = useNotifications();
  const isGroup = group.orderCount > 1;
  const label = isGroup ? `${group.orderCount}건 묶음 알림` : "구매 예정 알림";

  return (
    <button
      type="button"
      className="flex w-full gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-hairline hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        if (isGroup) void openNotificationGroup(group.groupId);
        else void openNotification(group.latest);
      }}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {isGroup ? <BellRing className="h-4 w-4" aria-hidden /> : <CalendarClock className="h-4 w-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{formatNotificationTime(group.latest.created_at)}</span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{group.latest.body}</span>
      </span>
    </button>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const {
    notificationGroups,
    unreadOrderCount,
    isLoading,
    errorMessage,
    isPanelOpen,
    setPanelOpen,
  } = useNotifications();

  useEffect(() => {
    if (!isPanelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPanelOpen, setPanelOpen]);

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={unreadOrderCount > 0 ? `미확인 알림 ${unreadOrderCount}건` : "알림"}
        aria-expanded={isPanelOpen}
        aria-haspopup="dialog"
        title="알림"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-card text-ink-muted shadow-sm transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setPanelOpen(!isPanelOpen)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadOrderCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-background">
            {unreadOrderCount > 99 ? "99+" : unreadOrderCount}
          </span>
        ) : null}
      </button>

      {isPanelOpen ? (
        <>
          <button
            type="button"
            aria-label="알림 창 닫기"
            className="fixed inset-0 z-[100] cursor-default bg-transparent"
            onClick={() => setPanelOpen(false)}
          />
          <section
            role="dialog"
            aria-label="미확인 알림"
            className="absolute right-0 top-11 z-[110] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-hairline bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">미확인 알림</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {unreadOrderCount > 0 ? `${unreadOrderCount}건의 주문을 확인해 주세요.` : "새 알림이 없습니다."}
                </p>
              </div>
              <Bell className="h-4 w-4 text-primary" aria-hidden />
            </header>
            <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">
              {isLoading && notificationGroups.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  알림을 불러오는 중…
                </div>
              ) : notificationGroups.length > 0 ? (
                <div className="space-y-1">
                  {notificationGroups.map((group) => <NotificationGroupItem key={group.groupId} group={group} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <Inbox className="h-8 w-8 text-ink-faint" aria-hidden />
                  <p className="mt-3 text-sm font-medium">확인할 알림이 없습니다.</p>
                  <p className="mt-1 text-xs text-muted-foreground">읽은 알림은 이 목록에서 숨겨집니다.</p>
                </div>
              )}
              {errorMessage ? <p className="px-3 pb-2 text-xs text-destructive">{errorMessage}</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
