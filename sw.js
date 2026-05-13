const CACHE_NAME = "neon-fruit-blade-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/fruits/watermelon-full.svg",
  "./assets/fruits/watermelon-left.svg",
  "./assets/fruits/watermelon-right.svg",
  "./assets/fruits/watermelon-splash.svg",
  "./assets/fruits/mango-full.svg",
  "./assets/fruits/mango-left.svg",
  "./assets/fruits/mango-right.svg",
  "./assets/fruits/mango-splash.svg",
  "./assets/fruits/kiwi-full.svg",
  "./assets/fruits/kiwi-left.svg",
  "./assets/fruits/kiwi-right.svg",
  "./assets/fruits/kiwi-splash.svg",
  "./assets/fruits/dragon-full.svg",
  "./assets/fruits/dragon-left.svg",
  "./assets/fruits/dragon-right.svg",
  "./assets/fruits/dragon-splash.svg",
  "./assets/fruits/pineapple-full.svg",
  "./assets/fruits/pineapple-left.svg",
  "./assets/fruits/pineapple-right.svg",
  "./assets/fruits/pineapple-splash.svg",
  "./assets/fruits/plum-full.svg",
  "./assets/fruits/plum-left.svg",
  "./assets/fruits/plum-right.svg",
  "./assets/fruits/plum-splash.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
