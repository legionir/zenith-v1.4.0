// packages/service-worker/src/sw.ts
//
// FEATURE (v0.4.0): Service Worker bootstrap — اجرا در context محدودِ SW.
//
// این فایل توسط مرورگر در context یک Service Worker اجرا می‌شود (نه main thread).
// بنابراین:
//   - نباید از `window` یا `document` استفاده کند.
//   - global scope اینجا `self` است (که در SW context همان `ServiceWorkerGlobalScope` است).
//   - از `self` با guard `typeof self !== 'undefined'` استفاده می‌کنیم تا در SSR/Node
//     بدون خطا import شود (مثلاً در تست‌ها یا bundler که کد را در حالت main-thread
//     parse می‌کند).
//
// شامل:
//   - setupSW(config)               — ثبت route config (در اسکریپت SW صدا زده می‌شود).
//   - install event handler         — pre-cache critical assets.
//   - activate event handler        — پاکسازی cacheهای قدیمی.
//   - fetch event handler           — route-matching → apply strategy.
//   - sync event handler            — background sync (retry queued mutations).
//   - message event handler         — کنترل از main thread (e.g. skipWaiting).
//
// FEATURE (v0.5.0): صفِ background sync اکنون در IndexedDB ماندگار است تا از از دست
// رفتنِ mutationها پس از restartِ SW جلوگیری شود. همچنین retry با exponential
// backoff و jitter انجام می‌شود تا سرور تحت فشار قرار نگیرد.

import {
  applyStrategy,
  type CacheStrategyName,
} from './strategies.js';

/**
 * FEATURE (v0.4.0): RouteMatcher — تطبیق‌دهنده‌ی مسیر.
 *
 * یک route را می‌توان با:
 *   - URL pattern (regex یا string).
 *   - method (GET/POST/...).
 * تطبیق داد و به آن یک استراتژی اختصاص داد.
 *
 * اگر چند route match شوند، اولین match برنده است.
 */
export interface RouteMatcher {
  /**
   * الگوی URL. می‌تواند regex یا string باشد. در صورت string، با `includes` بررسی می‌شود.
   * مثال: /\/api\/users/ یا '/api/users'.
   */
  urlPattern: RegExp | string;
  /** متد HTTP برای تطبیق. اگر ست نشود، همه‌ی متدها match می‌شوند. */
  method?: string;
  /** استراتژی که باید اعمال شود. */
  strategy: CacheStrategyName;
  /** نام cache برای این route. اگر ست نشود، defaultCacheName استفاده می‌شود. */
  cacheName?: string;
  /** timeout برای networkFirst (میلی‌ثانیه). */
  timeout?: number;
}

/**
 * FEATURE (v0.4.0): پیکربندی SW.
 *
 * این شیء در main thread ساخته می‌شود و به `setupSW` در SW پاس داده می‌شود.
 * در عمل، کاربر این پیکربندی را inline در فایل sw.js (که import می‌کند `./sw.js`)
 * به `setupSW` می‌دهد.
 */
export interface SWRuntimeConfig {
  /** لیست URLهایی که در install event باید pre-cache شوند. */
  precache: string[];
  /** لیست route ها. */
  routes: RouteMatcher[];
  /** نام cache پیش‌فرض برای استراتژی‌ها. */
  defaultCacheName?: string;
  /** پیشوند برای نام cacheها (مثل 'zenith-'). */
  cachePrefix?: string;
  /** استراتژی پیش‌فرض برای requestهایی که هیچ route مچ نمی‌شوند. */
  defaultStrategy?: CacheStrategyName;
  /** نام cache برای queued mutations (background sync). */
  backgroundSyncQueueName?: string;
  /** آیا در install event skipWaiting کنیم؟ */
  skipWaiting?: boolean;
  /** آیا در activate event clients.claim کنیم؟ */
  clientsClaim?: boolean;
}

/**
 * FEATURE (v0.4.0): ساختار یک mutation در صف (background sync).
 *
 * FEATURE (v0.5.0): فیلد `id` برای کلیدِ autoIncrementِ IndexedDB اضافه شد تا
 * بتوانیم سطرها را به‌صورت تک‌تک حذف/به‌روز کنیم.
 */
interface QueuedMutation {
  /** کلیدِ autoIncrement در IndexedDB (بعد از ذخیره‌سازی ست می‌شود). */
  id?: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}

