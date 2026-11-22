self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  if (!event.data) return;
  event.waitUntil((async function () {
    var payload;
    try { payload = event.data.json(); }
    catch (_error) { payload = { title: "UTD 경기 알림", body: event.data.text() }; }

    var title = typeof payload.title === "string" ? payload.title : "UTD 경기 알림";
    var options = {
      body: typeof payload.body === "string" ? payload.body : "경기 정보가 업데이트됐어요.",
      icon: typeof payload.icon === "string" ? payload.icon : "/UTD/apple-touch-icon.png",
      badge: "/UTD/favicon-32x32.png",
      tag: typeof payload.tag === "string" ? payload.tag : "utd-match-update",
      renotify: payload.renotify === true,
      data: { url: "https://chizumulu.github.io/UTD/" }
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil((async function () {
    var target = "https://chizumulu.github.io/UTD/";
    var windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (var i = 0; i < windows.length; i += 1) {
      var client = windows[i];
      if (client.url.indexOf("https://chizumulu.github.io/UTD/") === 0 && "focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
