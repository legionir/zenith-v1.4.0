# @zenith/service-worker

> Zenith framework — Offline-first Service Worker با استراتژی‌های کش (Phase 13 / v0.4.0).

یک راه‌حلِ **zero-dependency** و Workbox-style برای offline-first در Zenith. شامل ۵
استراتژی کش استاندارد، pre-cache، route-matching، و background sync queue.

---

## نصب

```bash
npm install @zenith/service-worker
# یا در monorepo:
bun add @zenith/service-worker
```

این پکیج **هیچ وابستگی runtime** ندارد.

---

## ساختار

```
@zenith/service-worker
├── src/
│   ├── index.ts        ← API اصلی main-thread (registerSW, plugin)
│   ├── sw.ts           ← SW bootstrap (install/activate/fetch/sync)
│   └── strategies.ts   ← ۵ استراتژی کش
├── dist/               ← ES module output (no types)
└── README.md
```

---

## ۵ استراتژی کش

همه‌ی استراتژی‌ها `Promise<Response>` برمی‌گردانند و از Cache API
(`caches.open`, `cache.match`, `cache.put`) استفاده می‌کنند.

| استراتژی              | رفتار                                                       | بهترین استفاده                |
|----------------------|-------------------------------------------------------------|-------------------------------|
| `cacheFirst`         | cache → network → fallback 503                              | assets استاتیک hash‌شده        |
| `networkFirst`       | network (با timeout) → cache → 503                          | API داده‌ای حساس به تازگی       |
| `staleWhileRevalidate` | cache فورا + revalidate در پس‌زمینه                          | داده‌های کم‌اهمیت تازگی          |
| `networkOnly`        | مستقیم fetch                                                 | mutation ها، endpoints حساس    |
| `cacheOnly`          | مستقیم cache → 503                                           | pre-critical assets           |

### استفاده مستقیم از استراتژی‌ها (در SW context)

```ts
import { cacheFirst, networkFirst } from '@zenith/service-worker/strategies';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event.request, 'zenith-assets'));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request, 'zenith-api', 3000));
  }
});
```

---

## SWConfig — پیکربندی main-thread

```ts
import type { SWConfig } from '@zenith/service-worker';

const config: SWConfig = {
  swUrl: '/sw.js',
  precache: ['/', '/index.html', '/app.js', '/styles.css'],
  routes: [
    { urlPattern: '/api/users',  strategy: 'networkFirst',  cacheName: 'users',  timeout: 3000 },
    { urlPattern: '/api/products', strategy: 'staleWhileRevalidate', cacheName: 'products' },
    { urlPattern: /\/assets\//,   strategy: 'cacheFirst',    cacheName: 'assets' },
  ],
  defaultStrategy: 'networkOnly',
  skipWaiting: false,
  clientsClaim: false,
};
```

---

## ثبت مستقیم SW (بدون Plugin)

```ts
import { registerSW } from '@zenith/service-worker';

const controller = registerSW('/sw.js', {
  scope: '/',
  onUpdateFound: (reg) => console.log('SW update found:', reg),
  onControllerChange: (controller) => console.log('Controller changed:', controller),
  onError: (err) => console.error('SW registration failed:', err),
});

if (controller.supported) {
  await controller.update();
  await controller.unregister();
}
```

---

## نصب به‌عنوان Zenith Plugin

```ts
import { Zen } from '@zenith/runtime';
import { zenithSWPlugin } from '@zenith/service-worker';

Zen.use(zenithSWPlugin, {
  swUrl: '/sw.js',
  precache: ['/'],
  routes: [
    { urlPattern: '/api', strategy: 'networkFirst', cacheName: 'api' },
  ],
  defaultStrategy: 'networkOnly',
});

// بعد از install:
//   Zen.sw.update()
//   Zen.sw.unregister()
//   Zen.sw.skipWaiting()
// اکشن‌های پیش‌فرض:
//   zen-action="swUpdate"
//   zen-action="swUnregister"
```

---

## ساخت فایل `sw.js` (ساخت کاربر)

این پکیج یک فایل SW از پیش ساخته شده نمی‌دهد — کاربر باید خودش یک فایل `sw.js`
در public root بسازد که `setupSW` را صدا بزند:

```js
// public/sw.js
import { setupSW } from '@zenith/service-worker/sw';

setupSW({
  precache: ['/', '/index.html', '/app.js'],
  routes: [
    { urlPattern: '/api/users',  strategy: 'networkFirst', cacheName: 'users', timeout: 3000 },
    { urlPattern: /\/assets\//,   strategy: 'cacheFirst',  cacheName: 'assets' },
  ],
  defaultStrategy: 'networkOnly',
  backgroundSyncQueueName: 'zenith-bg-sync',
  skipWaiting: false,
  clientsClaim: false,
});
```

سپس در main thread:

```ts
import { registerSW } from '@zenith/service-worker';
registerSW('/sw.js');
```

---

## Background Sync

mutation ها (POST/PUT/DELETE/PATCH) که offline انجام می‌شوند، در یک صف قرار
می‌گیرند و وقتی اتصال شبکه برگردد، به‌صورت خودکار retry می‌شوند (تا ۳ بار).

```ts
// در main thread:
navigator.serviceWorker.ready.then((reg) => {
  return reg.sync.register('zenith-bg-sync');
});
```

---

## Security Notes

- کد SW از `self` استفاده می‌کند (نه `window`/`document`) و با guard `typeof self
  !== 'undefined'` در Node.js/SSR بدون خطا import می‌شود.
- کد main-thread با guard `typeof navigator !== 'undefined'` از crash در SSR
  جلوگیری می‌کند.
- فقط responseهای `ok` و متد `GET` کش می‌شوند (best practice).
- در صورت خطا، یک Response با status 503 برمی‌گردد (نه throw) تا fetch event
  نگه‌داری نشود.

---

## API Reference

### Main-thread (`@zenith/service-worker`)

- `registerSW(swUrl?, options?) → SWController`
- `unregisterSW() → Promise<boolean>`
- `updateSW() → Promise<boolean>`
- `zenithSWPlugin` (ZenithPlugin)
- Types: `SWConfig`, `RouteConfig`, `RegisterSWOptions`, `SWController`

### SW context (`@zenith/service-worker/sw`)

- `setupSW(config: SWRuntimeConfig) → void`
- `getQueueSize() → number`
- `getConfig() → SWRuntimeConfig | null`
- Types: `SWRuntimeConfig`, `RouteMatcher`

### Strategies (`@zenith/service-worker/strategies`)

- `cacheFirst(request, cacheName)`
- `networkFirst(request, cacheName, timeout?)`
- `staleWhileRevalidate(request, cacheName)`
- `networkOnly(request)`
- `cacheOnly(request, cacheName)`
- `applyStrategy(name, request, cacheName, timeout?)`
- Type: `CacheStrategyName`

---

## License

MIT — part of the Zenith framework.
