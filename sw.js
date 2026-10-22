const CACHE='smart-suite-v3';
const ASSETS=['./suite.html','./manifest-suite.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>{const net=fetch(e.request).then(res=>{try{if(res&&res.ok&&e.request.url.indexOf(self.location.origin)===0){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}}catch(err){}return res;}).catch(()=>cached);return cached||net;}));});