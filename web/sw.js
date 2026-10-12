// Keeps the app itself available offline. Books and covers are cached separately in IndexedDB by the page;
// Supabase requests always go to the network.
const VERSION = "rak-baca-v1";
const SHELL = [
  "./", "index.html", "config.js", "manifest.webmanifest",
  "vendor/supabase.js", "vendor/jszip.min.js", "vendor/pdf.min.js", "vendor/pdf.worker.min.js",
  "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === self.location.origin) {
    // Network first for the page (so updates arrive), cache first for everything else.
    if (e.request.mode === "navigate") {
      e.respondWith(fetch(e.request).then((r) => { caches.open(VERSION).then((c) => c.put("index.html", r.clone())); return r; }).catch(() => caches.match("index.html")));
    } else {
      e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
    }
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(VERSION).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))));
  }
});
