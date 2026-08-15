import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const PAGE_SIZE = 500;
const STALE_NOTIFICATION_HOURS = 2;
const encoder = new TextEncoder();

type NotificationType = "purchase_10m" | "purchase_due";

type ScheduledOrder = {
  id: string;
  user_id: string;
  title: string | null;
  product_name: string;
  scheduled_purchase_at: string;
};

type PendingNotification = {
  id: string;
  user_id: string;
  order_id: string;
  scheduled_for: string;
  notification_type: NotificationType;
};

type CurrentOrder = {
  id: string;
  user_id: string;
  is_processed: boolean;
  deleted_at: string | null;
  scheduled_purchase_at: string | null;
};

type NotificationRow = {
  id: string;
  order_id: string;
  user_id: string;
  group_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  target_href: string;
  scheduled_for: string;
  sent_at: string | null;
  read_at: string | null;
  delivery_attempts: number;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-notification-cron-secret",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name}가 설정되지 않았습니다.`);
  return value;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeBase64Json(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<string, unknown>;
}

function toUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

async function getGroupId(userId: string, scheduledFor: string, type: NotificationType) {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${userId}:${scheduledFor}:${type}`),
    ),
  ).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return toUuid(digest);
}

function getWindow(type: NotificationType, now: Date) {
  const nowMs = now.getTime();
  if (type === "purchase_10m") {
    return {
      from: new Date(nowMs + 9 * 60_000).toISOString(),
      to: new Date(nowMs + 11 * 60_000).toISOString(),
    };
  }
  return {
    from: new Date(nowMs - 2 * 60_000).toISOString(),
    to: new Date(nowMs + 1 * 60_000).toISOString(),
  };
}

async function fetchScheduledOrders(
  supabase: ReturnType<typeof createClient>,
  type: NotificationType,
  now: Date,
): Promise<ScheduledOrder[]> {
  const window = getWindow(type, now);
  const orders: ScheduledOrder[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, title, product_name, scheduled_purchase_at")
      .eq("is_processed", false)
      .is("deleted_at", null)
      .gte("scheduled_purchase_at", window.from)
      .lte("scheduled_purchase_at", window.to)
      .order("scheduled_purchase_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`구매 예정 주문 조회 실패: ${error.message}`);
    const page = (data ?? []) as ScheduledOrder[];
    orders.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return orders;
}

async function fetchPendingNotifications(
  supabase: ReturnType<typeof createClient>,
  now: Date,
): Promise<PendingNotification[]> {
  const from = new Date(
    now.getTime() - STALE_NOTIFICATION_HOURS * 60 * 60_000,
  ).toISOString();
  const to = new Date(now.getTime() + 15 * 60_000).toISOString();
  const notifications: PendingNotification[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("app_notifications")
      .select("id, user_id, order_id, scheduled_for, notification_type")
      .is("sent_at", null)
      .is("cancelled_at", null)
      .gte("scheduled_for", from)
      .lte("scheduled_for", to)
      .order("scheduled_for", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`미발송 알림 조회 실패: ${error.message}`);
    const page = (data ?? []) as PendingNotification[];
    notifications.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return notifications;
}

async function fetchCurrentOrders(
  supabase: ReturnType<typeof createClient>,
  orderIds: string[],
): Promise<Map<string, CurrentOrder>> {
  const currentOrders = new Map<string, CurrentOrder>();
  for (let offset = 0; offset < orderIds.length; offset += PAGE_SIZE) {
    const ids = orderIds.slice(offset, offset + PAGE_SIZE);
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, is_processed, deleted_at, scheduled_purchase_at")
      .in("id", ids);
    if (error) throw new Error(`알림 대상 주문 상태 조회 실패: ${error.message}`);
    for (const row of (data ?? []) as CurrentOrder[]) currentOrders.set(row.id, row);
  }
  return currentOrders;
}

async function cancelInvalidPendingNotifications(
  supabase: ReturnType<typeof createClient>,
  now: Date,
) {
  const pending = await fetchPendingNotifications(supabase, now);
  if (pending.length === 0) return 0;

  const currentOrders = await fetchCurrentOrders(
    supabase,
    Array.from(new Set(pending.map((notification) => notification.order_id))),
  );
  const staleBefore = now.getTime() - STALE_NOTIFICATION_HOURS * 60 * 60_000;
  const invalidIds = pending
    .filter((notification) => {
      const order = currentOrders.get(notification.order_id);
      if (!order) return true;
      if (order.user_id !== notification.user_id) return true;
      if (order.is_processed || order.deleted_at) return true;
      if (!order.scheduled_purchase_at) return true;
      if (
        new Date(order.scheduled_purchase_at).getTime() !==
        new Date(notification.scheduled_for).getTime()
      ) {
        return true;
      }
      return new Date(notification.scheduled_for).getTime() < staleBefore;
    })
    .map((notification) => notification.id);

  if (invalidIds.length === 0) return 0;
  const { error } = await supabase
    .from("app_notifications")
    .update({ cancelled_at: now.toISOString() })
    .in("id", invalidIds);
  if (error) throw new Error(`무효 알림 정리 실패: ${error.message}`);
  return invalidIds.length;
}

function getOrderLabel(order: ScheduledOrder) {
  return order.title?.trim() || order.product_name.trim() || "주문";
}

function buildMessage(type: NotificationType, orders: ScheduledOrder[]) {
  const representative = getOrderLabel(orders[0]);
  const prefix = orders.length > 1
    ? `[${representative} 외 ${orders.length - 1}건]`
    : `[${representative}]`;
  const body = type === "purchase_10m"
    ? `${prefix} 구매 10분 전 입니다. 물품 정보를 보려면 알람을 확인하세요!`
    : orders.length > 1
    ? `${prefix} 구매 10분 전 입니다. 물품 정보를 보려면 알람을 확인하세요!`
    : `${prefix} 구매 예정 시간 입니다! 물품 정보를 보려면 알람을 확인하세요!`;
  return { title: "구매 예정 알림", body };
}

async function fetchGroupRows(
  supabase: ReturnType<typeof createClient>,
  groupId: string,
  userId: string,
  type: NotificationType,
  scheduledFor: string,
): Promise<NotificationRow[]> {
  const rows: NotificationRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("app_notifications")
      .select(
        "id, order_id, user_id, group_id, notification_type, title, body, target_href, scheduled_for, sent_at, read_at, delivery_attempts",
      )
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("notification_type", type)
      .eq("scheduled_for", scheduledFor)
      .is("cancelled_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`알림 묶음 조회 실패: ${error.message}`);
    const page = (data ?? []) as NotificationRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function fetchSubscriptions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<PushSubscriptionRow[]> {
  const subscriptions: PushSubscriptionRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Push 구독 조회 실패: ${error.message}`);
    const page = (data ?? []) as PushSubscriptionRow[];
    subscriptions.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return subscriptions;
}

