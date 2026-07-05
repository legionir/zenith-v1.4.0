# گزارش حسابرسی پکیج `data`
**نسخه:** v1.3.0 | **بسته:** `@zenith/data`

---

## ۱. خلاصه پکیج

پکیج `data` سرویس دریافت داده (data fetching) در فریم‌ورک Zenith است. تابع `processFetch` یک رویکرد reactive به fetch ارائه می‌دهد که از `AbortController` برای لغو درخواست‌ها، `fetchId` برای جلوگیری از race condition، کامپایل یکباره‌ی expressionهای URL، و پردازش child-first استفاده می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/fetcher.ts` | ~۲۵۰ | `processFetch` – موتور اصلی دریافت داده reactive |
| `src/index.ts` | ~۱۰ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-DAT-01: عدم پاکسازی کامل AbortController در خطا
- **شدت:** بالا
- **محل:** `src/fetcher.ts` – در مدیریت `processFetch`
- **شرح:** اگر درخواست fetch به خطا بخورد، `AbortController` همیشه به درستی پاک نمی‌شود. در سناریوهای پشت‌سر هم، این می‌تواند باعث انباشت AbortControllerهای بلااستفاده شود.
- **نحوه رفع:**

```typescript
export function processFetch(element: HTMLElement, context: ExpressionContext): void {
  const abortController = new AbortController();
  const fetchId = Symbol('fetch');

  // ذخیره برای cleanup بعدی
  const cleanup = () => {
    abortController.abort();
    element.removeEventListener('zen:detach', cleanup);
  };
  element.addEventListener('zen:detach', cleanup, { once: true });

  try {
    const response = await fetch(url, { signal: abortController.signal });
    // ...
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return; // لغو عمدی
    }
    console.error(`[Zenith] Fetch error:`, err);
    // پاکسازی
    cleanup();
  }
}
```

### BUG-DAT-02: عدم مدیریت rate limiting
- **شدت:** متوسط
- **محل:** `src/fetcher.ts`
- **شرح:** در صورت دریافت HTTP 429 (Too Many Requests)، سیستم تلاش مجدد نمی‌کند و خطا را به سادگی به console می‌دهد. این برای کاربردهای real-world کافی نیست.
- **نحوه رفع:** افزودن Retry-After پشتیبانی:

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
  console.warn(`[Zenith] Rate limited. Retrying after ${delay}ms`);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return processFetch(element, context); // تلاش مجدد
}
```

### BUG-DAT-03: متد درخواست همیشه GET است
- **شدت:** کم
- **محل:** `src/fetcher.ts`
- **شرح:** `processFetch` از متد ثابت `GET` استفاده می‌کند و امکان تنظیم متدهای دیگر (POST, PUT, DELETE) یا ارسال body وجود ندارد. این کاربرد آن را محدود به خواندن داده می‌کند.
- **نحوه رفع:** افزودن attribute `zen-fetch-method` و `zen-fetch-body`:

```typescript
const method = (element.getAttribute('zen-fetch-method')?.toUpperCase() as RequestInit['method']) ?? 'GET';
const body = element.getAttribute('zen-fetch-body') ?? null;

const response = await fetch(url, {
  method,
  body,
  signal: abortController.signal,
});
```

### BUG-DAT-04: عدم اعتبارسنجی ورودی‌های URL expression
- **شدت:** متوسط
- **محل:** `src/fetcher.ts`
- **شرح:** URL expression کامپایل می‌شود اما اگر خروجی expression یک رشته معتبر URL نباشد، خطای fetch مبهمی دریافت می‌شود. بهتر است اعتبارسنجی قبل از fetch انجام شود.
- **نحوه رفع:**

```typescript
const urlStr = compiledUrl(evalContext);
if (typeof urlStr !== 'string' || urlStr.length === 0) {
  console.error(`[Zenith] Invalid URL from expression:`, urlStr);
  return;
}
try {
  new URL(urlStr, window.location.origin);
} catch {
  console.error(`[Zenith] Malformed URL from expression:`, urlStr);
  return;
}
```

---

## ۴. پیشنهادات ارتقا

### IMP-DAT-01: افزودن `zen-fetch-params` برای query parameters پویا
- **دلیل:** ساده‌سازی ارسال پارامترهای پویا به API.
- **پیاده‌سازی:**

```typescript
const paramsAttr = element.getAttribute('zen-fetch-params');
let finalUrl = urlStr;
if (paramsAttr) {
  const params = evalInContext(paramsAttr, evalContext);
  if (params && typeof params === 'object') {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      query.append(key, String(value));
    }
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + query.toString();
  }
}
```

### IMP-DAT-02: افزودن caching layer مشابه SWR
- **دلیل:** کاهش درخواست‌های تکراری و بهبود تجربه کاربری.
- **پیاده‌سازی:** کش کردن پاسخ‌ها با `stale-while-revalidate`:

```typescript
const _fetchCache = new Map<string, { data: any; timestamp: number }>();

export function processFetchWithCache(url: string, ttl: number = 30000): Promise<any> {
  const cached = _fetchCache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return Promise.resolve(cached.data); // response immediate + revalidate in background
  }
  return fetch(url).then(async (res) => {
    const data = await res.json();
    _fetchCache.set(url, { data, timestamp: Date.now() });
    return data;
  });
}
```

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime/walker** | `zen-fetch` در مرحله‌ی ۱۵ پردازش Walker پردازش می‌شود. | ✅ درست |
| **runtime/context** | Expression context برای URL interpolation استفاده می‌شود. | ✅ درست |
| **resource** | پکیج `resource` رویکرد Signal-based کامل‌تری برای مدیریت داده ارائه می‌دهد. | ✅ مکمل |

---

## ۶. نتیجه‌گیری کلی

پکیج `data` یک لایه fetch ساده و کاربردی ارائه می‌دهد اما فاقد بسیاری از قابلیت‌های یک سرویس داده‌ی مدرن (caching, retry, timeout, request cancellation, method variety) است. بیشتر این قابلیت‌ها در پکیج `resource` وجود دارد، اما `data` برای استفاده‌های ساده‌تر طراحی شده است.

**امتیاز کلی: ۶/۱۰** (ساده و کاربردی اما محدود)
