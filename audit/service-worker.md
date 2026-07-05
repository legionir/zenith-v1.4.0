# گزارش حسابرسی پکیج `service-worker`
**نسخه:** v1.3.0 | **بسته:** `@zenith/service-worker`

---

## ۱. خلاصه پکیج

پکیج `service-worker` قابلیت Service Worker را برای فریم‌ورک Zenith فراهم می‌کند. شامل دو بخش است: API سمت main-thread (`registerSW`, `SWController`) و منطق SW سمت worker (`setupSW`). از IndexedDB برای صف همگام‌سازی background (با exponential backoff + jitter)، precaching، استراتژی‌های کش (networkFirst/cacheFirst/networkOnly)، و پشتیبانی از `SKIP_WAITING` و `unregister` تشکیل شده است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/index.ts` | ~۱۰۰+ | ثبت SW, SWController, zenithSWPlugin |
| `src/sw.ts` | ~۴۰۰+ | منطق Service Worker (setupSW, queues, cache) |

---

## ۳. باگ‌ها و مشکلات

### BUG-SW-01: IndexedDB queue با per-item deletion fix (v1.2.7) ممکن است کامل نباشد
- **شدت:** بالا
- **محل:** `src/sw.ts` – v1.2.7 fix
- **شرح:** v1.2.7 قابلیت حذف آیتم‌های مجزا را اضافه کرده است. اما اگر چند آیتم هم‌زمان در صف پردازش شوند، امکان race condition در حذف وجود دارد.
- **نحوه رفع:** استفاده از transaction-level locking:

```typescript
async processQueue(): Promise<void> {
  if (this._processing) return;
  this._processing = true;

  const tx = this._db.transaction('queue', 'readwrite');
  const store = tx.objectStore('queue');
  const allItems = await store.getAll();

  for (const item of allItems) {
    try {
      await this._processItem(item);
      // حذف با transaction یکسان
      await store.delete(item.id);
    } catch (err) {
      // به‌روزرسانی retry count
      item.retries = (item.retries ?? 0) + 1;
      await store.put(item);
    }
  }

  this._processing = false;
}
```

### BUG-SW-02: Exponential backoff + jitter ممکن است برای retryهای مکرر انباشته شود
- **شدت:** متوسط
- **محل:** `src/sw.ts`
- **شرح:** backoff محاسبه می‌شود اما اگر آیتمی بارها با خطا مواجه شود، backoff به مقادیر بسیار بزرگ (روزها) می‌رسد و آیتم هرگز پردازش نمی‌شود.
- **نحوه رفع:** سقف (cap) برای backoff:

```typescript
function calculateBackoff(retries: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 3600000; // 1 hour cap
  const exponential = baseDelay * Math.pow(2, retries);
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, maxDelay);
}
```

### BUG-SW-03: `registerSW` در SSR (Node.js) guard دارد اما ممکن است import شود
- **شدت:** کم
- **محل:** `src/index.ts`
- **شرح:** `registerSW` در زمان import، بررسی می‌کند که آیا در محیط مرورگر است. اما اگر ماژول در SSR imported شود، برخی ماژول‌های وابسته (مانند `navigator`) ممکن است خطا دهند.
- **نحوه رفع:** dynamic import:

```typescript
export async function registerSW(swUrl: string, options?: SWOptions): Promise<SWController | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }
  // dynamic import برای lazy loading
  const { SWController } = await import('./sw-controller');
  // ...
}
```

### BUG-SW-04: Cache cleanup در `activate` event ممکن است با version mismatch اشتباه کند
- **شدت:** کم
- **محل:** `src/sw.ts`
- **شرح:** در رویداد `activate`، کش‌های قدیمی حذف می‌شوند. اما اگر نسخه‌بندی دقیق نباشد، ممکن است کش‌های نسخه قبلی SW حذف نشوند.
- **نحوه رفع:** استفاده از version prefix در نام cache:

```typescript
const CACHE_VERSION = 1;
const CACHE_PREFIX = 'zenith-v' + CACHE_VERSION;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key)),
      );
    }),
  );
});
```

---

## ۴. پیشنهادات ارتقا

### IMP-SW-01: افزودن stale-while-revalidate cache strategy
- **دلیل:** ترکیبی از سرعت cacheFirst و freshness networkFirst.

### IMP-SW-02: افزودن offline page fallback
- **دلیل:** نمایش صفحه‌ی «آفلاین» به جای صفحه خطا.

```typescript
// در SW fetch handler
if (!navigator.onLine && event.request.mode === 'navigate') {
  event.respondWith(caches.match('/offline.html'));
  return;
}
```

### IMP-SW-03: Periodic background sync
- **دلیل:** همگام‌سازی خودکار در بازه‌های زمانی مشخص.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime** | SW از طریق `Zen.use(zenithSWPlugin)` نصب می‌شود. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `service-worker` پیاده‌سازی کامل و قابل اعتمادی از Service Worker با پشتیبانی از IndexedDB queue و استراتژی‌های کش است. مشکلات آن عمدتاً مربوط به edge cases مانند backoff بدون سقف و race condition در پردازش queue است.

**امتیاز کلی: ۷.۵/۱۰** (کامل و قابل اعتماد، نیاز به بهبود backoff cap)
