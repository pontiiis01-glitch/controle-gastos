const CACHE_NAME = 'financeiro-v1';
const assets = ['index.html', 'style.css', 'manifest.json', 'icone2.0.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
