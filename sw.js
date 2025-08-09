const CACHE_NAME = 'wbgt-full-v3';
const FILES = ['./','index.html','styles.css','app.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});