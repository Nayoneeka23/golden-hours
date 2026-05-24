const CACHE_NAME = "goldenhours-v1";
const ASSETS = ["/", "/manifest.webmanifest", "/icon.svg", "/data/places.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
