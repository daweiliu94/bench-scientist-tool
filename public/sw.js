const CACHE_NAME = "bench-scientist-tool-v6";
const BASE_URL = new URL(self.registration.scope);
const appUrl = (path) => new URL(path, BASE_URL).pathname;
const APP_SHELL = [
  BASE_URL.pathname,
  appUrl("index.html"),
  appUrl("manifest.webmanifest"),
  appUrl("icon.svg")
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(appUrl("index.html"), copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(appUrl("index.html"))))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(appUrl("index.html")));
    })
  );
});
