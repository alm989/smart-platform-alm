self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.open('ss-v1').then(cache =>
      cache.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (e.request.method === 'GET' && res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => r))
    )
  );
});
