// packages/service-worker/src/sw-setup.ts
//
// راه‌اندازی SW (setupSW و هندلرهای install/activate/fetch/sync/message) —
// استخراج مکانیکی از sw.ts، بدون تغییر رفتار (#40).

import { logger } from '@zenith/logger';
import { applyStrategy } from './strategies.js';
import { matchRoute } from './sw-routing';
import { versionedCacheName, _config, _queue, setSWConfig, setSWQueue } from './sw-state';
import { swRuntimeConfigOptions } from './sw-options';
import { loadQueue, removeFromQueue } from './sw-db';
import { retryWithBackoff } from './sw-retry';
import { handleMutation } from './sw-mutations';
import { addSWListener } from './sw-listeners';
import type { SWRuntimeConfig, QueuedMutation } from './sw-types';


export function setupSW(config: SWRuntimeConfig): void {
  // #52 — اعتبارسنجی در مرز ورودی پیش از guard محیط
  setSWConfig(swRuntimeConfigOptions.resolve(config));

  // فقط در صورتی که واقعاً در SW context هستیم، listenerها را ثبت کن.
  // این guard باعث می‌شود کد در Node.js (تست) یا main thread بدون خطا import شود.
  if (typeof self === 'undefined') {
    return;
  }

  // FEATURE (v0.5.0): بارگذاریِ lazyِ صف از IndexedDB در startup تا cache حافظه‌ای
  // با داده‌های ماندگار همگام شود (best-effort، fire-and-forget).
  loadQueue()
    .then((persisted) => {
      setSWQueue(persisted);
    })
    .catch(() => {
      // اگر IndexedDB در دسترس نبود، صف خالی می‌ماند (در همان request sync دوباره تلاش می‌شود).
    });

  const swSelf = self as unknown as {
    addEventListener: (type: string, listener: (event: any) => void) => void;
    removeEventListener: (type: string, listener: (event: any) => void) => void;
    skipWaiting?: () => Promise<void>;
    clients?: { claim?: () => Promise<void> };
    registration?: { sync?: { register: (tag: string) => Promise<void> } };
  };

  // FIX (#6): همهٔ handlerها از طریق addSWListener ثبت می‌شوند تا در swHandlers
  // ذخیره شوند و cleanupSWListeners واقعاً بتواند آن‌ها را حذف کند.
  const registerHandler = (type: string, handler: (event: any) => void): void => {
    addSWListener(type, handler);
  };

  // FEATURE (v0.4.0): install event — pre-cache critical assets.
  registerHandler('install', (event: any) => {
    const cfg = _config!;
    const precachePromise = (async () => {
      const cacheStore = typeof caches !== 'undefined' ? caches : null;
      if (!cacheStore || cfg.precache.length === 0) return;
      const cache = await cacheStore.open(versionedCacheName(cfg.cachePrefix!, 'precache'));
      await Promise.all(
        cfg.precache.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            // NOTE: اگر یک asset fail شود، کل install نباید fail شود.
            // فقط log کن و ادامه بده (best-effort precache).
            logger.warn(
              `[Zenith SW] precache failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }),
      );
      if (cfg.skipWaiting && typeof swSelf.skipWaiting === 'function') {
        await swSelf.skipWaiting();
      }
    })();

    // waitUntil فقط در event واقعی SW وجود دارد.
    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(precachePromise);
    }
  });

  // FEATURE (v0.4.0): activate event — پاکسازی cacheهای قدیمی.
  registerHandler('activate', (event: any) => {
    const cfg = _config!;
    const cleanupPromise = (async () => {
      const cacheStore = typeof caches !== 'undefined' ? caches : null;
      if (!cacheStore) return;

      const keepNames = new Set<string>();
      // BUG-SW-04 FIX (v1.3.0): از versionedCacheName
      // استفاده کن تا cacheهای نسخه‌های قبلی SW حذف شوند.
      keepNames.add(versionedCacheName(cfg.cachePrefix!, 'precache'));
      for (const route of cfg.routes) {
        if (route.cacheName) {
          keepNames.add(versionedCacheName(cfg.cachePrefix!, route.cacheName));
        }
      }
      keepNames.add(versionedCacheName(cfg.cachePrefix!, cfg.defaultCacheName!));
      keepNames.add(versionedCacheName(cfg.cachePrefix!, cfg.backgroundSyncQueueName!));

      const existingNames = await cacheStore.keys();
      await Promise.all(
        existingNames.map(async (name) => {
          if (!keepNames.has(name)) {
            await cacheStore.delete(name);
          }
        }),
      );

      if (cfg.clientsClaim && swSelf.clients && typeof swSelf.clients.claim === 'function') {
        await swSelf.clients.claim();
      }
    })();

    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(cleanupPromise);
    }
  });

  // FEATURE (v0.4.0): fetch event — route-matching → apply strategy.
  registerHandler('fetch', (event: any) => {
    const cfg = _config!;
    const request: Request = event.request;
    if (!request || !request.url) return;

    // فقط GET و سایر methodهای cache-able را route کن.
    // mutationها (POST/PUT/DELETE) با fallback: اگر fail شدند، صف می‌شوند.
    const matchedRoute = matchRoute(cfg, request);

    // respondWith فقط در FetchEvent واقعی وجود دارد.
    if (typeof event.respondWith !== 'function') return;

    if (matchedRoute) {
      const cacheName = versionedCacheName(
        cfg.cachePrefix!,
        matchedRoute.cacheName || cfg.defaultCacheName!,
      );
      event.respondWith(
        applyStrategy(matchedRoute.strategy, request, { cacheName, timeout: matchedRoute.timeout }).catch(
          (err) => {
            logger.error(
              `[Zenith SW] strategy failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            return new Response(JSON.stringify({ error: 'SW strategy failed' }), {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
            });
          },
        ),
      );
      return;
    }

    // FEATURE (v0.4.0): mutation ها (POST/PUT/DELETE/PATCH) — تلاش برای fetch،
    // اگر fail شد، در صف background sync قرار بده و 503 برگردان.
    const method = (request.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      event.respondWith(handleMutation(request));
      return;
    }

    // defaultStrategy برای GET های unmatched.
    const defaultCacheName = versionedCacheName(cfg.cachePrefix!, cfg.defaultCacheName!);
    event.respondWith(applyStrategy(cfg.defaultStrategy!, request, { cacheName: defaultCacheName }));
  });

  // FEATURE (v0.5.0): sync event — retry queued mutations با exponential backoff.
  // صف از IndexedDB لود می‌شود تا حتی پس از restartِ SW هم mutationها حفظ شوند.
  registerHandler('sync', (event: any) => {
    const cfg = _config!;
    const tag = event && event.tag ? event.tag : cfg.backgroundSyncQueueName!;
    if (tag !== cfg.backgroundSyncQueueName!) return;

    const retryPromise = (async () => {
      // FEATURE (v0.5.0): لودِ صف از IndexedDB (منبع حقیقی).
      const queue = await loadQueue();
      setSWQueue(queue); // همگام‌سازی cache حافظه‌ای.
      const remaining: QueuedMutation[] = [];
      for (const mutation of queue) {
        // FEATURE (v0.5.0): retry با exponential backoff و jitter.
        const ok = await retryWithBackoff(mutation);
        if (ok) {
          // FIX (v1.2.7): delete each mutation from IndexedDB immediately
          // after successful retry, instead of rewriting the whole queue
          // at the end of the loop. Previously `saveQueue(remaining)` did
          // a `store.clear()` + `put` of only the remaining items, which
          // would silently drop any new mutation enqueued concurrently
          // during the retry loop (e.g. a POST that came in while sync
          // was running). Per-mutation deletion leaves concurrent
          // additions untouched.
          if (mutation.id != null) {
            await removeFromQueue(mutation.id);
          }
          continue;
        }
        mutation.retryCount += 1;
        // FEATURE (v0.5.0): بعد از ۳ cycle sync ناموفق، mutation را drop می‌کنیم.
        if (mutation.retryCount >= 3) {
          logger.warn(`[Zenith SW] dropping mutation after 3 failed sync cycles: ${mutation.url}`);
          // FIX (v1.2.7): also remove dropped mutations from IndexedDB
          // immediately (same rationale as the success branch above).
          if (mutation.id != null) {
            await removeFromQueue(mutation.id);
          }
          continue;
        }
        remaining.push(mutation);
      }
      // FIX (v1.2.7): no longer rewriting the whole queue — successful
      // and dropped mutations were removed one-by-one above. We only
      // need to refresh the in-memory cache from IndexedDB so it
      // reflects any concurrent additions.
      setSWQueue(await loadQueue());
    })();

    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(retryPromise);
    }
  });

  // FEATURE (v0.4.0): message event — کنترل از main thread.
  // مثلاً برای فرمان skipWaiting.
  registerHandler('message', (event: any) => {
    const data = event && event.data ? event.data : null;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'SKIP_WAITING' && typeof swSelf.skipWaiting === 'function') {
      void swSelf.skipWaiting();
    } else if (data.type === 'GET_QUEUE_SIZE') {
      const source = event.source;
      if (source && typeof source.postMessage === 'function') {
        // FEATURE (v0.5.0): _queue یک cache best-effort است؛ مقدار دقیق در IndexedDB است.
        source.postMessage({ type: 'QUEUE_SIZE', size: _queue.length });
      }
    }
  });
}
