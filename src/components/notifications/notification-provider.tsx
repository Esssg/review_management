"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { NotificationGroupModal, type NotificationGroupModalData } from "@/components/notifications/notification-group-modal";
import { createClient } from "@/lib/supabase/client";
import {
  arrayBufferToBase64Url,
  base64UrlToUint8Array,
  fetchNotificationGroup,
  fetchUnreadNotifications,
  getPushPermission,
  isPushSupported,
  markGroupNotificationsRead,
  markOrderNotificationsRead,
  registerNotificationServiceWorker,
  VAPID_PUBLIC_KEY,
  type AppNotificationRow,
} from "@/lib/notifications";

type PermissionState = NotificationPermission | "unsupported";

export type NotificationGroupPreview = {
  groupId: string;
  rows: AppNotificationRow[];
  orderCount: number;
  latest: AppNotificationRow;
};

type NotificationContextValue = {
  notifications: AppNotificationRow[];
  notificationGroups: NotificationGroupPreview[];
  unreadOrderCount: number;
  isLoading: boolean;
  errorMessage: string | null;
  isPanelOpen: boolean;
  permission: PermissionState;
  isPushSubscribed: boolean;
  isSubscribing: boolean;
  setPanelOpen: (open: boolean) => void;
  refreshNotifications: () => Promise<void>;
  openNotification: (notification: AppNotificationRow) => Promise<void>;
  openNotificationGroup: (groupId: string) => Promise<void>;
  closeNotificationGroup: () => void;
  selectedGroup: NotificationGroupModalData | null;
  subscribeToPush: () => Promise<void>;
  disablePush: () => Promise<void>;
  refreshPushState: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function notificationTarget(notification: AppNotificationRow) {
  return notification.target_href || `/orders/detail?id=${encodeURIComponent(notification.order_id)}`;
}

function groupNotifications(rows: AppNotificationRow[]) {
  const grouped = new Map<string, AppNotificationRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.group_id) ?? [];
    current.push(row);
    grouped.set(row.group_id, current);
  }
  return Array.from(grouped, ([groupId, groupRows]) => ({
    groupId,
    rows: groupRows,
    orderCount: new Set(groupRows.map((row) => row.order_id)).size,
    latest: groupRows[0],
  }));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const handledRouteRef = useRef<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<NotificationGroupModalData | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setNotifications(await fetchUnreadNotifications(supabase, userId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "알림을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    void refreshNotifications();
    const interval = window.setInterval(() => void refreshNotifications(), 30_000);
    const onFocus = () => void refreshNotifications();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshNotifications, userId]);

  const refreshPushState = useCallback(async () => {
    const currentPermission = getPushPermission();
    setPermission(currentPermission);
    if (!isPushSupported()) {
      setIsPushSubscribed(false);
      return;
    }
    try {
      const registration = await registerNotificationServiceWorker();
      const subscription = await registration?.pushManager.getSubscription();
      setIsPushSubscribed(Boolean(subscription));
    } catch {
      setIsPushSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void registerNotificationServiceWorker().catch(() => undefined);
    void refreshPushState();
    const onFocus = () => void refreshPushState();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPushState]);

  const subscribeToPush = useCallback(async () => {
    if (!userId) throw new Error("로그인 후 앱 알림을 설정할 수 있습니다.");
    if (!isPushSupported()) throw new Error("현재 브라우저에서는 앱 푸시를 지원하지 않습니다.");
    if (!VAPID_PUBLIC_KEY) throw new Error("Web Push 공개 키가 설정되지 않았습니다.");

    setIsSubscribing(true);
    setErrorMessage(null);
    try {
      const requested = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      setPermission(requested);
      if (requested !== "granted") {
        throw new Error(requested === "denied"
          ? "알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요."
          : "알림 권한을 허용해야 앱 푸시를 받을 수 있습니다.");
      }

      const registration = await registerNotificationServiceWorker();
      if (!registration) throw new Error("서비스 워커를 등록하지 못했습니다.");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
      });
      const p256dh = arrayBufferToBase64Url(subscription.getKey("p256dh"));
      const auth = arrayBufferToBase64Url(subscription.getKey("auth"));
      if (!p256dh || !auth) throw new Error("Push 구독 키를 읽지 못했습니다.");

      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        device_label: isStandaloneMode() ? "PWA 앱" : "브라우저",
        user_agent: navigator.userAgent,
        enabled: true,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });
      if (error) throw new Error(error.message);
      setIsPushSubscribed(true);
      setPermission("granted");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "앱 푸시 설정에 실패했습니다.");
      throw error;
    } finally {
      setIsSubscribing(false);
    }
  }, [supabase, userId]);

  const disablePush = useCallback(async () => {
    if (!userId || !isPushSupported()) return;
    setIsSubscribing(true);
    try {
      const registration = await registerNotificationServiceWorker();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await supabase
          .from("push_subscriptions")
          .update({ enabled: false, last_seen_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsPushSubscribed(false);
    } finally {
      setIsSubscribing(false);
    }
  }, [supabase, userId]);

  const openNotification = useCallback(async (notification: AppNotificationRow) => {
    if (!userId) return;
    setPanelOpen(false);
    try {
      await markOrderNotificationsRead(supabase, userId, notification.order_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "알림을 읽음 처리하지 못했습니다.");
    }
    setNotifications((current) => current.filter((row) => row.order_id !== notification.order_id));
    router.push(notificationTarget(notification));
  }, [router, supabase, userId]);

  const openNotificationGroup = useCallback(async (groupId: string) => {
    if (!userId) return;
    setPanelOpen(false);
    try {
      await markGroupNotificationsRead(supabase, userId, groupId);
      setNotifications((current) => current.filter((row) => row.group_id !== groupId));
      const group = await fetchNotificationGroup(supabase, userId, groupId);
      setSelectedGroup({ groupId, ...group });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "묶음 알림을 열지 못했습니다.");
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    const routeKey = `${pathname}?${searchParamsString}`;
    if (handledRouteRef.current === routeKey) return;
    const groupId = searchParams.get("notification_group");
    const orderId = searchParams.get("notification_order");
    if (!groupId && !orderId) return;
    handledRouteRef.current = routeKey;

    const cleanRoute = (removeKey: string) => {
      const params = new URLSearchParams(searchParamsString);
      params.delete(removeKey);
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    };

    if (groupId) {
      void openNotificationGroup(groupId).finally(() => cleanRoute("notification_group"));
    } else if (orderId) {
      void markOrderNotificationsRead(supabase, userId, orderId)
        .catch((error) => setErrorMessage(error instanceof Error ? error.message : "알림을 읽음 처리하지 못했습니다."))
        .finally(() => {
          setNotifications((current) => current.filter((row) => row.order_id !== orderId));
          cleanRoute("notification_order");
        });
    }
  }, [openNotificationGroup, pathname, router, searchParams, searchParamsString, supabase, userId]);

  const notificationGroups = useMemo(() => groupNotifications(notifications), [notifications]);
  const unreadOrderCount = useMemo(
    () => new Set(notifications.map((notification) => notification.order_id)).size,
    [notifications],
  );
  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    notificationGroups,
    unreadOrderCount,
    isLoading,
    errorMessage,
    isPanelOpen,
    permission,
    isPushSubscribed,
    isSubscribing,
    setPanelOpen,
    refreshNotifications,
    openNotification,
    openNotificationGroup,
    closeNotificationGroup: () => setSelectedGroup(null),
    selectedGroup,
    subscribeToPush,
    disablePush,
    refreshPushState,
  }), [
    disablePush,
    errorMessage,
    isLoading,
    isPanelOpen,
    isPushSubscribed,
    isSubscribing,
    notificationGroups,
    notifications,
    openNotification,
    openNotificationGroup,
    permission,
    refreshNotifications,
    refreshPushState,
    selectedGroup,
    subscribeToPush,
    unreadOrderCount,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationGroupModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NotificationProvider 안에서 사용해야 합니다.");
  return value;
}
