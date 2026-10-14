/* global self, caches */
// Zenith Service Worker Emergency Kill Switch (#96)
// Deploy this file at your Service Worker URL (e.g. /sw.js or /sw-kill.js)
// to immediately evict all caches and unregister a broken Service Worker.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await self.registration.unregister();
      if (self.clients && self.clients.matchAll) {
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          if (client.navigate) await client.navigate(client.url);
        }
      }
    })(),
  );
});