async function sendToSubscription(
  supabase: ReturnType<typeof createClient>,
  appServer: webpush.ApplicationServer,
  subscription: PushSubscriptionRow,
  payload: Record<string, unknown>,
  now: string,
) {
  try {
    await appServer.subscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }).pushTextMessage(JSON.stringify(payload), {
      urgency: webpush.Urgency.High,
      ttl: 86_400,
    });
    await supabase
      .from("push_subscriptions")
      .update({ last_seen_at: now })
      .eq("id", subscription.id);
    return { sent: true, disabled: false };
  } catch (error) {
    const isGone = error instanceof webpush.PushMessageError && error.isGone();
    if (isGone) {
      await supabase
        .from("push_subscriptions")
        .update({ enabled: false, last_seen_at: now })
        .eq("id", subscription.id);
    }
    return { sent: false, disabled: isGone };
  }
}

async function processGroup(
  supabase: ReturnType<typeof createClient>,
  appServer: webpush.ApplicationServer,
  type: NotificationType,
  orders: ScheduledOrder[],
  now: Date,
) {
  const userId = orders[0].user_id;
  const scheduledFor = new Date(orders[0].scheduled_purchase_at).toISOString();
  const groupId = await getGroupId(userId, scheduledFor, type);
  const message = buildMessage(type, orders);
  const targetHref = orders.length === 1
    ? `/orders/detail?id=${encodeURIComponent(orders[0].id)}&notification_order=${encodeURIComponent(orders[0].id)}`
    : `/?notification_group=${encodeURIComponent(groupId)}`;

  const rowsToInsert = orders.map((order) => ({
    user_id: order.user_id,
    order_id: order.id,
    group_id: groupId,
    notification_type: type,
    title: message.title,
    body: message.body,
    target_href: targetHref,
    scheduled_for: scheduledFor,
  }));
  const { error: insertError } = await supabase
    .from("app_notifications")
    .upsert(rowsToInsert, {
      onConflict: "order_id,scheduled_for,notification_type",
      ignoreDuplicates: true,
    });
  if (insertError) throw new Error(`알림 내역 생성 실패: ${insertError.message}`);

  const rows = await fetchGroupRows(supabase, groupId, userId, type, scheduledFor);
  const unsentRows = rows.filter((row) => !row.sent_at);
  if (unsentRows.length === 0) return { groups: 1, sent: 0, failed: 0 };

  const attemptAt = now.toISOString();
  const nextAttempt = Math.max(
    ...unsentRows.map((row) => Number(row.delivery_attempts) || 0),
    0,
  ) + 1;
  const { error: attemptError } = await supabase
    .from("app_notifications")
    .update({ delivery_attempts: nextAttempt, last_attempt_at: attemptAt })
    .in("id", unsentRows.map((row) => row.id));
  if (attemptError) throw new Error(`알림 발송 시도 기록 실패: ${attemptError.message}`);

  const subscriptions = await fetchSubscriptions(supabase, userId);
  if (subscriptions.length === 0) return { groups: 1, sent: 0, failed: 1 };

  const payload = {
    title: message.title,
    body: message.body,
    type,
    groupId,
    orderIds: orders.map((order) => order.id),
    targetUrl: targetHref,
  };
  const results = [];
  for (const subscription of subscriptions) {
    results.push(
      await sendToSubscription(supabase, appServer, subscription, payload, attemptAt),
    );
  }
  const successful = results.filter((result) => result.sent).length;
  if (successful === 0) return { groups: 1, sent: 0, failed: 1 };

  const { error: sentError } = await supabase
    .from("app_notifications")
    .update({ sent_at: attemptAt })
    .in("id", unsentRows.map((row) => row.id));
  if (sentError) throw new Error(`알림 발송 상태 저장 실패: ${sentError.message}`);

  if (type === "purchase_due") {
    const { error: readError } = await supabase
      .from("app_notifications")
      .update({ read_at: attemptAt })
      .eq("user_id", userId)
      .eq("scheduled_for", scheduledFor)
      .eq("notification_type", "purchase_10m")
      .in("order_id", orders.map((order) => order.id))
      .is("read_at", null)
      .is("cancelled_at", null);
    if (readError) throw new Error(`이전 알림 읽음 처리 실패: ${readError.message}`);
  }

  return { groups: 1, sent: successful, failed: results.length - successful };
}

