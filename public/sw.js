// public/sw.js — TMS Portal Service Worker

const CACHE_NAME = "tms-v2";
const OFFLINE_URL = "/offline.html";

const APP_SHELL = ["/", "/offline.html", "/manifest.json"];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch((err) =>
        console.warn("[SW] App shell cache partial:", err)
      )
    )
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.hostname.includes("googleapis.com")) return;
  if (url.hostname.includes("gstatic.com")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|jpg|ico)$/) ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
//
// FCM is configured as DATA-ONLY (no `notification` key in the FCM payload).
// This means:
//   - Android: FCM does NOT show its own notification — our SW handles it
//   - Web:     event.data contains our data object directly
//   - iOS:     content-available wakes SW, we show notification ourselves
//
// The payload shape from send-push-notification edge function:
//   event.data.json() → { title, body, icon, badge, url, entity_type, tag, ... }
//
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    // Fallback: treat raw text as body
    payload = { title: "TMS Portal", body: event.data.text() };
  }

  // FCM wraps data-only payloads differently depending on platform.
  // On web: payload IS the data object directly.
  // On Android (via FCM data field): payload may be nested under `data`.
  const d = payload.data ?? payload;

  const title   = d.title   || payload.title   || "TMS Portal";
  const body    = d.body    || payload.body    || "You have a new notification";
  const icon    = d.icon    || "/icons/icon-192.png";
  const badge   = d.badge   || "/icons/icon-192.png";
  const url     = d.url     || payload.url     || "/dashboard";
  const tag     = d.tag     || payload.tag     || "tms-notification";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data:               { url },
      requireInteraction: false,
      vibrate:            [200, 100, 200],   // short-pause-short
      silent:             false,
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (
            client.url.includes(self.location.origin) &&
            "focus" in client
          ) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});