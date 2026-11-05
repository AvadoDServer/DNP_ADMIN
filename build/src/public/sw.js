/* eslint-disable no-restricted-globals */
/*
 * AVADO Admin service worker (installable Admin and push alerts).
 *
 * What it does NOT do: cache the box's data. All box data comes over the
 * WAMP websocket, which a service worker never sees, and every other request
 * (the app's own files, /ipfs/, /metrics-api/, /care-api/, anything else)
 * goes to the network untouched. The only thing kept is offline.html, shown
 * when the AVADO cannot be reached at all (phone not on the AVADO Wi-Fi or
 * VPN), instead of the browser's own error page.
 *
 * Push: shows the alerts the DAPPMANAGER sends (modules/push) and opens the
 * Admin page the alert names when it is tapped.
 *
 * Adapted from DAppNode's admin-ui sw.js (dappnode/DNP_DAPPMANAGER,
 * packages/admin-ui/public/sw.js, GPL-3.0): push + notificationclick, and the
 * offline page for navigations only.
 */

const CACHE = "avado-admin-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Page loads only: network first, the offline page if the box is not there.
// Nothing is ever written to the cache here.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "AVADO";
  const options = {
    body: data.body || "Something on your AVADO needs you.",
    icon: "/android-chrome-192x192.png",
    badge: "/badge-96.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: typeof data.url === "string" ? data.url : "/dashboard" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  // Only Admin routes ("/packages/...") on this same address are opened
  const route = String((event.notification.data && event.notification.data.url) || "/dashboard");
  const safeRoute = route.startsWith("/") && !route.startsWith("//") ? route : "/dashboard";
  const target = `${self.location.origin}/#${safeRoute}`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then(c => (c && "navigate" in c ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