async function processType(
  supabase: ReturnType<typeof createClient>,
  appServer: webpush.ApplicationServer,
  type: NotificationType,
  now: Date,
) {
  const orders = await fetchScheduledOrders(supabase, type, now);
  const groups = new Map<string, ScheduledOrder[]>();
  for (const order of orders) {
    const scheduledFor = new Date(order.scheduled_purchase_at).toISOString();
    const key = `${order.user_id}:${scheduledFor}`;
    const group = groups.get(key) ?? [];
    group.push(order);
    groups.set(key, group);
  }

  let groupCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  for (const group of groups.values()) {
    const result = await processGroup(supabase, appServer, type, group, now);
    groupCount += result.groups;
    sentCount += result.sent;
    failedCount += result.failed;
  }
  return { groups: groupCount, sent: sentCount, failed: failedCount };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const expectedSecret = getRequiredEnv("NOTIFICATION_CRON_SECRET");
  if (req.headers.get("x-notification-cron-secret") !== expectedSecret) {
    return jsonResponse({ error: "인증이 필요합니다." }, 401);
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const vapidKeys = await webpush.importVapidKeys(
      decodeBase64Json(getRequiredEnv("VAPID_KEYS_JSON_B64")),
      { extractable: false },
    );
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get("VAPID_SUBJECT")?.trim() || "https://rm.jinitlab.com",
      vapidKeys,
    });
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const now = new Date();
    const cancelled = await cancelInvalidPendingNotifications(supabase, now);
    const [tenMinutes, due] = await Promise.all([
      processType(supabase, appServer, "purchase_10m", now),
      processType(supabase, appServer, "purchase_due", now),
    ]);
    return jsonResponse({
      ok: true,
      cancelled,
      groups: tenMinutes.groups + due.groups,
      sent: tenMinutes.sent + due.sent,
      failed: tenMinutes.failed + due.failed,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "알림 처리에 실패했습니다.",
    }, 500);
  }
});
