# گزارش حسابرسی پکیج `router`
**نسخه:** v1.3.0 | **بسته:** `@zenith/router`

---

## ۱. خلاصه پکیج

پکیج `router` سیستم مسیریابی (Routing) فریم‌ورک Zenith را پیاده‌سازی می‌کند. شامل مسیریابی با پشتیبانی از `:param` و `**` wildcard، `routeSignal` با AsyncLocalStorage برای ایزولاسیون هم‌روندی در SSR، کش مسیر (max 50 با LRU)، موتور prefetch، و مدیریت ناوبری با popstate listener است.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/router.ts` | ~۲۵۰ | `routeSignal`, `matchRoute` با پارامتر و wildcard, `navigate`, `cleanupRouter` |
| `src/outlet.ts` | ~۱۸۰ | `processRouter` – خروجی مسیر، prefetch engine با zen-link، AbortController |
| `src/index.ts` | ~۱۵ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-RTR-01: `matchRoute` برای پارامترهای خالی مسیر اشتباه عمل می‌کند
- **شدت:** بالا
- **محل:** `src/router.ts` – تابع `matchRoute`
- **شرح:** اگر URL مسیری مانند `/users//profile` داشته باشد (slash خالی)، `matchRoute` ممکن است پارامتر خالی `:param` ایجاد کند یا مسیر را اشتباه match کند.
- **نحوه رفع:** فیلتر کردن segments خالی قبل از matching:

```typescript
export function matchRoute(
  routes: RouteDefinition[],
  url: string,
): MatchedRoute | null {
  const segments = url.split('/').filter(Boolean); // حذف segments خالی
  // ... ادامه matching با segments تصفیه‌شده
}
```

### BUG-RTR-02: `navigate` با hash-only navigation باعث صفحه‌آوری کامل می‌شود
- **شدت:** متوسط
- **محل:** `src/router.ts` – متد `navigate`
- **شرح:** در کد فعلی بررسی می‌شود که آیا URL فقط hash تغییر کرده (`if (url === currentUrl) return false`). اما اگر فقط hash تغییر کند و مسیر یکسان باشد، ناوبری نباید رندر کامل انجام دهد. این شرط درستی دارد اما ممکن است edge cases (مانند # با محتوای خالی) را مدیریت نکند.
- **نحوه رفع:** افزودن بررسی صریح‌تر:

```typescript
export function navigate(url: string): Promise<void> {
  const [pathOnly] = url.split('#');
  const [currentPath] = currentUrl.split('#');

  if (pathOnly === currentPath) {
    // فقط hash تغییر کرده، اسکرول به anchor
    const hash = url.includes('#') ? url.split('#')[1] : '';
    if (hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }
    return Promise.resolve();
  }
  // ادامه ناوبری کامل
}
```

### BUG-RTR-03: `cleanupRouter` تمام listenerها را حذف نمی‌کند
- **شدت:** متوسط
- **محل:** `src/router.ts` – `cleanupRouter`
- **شرح:** `cleanupRouter` listener `popstate` را حذف می‌کند اما ممکن است listenerهای دیگر (مانند `click` روی zen-linkها) را پاک نکند.
- **نحوه رفع:**

```typescript
export function cleanupRouter(): void {
  window.removeEventListener('popstate', _popstateHandler);
  if (_linkClickHandler) {
    document.removeEventListener('click', _linkClickHandler);
  }
  _routeCache.clear();
  _prefetchController?.abort();
  // پاکسازی routeSignal
  if (typeof _cleanupRouteSignal === 'function') {
    _cleanupRouteSignal();
  }
}
```

### BUG-RTR-04: route cache LRU eviction ممکن است مسیرهای پراستفاده را حذف کند
- **شدت:** کم
- **محل:** `src/outlet.ts` – route cache (max 50)
- **شرح:** الگوریتم LRU در cache (حداکثر ۵۰ آیتم) از `Map` استفاده می‌کند که ترتیب insertion را حفظ می‌کند. اما اگر در یک بازه‌ی کوتاه ۵۱ مسیر مختلف بازدید شود، اولین مسیر حذف می‌شود حتی اگر بعداً دوباره نیاز شود.
- **نحوه رفع:** استفاده از `Map` با دستکاری ترتیب (LRU real):

```typescript
class LRUCache<K, V> {
  private _map = new Map<K, V>();
  constructor(private _maxSize: number) {}

  get(key: K): V | undefined {
    if (!this._map.has(key)) return undefined;
    const value = this._map.get(key)!;
    this._map.delete(key);
    this._map.set(key, value); // قرار دادن در انتها
    return value;
  }

  set(key: K, value: V): void {
    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, value);
    if (this._map.size > this._maxSize) {
      const firstKey = this._map.keys().next().value;
      if (firstKey !== undefined) this._map.delete(firstKey);
    }
  }
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-RTR-01: افزودن `beforeEach` / `afterEach` navigation guards
- **دلیل:** احراز هویت، redirect، analytics.
- **پیاده‌سازی:**

```typescript
type NavigationGuard = (to: string, from: string) => boolean | string | Promise<boolean | string>;

const _guards: NavigationGuard[] = [];

export function beforeEach(guard: NavigationGuard): void {
  _guards.push(guard);
}

export async function navigate(url: string): Promise<void> {
  for (const guard of _guards) {
    const result = await guard(url, currentUrl);
    if (result === false) return; // توقف ناوبری
    if (typeof result === 'string') return navigate(result); // redirect
  }
  // ادامه ناوبری
}
```

### IMP-RTR-02: افزودن `replace: true` گزینه در navigate
- **دلیل:** پشتیبانی از `history.replaceState`.
- **پیاده‌سازی:**

```typescript
export function navigate(url: string, options?: { replace?: boolean }): Promise<void> {
  if (options?.replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
  // ... به‌روزرسانی routeSignal
}
```

### IMP-RTR-03: افزودن route transition hooks
- **دلیل:** انیمیشن بین مسیرها با پکیج transition.
- **پیاده‌سازی:**

```typescript
export function processRouterOutlet(outlet: HTMLElement, route: MatchedRoute): void {
  const currentContent = outlet.firstElementChild;
  if (currentContent && route.transition) {
    // اعمال leave transition روی محتوای فعلی
    await leaveTransition(currentContent as HTMLElement, route.transition);
  }
  // رندر مسیر جدید
  // اعمال enter transition روی محتوای جدید
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime** | `Zen.navigate()` و `Zen.route()` به router متصل هستند. | ✅ درست |
| **runtime/walker** | `processRouter` در مرحله‌ی ۷ Walker پردازش می‌شود. | ✅ درست |
| **runtime/context** | `$route` از طریق `setRouteSignalProvider` در context تزریق می‌شود. | ✅ درست |
| **ssr** | AsyncLocalStorage برای ایزولاسیون route در SSR. | ✅ درست |
| **transition** | ترنزیشن بین مسیرها (در صورت تکمیل). | ⚠️ نیاز به هماهنگی بیشتر |
| **suspense** | بارگذاری lazy routeها با Suspense. | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `router` طراحی خوب و کاملی دارد. پشتیبانی از `:param` و `**` wildcard، کش route، prefetch engine، و ایزولاسیون SSR از نقاط قوت آن هستند. مهم‌ترین کمبودها: navigation guards (beforeEach) و گزینه‌ی history.replaceState.

**امتیاز کلی: ۸/۱۰** (کامل و قابل استفاده، کمبود navigation guards)
