// pulse service worker: offline copies of pages you've opened, and morning push notifications.
const PAGES = "pulse-pages-v1";
const ASSETS = "pulse-assets-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Built assets never change under the same name: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches
        .open(ASSETS)
        .then(
          async (c) =>
            (await c.match(req)) ?? fetch(req).then((res) => (c.put(req, res.clone()), res)),
        ),
    );
    return;
  }
  // Pages: always the network when there is one; the last copy when there isn't.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(
          async () => (await caches.match(req)) ?? (await caches.match("/")) ?? Response.error(),
        ),
    );
  }
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "pulse", {
      body: data.body ?? "",
      icon: "/apple-icon",
      badge: "/icon.svg",
      tag: "morning",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
