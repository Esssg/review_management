import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { OrderWithRelations } from "@/types/orders";

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BPHmntsuimaseqrS_dNP7junNbaI369NybSp-cpVp_0jmRGqPKb-OLLy6fDj_MmsTUTYh28rMBKB8dV2hIvcZJM";

export const NOTIFICATION_ORDER_SELECT = `
  id,
  title,
  product_name,
  purchase_date,
  purchase_price_krw,
  scheduled_purchase_at,
  is_processed,
  is_item_delivered,
  platforms(id, name, color),
  buyer_accounts(id, label, color)
` as const;

export type AppNotificationRow = Database["public"]["Tables"]["app_notifications"]["Row"];
export type NotificationOrder = Pick<
  OrderWithRelations,
  | "id"
  | "title"
  | "product_name"
  | "purchase_date"
  | "purchase_price_krw"
  | "scheduled_purchase_at"
  | "is_processed"
  | "is_item_delivered"
  | "platforms"
  | "buyer_accounts"
>;

const NOTIFICATION_PAGE_SIZE = 500;

export function isPushSupported() {
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  return isPushSupported() ? Notification.permission : "unsupported";
}

export async function registerNotificationServiceWorker() {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function arrayBufferToBase64Url(value: ArrayBuffer | null) {
  if (!value) return null;
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToUint8Array(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function fetchUnreadNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const notifications: AppNotificationRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("app_notifications")
      .select("*")
      .eq("user_id", userId)
      .is("read_at", null)
      .is("cancelled_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + NOTIFICATION_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as AppNotificationRow[];
    notifications.push(...page);
    if (page.length < NOTIFICATION_PAGE_SIZE) break;
    offset += NOTIFICATION_PAGE_SIZE;
  }

  return notifications;
}

export async function markOrderNotificationsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  orderId: string,
) {
  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("order_id", orderId)
    .is("read_at", null)
    .is("cancelled_at", null);
  if (error) throw new Error(error.message);
}

export async function markGroupNotificationsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  groupId: string,
) {
  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .is("read_at", null)
    .is("cancelled_at", null);
  if (error) throw new Error(error.message);
}

export async function fetchNotificationGroup(
  supabase: SupabaseClient<Database>,
  userId: string,
  groupId: string,
) {
  const { data: rowData, error: rowError } = await supabase
    .from("app_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (rowError) throw new Error(rowError.message);

  const rows = (rowData ?? []) as AppNotificationRow[];
  const orderIds = Array.from(new Set(rows.map((row) => row.order_id)));
  const orders: NotificationOrder[] = [];
  for (let offset = 0; offset < orderIds.length; offset += NOTIFICATION_PAGE_SIZE) {
    const ids = orderIds.slice(offset, offset + NOTIFICATION_PAGE_SIZE);
    const { data, error } = await supabase
      .from("orders")
      .select(NOTIFICATION_ORDER_SELECT)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("id", ids);
    if (error) throw new Error(error.message);
    orders.push(...((data ?? []) as unknown as NotificationOrder[]));
  }

  const orderPosition = new Map(orderIds.map((id, index) => [id, index]));
  orders.sort((left, right) =>
    (orderPosition.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
    (orderPosition.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );

  return { rows, orders };
}

export function notificationGroupKey(row: AppNotificationRow) {
  return row.group_id;
}