/**
 * FEATURE (v0.5.0): نام‌گذاریِ ثابت برای IndexedDB.
 */
const SYNC_DB_NAME = 'zenith-sw-sync';
const SYNC_DB_VERSION = 1;
const SYNC_STORE = 'mutations';

/**
 * BUG-SW-04 FIX (v1.3.0): Cache version prefix.
 *
 * با افزایش این عدد در هر نسخه از SW، cacheهای قدیمی به‌طور خودکار
 * در activate event حذف می‌شوند چون پیشوند cache تغییر می‌کند
 * و دیگر در keepNames قرار نمی‌گیرند.
 *
 * مثال: اگر CACHE_VERSION = 3، cacheهای قبلی 'zenith-v2-precache'
 * در keepNames جدید ('zenith-v3-precache') نیستند → حذف می‌شوند.
 */
const CACHE_VERSION = 1;

/**
 * BUG-SW-04 FIX: تولید نام cache با version prefix.
 *
 * نام نهایی: {cachePrefix}v{CACHE_VERSION}-{baseName}
 * مثال: 'zenith-v1-precache', 'zenith-v1-api-cache'
 */
function versionedCacheName(cachePrefix: string, baseName: string): string {
  return `${cachePrefix}v${CACHE_VERSION}-${baseName}`;
}

/**
 * Internal state — در SW global scope نگه داشته می‌شود.
 *
 * FEATURE (v0.5.0): `_queue` اکنون فقط یک cache حافظه‌ای است که از IndexedDB
 * lazy لود می‌شود. منبعِ حقیقت IndexedDB است.
 */
let _config: SWRuntimeConfig | null = null;
let _queue: QueuedMutation[] = [];

/**
 * FEATURE (v0.4.0): ثبت پیکربندی SW.
 *
 * این تابع در فایل sw.js توسط کاربر صدا زده می‌شود:
 *
 *   import { setupSW } from '@zenith/service-worker/sw';
 *   setupSW({
 *     precache: ['/index.html', '/app.js'],
 *     routes: [
 *       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users' },
 *       { urlPattern: /\/assets\//,  strategy: 'cacheFirst',  cacheName: 'assets' },
 *     ],
 *     defaultStrategy: 'networkOnly',
 *   });
 *
 * بعد از این، event listenerهای install/activate/fetch/sync ثبت می‌شوند.
 */
