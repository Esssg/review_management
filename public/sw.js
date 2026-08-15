/* 앱이 닫혀 있어도 구매 예정 Push를 운영체제 알림으로 표시합니다. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "새 알림이 있습니다." };
  }

  const title = payload.title || "리뷰 매니저";
  const options = {
    body: payload.body || "새 알림이 있습니다.",
    icon: "/icons/review-manager-192.png",
    badge: "/icons/review-manager-192.png",
    tag: payload.groupId ? `review-manager-${payload.groupId}` : "review-manager-notification",
    renotify: true,
    data: {
      targetUrl: payload.targetUrl || "/",
      groupId: payload.groupId || null,
      orderIds: Array.isArray(payload.orderIds) ? payload.orderIds : [],
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.targetUrl || "/",
    self.location.origin,
  ).href;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windowClients) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
