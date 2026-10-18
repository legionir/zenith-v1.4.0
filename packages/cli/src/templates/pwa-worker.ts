export function pwaServiceWorkerTemplate(): string {
  return `// Zenith Service Worker — PWA Support
// Production Readiness #32
//
// استراتژی‌های caching:
//   - App Shell (HTML/CSS/JS): stale-while-revalidate
//   - Images: cache-first با expiration
//   - API calls: network-first با offline fallback

const CACHE_VERSION = 'v1';
const STATIC_CACHE = 'zenith-static-' + CACHE_VERSION;
const IMAGE_CACHE = 'zenith-images-' + CACHE_VERSION;
const API_CACHE = 'zenith-api-' + CACHE_VERSION;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/app.svg',
];

// ── Install: پیش‌cache کردن App Shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: پاکسازی cacheهای قدیمی ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, IMAGE_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: استراتژی‌های مختلف بر اساس نوع درخواست ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط GET requests را cache کن
  if (request.method !== 'GET') return;

  // Same-origin فقط
  if (url.origin !== location.origin) return;

  // ── API calls: network-first ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // ── Images: cache-first ──
  if (request.destination === 'image' || /\\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 50));
    return;
  }

  // ── App Shell (HTML, CSS, JS): stale-while-revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ── Helpers ──

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await limitCacheSize(cacheName, maxEntries);
    }
    return response;
  } catch (e) {
    // offline fallback
    if (request.destination === 'document') {
      return cache.match('/index.html');
    }
    throw e;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function limitCacheSize(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxEntries);
  }
}

// ── Background Sync (پشتیبانی از ارسال دیتا در زمان reconnect) ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'zenith-sync') {
    event.waitUntil(
      // در اینجا می‌توانید درخواست‌های ذخیره‌شده در IndexedDB را
      // مجدداً ارسال کنید. برای مثال:
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'zenith-sync' });
        });
      })
    );
  }
});

// ── Push Notifications ──
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Zenith Notification';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // اگر tab باز است، focus کن؛ در غیر این صورت باز کن
      for (const client of clients) {
        if (client.url === event.notification.data && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data);
      }
    })
  );
});
`;
}

/**
 * قالب Vite config با PWA plugin.
 *
 * در حالت PWA، vite-plugin-pwa اضافه می‌شود تا به‌طور خودکار
 * service worker را build و manifest را inject کند.
 */