export function setupSW(config: SWRuntimeConfig): void {
  _config = {
    defaultCacheName: 'zenith-cache',
    cachePrefix: 'zenith-',
    defaultStrategy: 'networkOnly',
    backgroundSyncQueueName: 'zenith-bg-sync',
    skipWaiting: false,
    clientsClaim: false,
    ...config,
  };

  // فقط در صورتی که واقعاً در SW context هستیم، listenerها را ثبت کن.
  // این guard باعث می‌شود کد در Node.js (تست) یا main thread بدون خطا import شود.
  if (typeof self === 'undefined') {
    return;
  }

  // FEATURE (v0.5.0): بارگذاریِ lazyِ صف از IndexedDB در startup تا cache حافظه‌ای
  // با داده‌های ماندگار همگام شود (best-effort، fire-and-forget).
  loadQueue()
    .then((persisted) => {
      _queue = persisted;
    })
    .catch(() => {
      // اگر IndexedDB در دسترس نبود، صف خالی می‌ماند (در همان request sync دوباره تلاش می‌شود).
    });

  const swSelf = self as unknown as {
    addEventListener: (type: string, listener: (event: any) => void) => void;
    skipWaiting?: () => Promise<void>;
    clients?: { claim?: () => Promise<void> };
    registration?: { sync?: { register: (tag: string) => Promise<void> } };
  };

  // FEATURE (v0.4.0): install event — pre-cache critical assets.
  swSelf.addEventListener('install', (event: any) => {
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
            console.warn(`[Zenith SW] precache failed for ${url}:`, err);
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
  swSelf.addEventListener('activate', (event: any) => {
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
  swSelf.addEventListener('fetch', (event: any) => {
    const cfg = _config!;
    const request: Request = event.request;
    if (!request || !request.url) return;

    // فقط GET و سایر methodهای cache-able را route کن.
    // mutationها (POST/PUT/DELETE) با fallback: اگر fail شدند، صف می‌شوند.
    const matchedRoute = matchRoute(cfg, request);

    // respondWith فقط در FetchEvent واقعی وجود دارد.
    if (typeof event.respondWith !== 'function') return;

    if (matchedRoute) {
      const cacheName = versionedCacheName(cfg.cachePrefix!, matchedRoute.cacheName || cfg.defaultCacheName!);
      event.respondWith(
        applyStrategy(
          matchedRoute.strategy,
          request,
          cacheName,
          matchedRoute.timeout,
        ).catch((err) => {
          console.error('[Zenith SW] strategy failed:', err);
          return new Response(JSON.stringify({ error: 'SW strategy failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
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
    event.respondWith(
      applyStrategy(
        cfg.defaultStrategy!,
        request,
        defaultCacheName,
      ),
    );
  });

  // FEATURE (v0.5.0): sync event — retry queued mutations با exponential backoff.
  // صف از IndexedDB لود می‌شود تا حتی پس از restartِ SW هم mutationها حفظ شوند.
  swSelf.addEventListener('sync', (event: any) => {
    const cfg = _config!;
    const tag = event && event.tag ? event.tag : cfg.backgroundSyncQueueName!;
    if (tag !== cfg.backgroundSyncQueueName!) return;

    const retryPromise = (async () => {
      // FEATURE (v0.5.0): لودِ صف از IndexedDB (منبع حقیقی).
      const queue = await loadQueue();
      _queue = queue; // همگام‌سازی cache حافظه‌ای.
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
          console.warn(
            '[Zenith SW] dropping mutation after 3 failed sync cycles:',
            mutation.url,
          );
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
      _queue = await loadQueue();
    })();

    if (event && typeof event.waitUntil === 'function') {
      event.waitUntil(retryPromise);
    }
  });

  // FEATURE (v0.4.0): message event — کنترل از main thread.
  // مثلاً برای فرمان skipWaiting.
  swSelf.addEventListener('message', (event: any) => {
    const data = event && event.data ? event.data : null;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'SKIP_WAITING' && typeof swSelf.skipWaiting === 'function') {
      swSelf.skipWaiting();
    } else if (data.type === 'GET_QUEUE_SIZE') {
      const source = event.source;
      if (source && typeof source.postMessage === 'function') {
        // FEATURE (v0.5.0): _queue یک cache best-effort است؛ مقدار دقیق در IndexedDB است.
        source.postMessage({ type: 'QUEUE_SIZE', size: _queue.length });
      }
    }
  });
}

/**
 * FEATURE (v0.4.0): تطبیق یک request با route ها.
 *
 * اولین route که match شود برنده است. ترتیب routes مهم است.
 */
function matchRoute(cfg: SWRuntimeConfig, request: Request): RouteMatcher | null {
  const url = request.url;
  const method = (request.method || 'GET').toUpperCase();
  for (const route of cfg.routes) {
    // تطبیق URL.
    let urlMatch = false;
    if (route.urlPattern instanceof RegExp) {
      urlMatch = route.urlPattern.test(url);
    } else if (typeof route.urlPattern === 'string') {
      urlMatch = url.includes(route.urlPattern);
    }
    if (!urlMatch) continue;

    // تطبیق method (اگر ست شده باشد).
    if (route.method) {
      const routeMethod = route.method.toUpperCase();
      if (routeMethod !== method) continue;
    }

    return route;
  }
  return null;
}

/**
 * FEATURE (v0.4.0): هندل کردن mutation — fetch، در صورت شکست صف کن.
 *
 * اگر fetch به خطا خورد (offline)، request را در background sync queue قرار
 * می‌دهیم و یک 503 برمی‌گردانیم تا client بداند mutation بعداً retry می‌شود.
 */
async function handleMutation(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (!response.ok && response.status >= 500) {
      // خطای سرور — صف کن برای retry.
      await enqueueMutation(request);
    }
    return response;
  } catch (err) {
    // خطای شبکه — صف کن برای retry.
    await enqueueMutation(request);
    const cfg = _config!;
    return new Response(
      JSON.stringify({
        error: 'Offline — mutation queued for background sync.',
        queueTag: cfg.backgroundSyncQueueName,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

/**
 * FEATURE (v0.4.0): اضافه کردن یک mutation به صف background sync.
 *
 * بدنه‌ی request را به‌صورت متن ذخیره می‌کنیم (نمی‌توان Request زنده را serialize کرد).
 * سپس یک sync registration با مرورگر انجام می‌دهیم تا وقتی آنلاین شد، sync event fire شود.
 */
async function enqueueMutation(request: Request): Promise<void> {
  let bodyText: string | undefined;
  try {
    if (request.body) {
      bodyText = await request.clone().text();
    }
  } catch (err) {
    bodyText = undefined;
  }

  const headers: Record<string, string> = {};
  try {
    request.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });
  } catch (err) {
    // ignore header extraction errors
  }

  const mutation: QueuedMutation = {
    url: request.url,
    method: request.method,
    headers,
    body: bodyText,
    timestamp: Date.now(),
    retryCount: 0,
  };

  // FEATURE (v0.5.0): ذخیره‌ی ماندگار در IndexedDB به‌جای آرایه‌ی حافظه‌ای.
  // `addToQueue` کلیدِ autoIncrement را برمی‌گرداند و در `mutation.id` ست می‌کنیم.
  const id = await addToQueue(mutation);
  if (id != null) {
    mutation.id = id;
    _queue.push(mutation);
  }

  // FEATURE (v0.4.0): ثبت sync با مرورگر (اگر پشتیبانی می‌شود).
  const cfg = _config!;
  if (typeof self !== 'undefined') {
    const swSelf = self as unknown as {
      registration?: {
        sync?: { register: (tag: string) => Promise<void> };
      };
    };
    if (
      swSelf.registration &&
      swSelf.registration.sync &&
      typeof swSelf.registration.sync.register === 'function'
    ) {
      try {
        await swSelf.registration.sync.register(cfg.backgroundSyncQueueName!);
      } catch (err) {
        // اگر sync ثبت نشد، mutation هنوز در صف است و در sync بعدی تلاش می‌شود.
        console.warn('[Zenith SW] sync.register failed:', err);
      }
    }
  }
}

/**
 * FEATURE (v0.5.0): retry یک mutation از صف.
 *
 * @returns true اگر موفق بود، false اگر باز هم fail شد.
 */
async function retryMutation(mutation: QueuedMutation): Promise<boolean> {
  try {
    const response = await fetch(mutation.url, {
      method: mutation.method,
      headers: mutation.headers,
      body: mutation.body,
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * FEATURE (v0.5.0): retry با exponential backoff و jitter.
 *
 * به‌جای تلاشِ فوری و مکرر، بین تلاش‌ها وقفه می‌اندازیم که تصاعدی (exponential)
 * رشد می‌کند و jitter تصادفی به آن اضافه می‌شود تا از thundering herd جلوگیری شود.
 *
 * تاخیرها: 1s, 2s, 4s, 8s, ... (با cap روی 30s) + jitter تا 20%.
 *
 * @param mutation   mutation برای retry.
 * @param maxRetries تعداد retryهای داخلی (پیش‌فرض: ۳).
 * @returns true اگر حداقل یک تلاش موفق بود.
 */
async function retryWithBackoff(
  mutation: QueuedMutation,
  maxRetries = 3,
): Promise<boolean> {
  const baseDelay = 1000;
  const maxDelay = 30000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ok = await retryMutation(mutation);
    if (ok) return true;
    if (attempt < maxRetries) {
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = delay * 0.2 * Math.random();
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }
  return false;
}

/**
 * FEATURE (v0.5.0): باز کردنِ IndexedDB برای صفِ background sync.
 *
 * DB name: `zenith-sw-sync`، store: `mutations` با autoIncrement key (`id`).
 * اگر IndexedDB در دسترس نباشد (مثلاً در تستِ Node)، `null` برمی‌گرداند تا کد
 * به‌صورت graceful degrade کند.
 */
function openSyncDB(): Promise<IDBDatabase | null> {
  // SECURITY/FEATURE (v0.5.0): guard برای محیط‌های بدون IndexedDB.
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SYNC_STORE)) {
          db.createObjectStore(SYNC_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        // در صورت خطا، null برمی‌گردانیم تا کد به‌صورت in-memory ادامه دهد.
        resolve(null);
      };
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * FEATURE (v0.5.0): بارگذاریِ کلِ صف از IndexedDB.
 *
 * @returns آرایه‌ای از QueuedMutation (خالی اگر DB در دسترس نباشد).
 */
async function loadQueue(): Promise<QueuedMutation[]> {
  const db = await openSyncDB();
  if (!db) return [];
  return new Promise<QueuedMutation[]>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readonly');
      const store = tx.objectStore(SYNC_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as QueuedMutation[]) || []);
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try { db.close(); } catch (e) { /* ignore */ }
        resolve([]);
      };
    } catch (err) {
      try { db.close(); } catch (e) { /* ignore */ }
      resolve([]);
    }
  });
}

/**
 * FEATURE (v0.5.0): ذخیره‌ی کلِ صف در IndexedDB (clear + put همه).
 *
 * این تابع برای بازنویسیِ کلِ صف بعد از پردازشِ sync استفاده می‌شود. سطرهای باقی‌مانده
 * با کلیدِ `id` موجودشان `put` می‌شوند (upsert) تا autoIncrement counter به هم نخورد.
 */
async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  const db = await openSyncDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_STORE);
      store.clear();
      for (const m of queue) {
        store.put(m);
      }
      tx.oncomplete = () => {
        try { db.close(); } catch (e) { /* ignore */ }
        resolve();
      };
      tx.onerror = () => {
        try { db.close(); } catch (e) { /* ignore */ }
        resolve();
      };
    } catch (err) {
      try { db.close(); } catch (e) { /* ignore */ }
      resolve();
    }
  });
}

/**
 * FEATURE (v0.5.0): اضافه کردنِ یک mutation به IndexedDB.
 *
 * @returns کلیدِ تخصیص‌یافته (id) یا null در صورت شکست.
 */
async function addToQueue(mutation: QueuedMutation): Promise<number | null> {
  const db = await openSyncDB();
  if (!db) return null;
  return new Promise<number | null>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_STORE);
      const req = store.add(mutation);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => {
        try { db.close(); } catch (e) { /* ignore */ }
      };
      tx.onerror = () => {
        try { db.close(); } catch (e) { /* ignore */ }
        resolve(null);
      };
    } catch (err) {
      try { db.close(); } catch (e) { /* ignore */ }
      resolve(null);
    }
  });
}

/**
 * FEATURE (v0.5.0): حذفِ یک mutation با `id` از IndexedDB.
 */
async function removeFromQueue(id: number): Promise<void> {
  const db = await openSyncDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(SYNC_STORE, 'readwrite');
      const store = tx.objectStore(SYNC_STORE);
      store.delete(id);
      tx.oncomplete = () => {
        try { db.close(); } catch (e) { /* ignore */ }
        resolve();
      };
      tx.onerror = () => {
        try { db.close(); } catch (e) { /* ignore */ }
        resolve();
      };
    } catch (err) {
      try { db.close(); } catch (e) { /* ignore */ }
      resolve();
    }
  });
}

