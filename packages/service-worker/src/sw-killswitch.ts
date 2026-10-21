// packages/service-worker/src/sw-killswitch.ts
//
// kill-switch اضطراری SW — استخراج مکانیکی از sw.ts، بدون تغییر رفتار (#40).

import { addSWListener } from './sw-listeners';


export function setupKillSwitchSW(): void {
  if (typeof self === 'undefined') return;
  const swSelf = self as unknown as {
    skipWaiting?: () => Promise<void>;
    registration?: { unregister?: () => Promise<boolean> };
    clients?: {
      claim?: () => Promise<void>;
      matchAll?: (opts?: {
        type?: string;
      }) => Promise<Array<{ url: string; navigate?: (url: string) => Promise<unknown> }>>;
    };
  };

  addSWListener('install', (event: any) => {
    const p = Promise.resolve(swSelf.skipWaiting?.());
    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(p);
    }
  });

  addSWListener('activate', (event: any) => {
    const killPromise = (async () => {
      const cacheStore = typeof caches !== 'undefined' ? caches : null;
      if (cacheStore) {
        const names = await cacheStore.keys();
        await Promise.all(names.map((name) => cacheStore.delete(name)));
      }
      if (swSelf.registration && typeof swSelf.registration.unregister === 'function') {
        await swSelf.registration.unregister();
      }
      if (swSelf.clients && typeof swSelf.clients.claim === 'function') {
        await swSelf.clients.claim();
      }
      if (swSelf.clients && typeof swSelf.clients.matchAll === 'function') {
        const clientList = await swSelf.clients.matchAll({ type: 'window' });
        for (const client of clientList) {
          if (typeof client.navigate === 'function') {
            await client.navigate(client.url);
          }
        }
      }
    })();

    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(killPromise);
    }
  });
}
