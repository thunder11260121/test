const CACHE='wbgt-full-v1';
const ASSETS=['./','index.html','styles.css','app.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}
  else{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));} // network-first for API
});