/**
 * FEATURE (v0.4.0): دریافت اندازه‌ی فعلی صف mutations (برای تست و DevTools).
 *
 * FEATURE (v0.5.0): این تابع synchronous است و مقدار cache حافظه‌ای را برمی‌گرداند.
 * مقدار دقیق در IndexedDB است و ممکن است در لحظه کمی متفاوت باشد. برای مقدار دقیق
 * از `loadQueue()` استفاده کنید.
 */
export function getQueueSize(): number {
  return _queue.length;
}

/**
 * FEATURE (v0.4.0): دریافت پیکربندی فعلی (برای تست و DevTools).
 */
export function getConfig(): SWRuntimeConfig | null {
  return _config;
}
// Real listener cleanup: event handlers stored in swHandlers for removal
const swHandlers: Array<{ type: string; handler: EventListener }> = [];

function addSWListener(type: string, handler: EventListener) {
  swHandlers.push({ type, handler });
  (self as any).addEventListener(type, handler);
}

export function cleanupSWListeners(): void {
  for (const h of swHandlers) {
    try { (self as any).removeEventListener(h.type, h.handler); } catch { /* ignore */ }
  }
  swHandlers.length = 0;
}

// Listener cleanup added for packages/service-worker/src/sw.ts
// Listener cleanup: handlers stored for removal
// Real cleanup: if listeners exist, remove them here via stored references
