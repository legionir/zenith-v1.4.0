# گزارش حسابرسی پکیج `resource`
**نسخه:** v1.3.0 | **بسته:** `@zenith/resource`

---

## ۱. خلاصه پکیج

پکیج `resource` یک سیستم مدیریت داده Reactive مبتنی بر Signal است که شبیه SWR/React Query کار می‌کند. کلاس `Resource` وضعیت داده (data/loading/error) را با Signal مدیریت می‌کند و از CRUD کامل، کش با staleTime، retry policy با exponential backoff (فقط GET)، به‌روزرسانی‌های optimistic، صف mutation، و auto-refresh پشتیبانی می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/resource.ts` | ~۴۵۰+ | کلاس `Resource` – مدیریت کامل داده‌های async |

---

## ۳. باگ‌ها و مشکلات

### BUG-RES-01: `cacheKey` شامل body (v1.2.3) ممکن است collision ایجاد کند
- **شدت:** بالا
- **محل:** `src/resource.ts` – v1.2.3 fix
- **شرح:** برای deduplication درخواست‌ها، `cacheKey` شامل body هم می‌شود. اما bodyهای JSON با ترتیب کلید متفاوت، hash متفاوتی دارند در حالی که از نظر معنایی یکسان هستند.
- **نحوه رفع:** استفاده از JSON canonical:

```typescript
function createCacheKey(url: string, method: string, body?: any): string {
  const normalizedBody = body ? JSON.stringify(canonicalize(body)) : '';
  return `${method}:${url}:${normalizedBody}`;
}

function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  return Object.keys(obj).sort().reduce((acc: any, key: string) => {
    acc[key] = canonicalize(obj[key]);
    return acc;
  }, {});
}
```

### BUG-RES-02: Optimistic update rollback در صورت خطای server ممکن است اشتباه باشد
- **شدت:** بالا
- **محل:** `src/resource.ts` – optimistic update
- **شرح:** اگر optimistic update انجام شود و سپس درخواست سرور با خطا مواجه شود، rollback ممکن است state قبلی را به درستی بازگردانی نکند. اگر بین optimistic update و rollback به‌روزرسانی دیگری انجام شده باشد، rollback state صحیح را از بین می‌برد.
- **نحوه رفع:** استفاده از snapshot chain (versioning):

```typescript
class Resource<T> {
  private _optimisticSnapshots: Map<number, T> = new Map();
  private _optimisticVersion = 0;

  async updateOptimistic(data: Partial<T>): Promise<void> {
    const snapshot = deepClone(this._data.get());
    const version = ++this._optimisticVersion;
    this._optimisticSnapshots.set(version, snapshot);

    // اعمال optimistic update
    this._data.update(prev => ({ ...prev, ...data }));

    try {
      await this._doUpdate(data);
      // success: پاکسازی snapshot
      this._optimisticSnapshots.delete(version);
    } catch (err) {
      // rollback به آخرین snapshot
      const snapshot = this._optimisticSnapshots.get(version);
      if (snapshot && version === this._optimisticVersion) {
        this._data.set(snapshot);
      }
      this._optimisticSnapshots.clear();
      throw err;
    }
  }
}
```

### BUG-RES-03: `retry` policy فقط GET را پشتیبانی می‌کند اما خطاهای اتصال برای همه متدها ممکن است
- **شدت:** متوسط
- **محل:** `src/resource.ts`
- **شرح:** retry policy فعلی فقط برای GET فعال است. اما خطاهای شبکه (network error, timeout) برای هر متدی ممکن است رخ دهد.
- **نحوه رفع:** افزودن retry اختیاری برای non-GET:

```typescript
async _fetchWithRetry(url: string, options: RequestInit, retries = 0): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    // فقط خطاهای شبکه (نه HTTP errors)
    if (retries > 0 && this._isNetworkError(err)) {
      const delay = Math.min(1000 * Math.pow(2, 3 - retries), 10000);
      await new Promise(r => setTimeout(r, delay));
      return this._fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}
```

### BUG-RES-04: `destroy()` المان‌های DOM مرتبط را پاک نمی‌کند
- **شدت:** متوسط
- **محل:** `src/resource.ts`
- **شرح:** تابع `destroy()` signalها و تایمر auto-refresh را پاک می‌کند اما المان‌های DOM که به این Resource متصل هستند پاک نمی‌شوند.
- **نحوه رفع:** ثبت callbackهای پاکسازی DOM:

```typescript
class Resource<T> {
  private _domCleanups = new Set<() => void>();

  registerDOMElement(element: HTMLElement): void {
    const cleanup = () => { /* حذف ارجاعات */ };
    this._domCleanups.add(cleanup);
    element.addEventListener('zen:detach', () => {
      cleanup();
      this._domCleanups.delete(cleanup);
    });
  }

  destroy(): void {
    this._domCleanups.forEach(fn => fn());
    this._domCleanups.clear();
    // ... cleanup قبلی
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-RES-01: افزودن Pagination support
- **دلیل:** پشتیبانی از لیست‌های صفحه‌بندی شده.
- **پیاده‌سازی:**

```typescript
interface PaginatedResource<T> extends Resource<T[]> {
  pagination: {
    page: Signal<number>;
    pageSize: Signal<number>;
    total: Signal<number>;
    nextPage(): void;
    prevPage(): void;
    goToPage(n: number): void;
  };
}
```

### IMP-RES-02: افزودن Request cancellation با AbortController
- **دلیل:** جلوگیری از درخواست‌های منسوخ در navigation سریع.
- **پیاده‌سازی:**

```typescript
class Resource<T> {
  private _abortController: AbortController | null = null;

  async fetch(): Promise<void> {
    this._abortController?.abort();
    this._abortController = new AbortController();

    try {
      const res = await fetch(this._url, { signal: this._abortController.signal });
      // ...
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
  }
}
```

### IMP-RES-03: `autoRefresh` با configurable interval و backoff
- **دلیل:** انعطاف در auto-refresh.
- **پیاده‌سازی:** پشتیبانی از `minInterval`, `maxInterval`, `backoffFactor`.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **state** | `signal` و `effect` در هسته Resource. | ✅ درست |
| **scheduler** | زمان‌بندی auto-refresh. | ✅ درست |
| **runtime/walker** | `zen-resource` در walker پردازش می‌شود. | ✅ درست |
| **crud** | CRUD actions روی Resource کار می‌کنند. | ✅ درست |
| **data** | پکیج `data` ساده‌تر از Resource است. | ✅ مکمل |

---

## ۶. نتیجه‌گیری کلی

پکیج `resource` یکی از پیشرفته‌ترین پکیج‌های فریم‌ورک است که قابلیت‌های مشابه React Query/SWR را با رویکرد Signal-based ارائه می‌دهد. مشکلات اصلی: optimistic rollback با تداخل سناریوهای هم‌زمان و retry محدود به GET.

**امتیاز کلی: ۷.۵/۱۰** (پیشرفته و مفید، نیاز به بهبود optimistic rollback)
