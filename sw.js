const CACHE_NAME = "neon-fruit-blade-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/fruits/watermelon-full.png",
  "./assets/fruits/watermelon-left.png",
  "./assets/fruits/watermelon-right.png",
  "./assets/fruits/watermelon-splash.png",
  "./assets/fruits/mango-full.png",
  "./assets/fruits/mango-left.png",
  "./assets/fruits/mango-right.png",
  "./assets/fruits/mango-splash.png",
  "./assets/fruits/kiwi-full.png",
  "./assets/fruits/kiwi-left.png",
  "./assets/fruits/kiwi-right.png",
  "./assets/fruits/kiwi-splash.png",
  "./assets/fruits/dragon-full.png",
  "./assets/fruits/dragon-left.png",
  "./assets/fruits/dragon-right.png",
  "./assets/fruits/dragon-splash.png",
  "./assets/fruits/pineapple-full.png",
  "./assets/fruits/pineapple-left.png",
  "./assets/fruits/pineapple-right.png",
  "./assets/fruits/pineapple-splash.png",
  "./assets/fruits/plum-full.png",
  "./assets/fruits/plum-left.png",
  "./assets/fruits/plum-right.png",
  "./assets/fruits/plum-splash.png"
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
