const CACHE='wbgt-cache-v12';
const ASSETS=['./','index.html','spots.html','meals.html','favorites.html','styles.css','meals.js','spots.js','utils.js','gmaps_helper.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',evt=>{
  self.skipWaiting();
  evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',evt=>{
  evt.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',evt=>{
  const url=new URL(evt.request.url);
  if(url.origin===location.origin){
    evt.respondWith(caches.match(evt.request).then(r=>r||fetch(evt.request)));
  }else{
    evt.respondWith(fetch(evt.request).catch(()=>caches.match(evt.request)));
  }
});