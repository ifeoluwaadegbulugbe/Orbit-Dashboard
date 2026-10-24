/*
 * Orbit service worker - keeps the app opening on a bad connection.
 *
 *  - Built JS/CSS/fonts/icons (/_next/static, /icons): cache-first. File
 *    names are content-hashed, so a cached copy is never stale.
 *  - Dashboard pages: network-first, falling back to the last cached copy
 *    of that page, then to the offline page. The data on them comes from
 *    the app's own saved cache (see Providers.tsx).
 *  - Never touched: API routes, non-GET requests, other origins (Supabase,
 *    Paystack), and private client links (/c/, /review/) or auth pages.
 */

const VERSION = "orbit-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

const NEVER_CACHE = [/^\/api\//, /^\/c\//, /^\/pay\//, /^\/review\//, /^\/auth\//, /^\/reset-password/, /^\/login/, /^\/signup/, /^\/forgot-password/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Only cache real pages, not login redirects.
          if (res.ok && !res.redirected) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          return (await cache.match(req)) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});

// Signing out clears cached pages so the next person on this phone can't see them.
self.addEventListener("message", (event) => {
  if (event.data === "orbit:clear-cache") {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

// ── Push notifications (bookings, payments, reminders...) ─────────────────
// Sent by the server (src/lib/push/server.ts) even when Orbit is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Orbit", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Orbit";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/home" },
    }),
  );
});

// Tapping a notification opens (or focuses) Orbit on the right page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/home";
  const parsed = new URL(path, self.location.origin);
  const target = parsed.origin === self.location.origin ? parsed.href : new URL("/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          return w.focus().then(() => ("navigate" in w ? w.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
