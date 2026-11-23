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
      data: { url: matchNotificationTarget(payload.data && payload.data.url) }
    };
    await self.registration.showNotification(title, options);
  })());
});

function matchNotificationTarget(value) {
  var root = "https://chizumulu.github.io/UTD/";
  if (typeof value === "string") {
    try {
      var target = new URL(value);
      if (target.href === root || (target.origin === "https://chizumulu.github.io" &&
          target.pathname === "/UTD/" && target.hash.startsWith("#/match/"))) return target.href;
    } catch (_error) {}
  }
  return root;
}

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil((async function () {
    var data = event.notification.data;
    var root = "https://chizumulu.github.io/UTD/";
    var target = matchNotificationTarget(data && data.url);
    var windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (var i = 0; i < windows.length; i += 1) {
      var client = windows[i];
      if (!client.url.startsWith(root)) continue;
      if (client.url === target || target === root) return client.focus();
      if (typeof client.navigate === "function") {
        try {
          var navigated = await client.navigate(target);
          if (navigated) return navigated.focus();
        } catch (_error) {}
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
