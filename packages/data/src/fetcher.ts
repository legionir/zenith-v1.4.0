// packages/data/src/fetcher.ts
//
// پردازشگر zen-fetch — فاز ۸.
//
// این دایرکتیو URL را می‌گیرد، یک Signal محلی برای مدیریت وضعیت
// (Loading/Error/Success) می‌سازد، درخواست API را ارسال می‌کند، و آن Signal
// را به Context محلی اضافه می‌کند تا در Expressionها قابل دسترسی باشد.
//
// ── سینتکس ──
//   <div zen-fetch="`/api/products/${$route.params.id}`" zen-state="product">
//     <div zen-if="$product.loading">Loading...</div>
//     <div zen-if="$product.error">Error: <span zen-text="$product.error"></span></div>
//     <div zen-if="!$product.loading && !$product.error">
//       <h2 zen-text="$product.data.name"></h2>
//     </div>
//   </div>
//
// ── ویژگی‌های اضافی (v1.3.0+) ──
//   zen-fetch-method | متد HTTP (GET, POST, PUT, DELETE). پیش‌فرض: GET
//   zen-fetch-body   | بدنه درخواست (برای POST/PUT).
//   zen-fetch-params | Expression شی پارامترهای query string.
//   zen-fetch-cache  | TTL کش به میلی‌ثانیه. پیش‌فرض: 0 (بدون کش)
//
// ── نکات طراحی ──
//
// 1) Reactive URL:
//    اگر URL به یک Signal وابسته باشد (مثلا `$route.params.id`)، وقتی آن
//    Signal تغییر کند، fetch باید دوباره انجام شود. ما این کار را با یک
//    Effect انجام می‌دهیم که URL را watch می‌کند.
//
// 2) State Shape:
//    Signal محلی شامل سه فیلد است:
//      { loading: boolean, error: string | null, data: any | null }
//
// 3) Race Condition:
//    اگر URL سریع تغییر کند، چند fetch همزمان ممکن است رخ دهد. ما با یک
//    flag `currentFetchId` فقط نتیجه‌ی آخرین fetch را اعمال می‌کنیم.
//
// 4) Memory Leak Prevention:
//    Effect که URL را watch می‌کند باید در dispose کامپوننت/والد dispose شود.
//    ما dispose را در آرایه parentDisposes قرار می‌دهیم.
//    همچنین AbortController پس از اتمام هر fetch پاک می‌شود (BUG-DAT-01).

import { signal, effect, type Signal } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';

/**
 * شکل وضعیت fetch.
 *
 * @property loading آیا درخواست در حال انجام است؟
 * @property error   پیام خطا در صورت شکست، یا `null`.
 * @property data    داده‌های دریافت‌شده در صورت موفقیت، یا `null`.
 */
export interface FetchState<T = any> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

/**
 * مقدار اولیه‌ی وضعیت fetch.
 */
function initialFetchState(): FetchState {
  return { loading: true, error: null, data: null };
}

// ═══════════════════════════════════════════════════════════════════════
// Cache Layer (IMP-DAT-02: SWR-like caching)
// ═══════════════════════════════════════════════════════════════════════

interface CacheEntry {
  data: any;
  timestamp: number;
}

const _fetchCache = new Map<string, CacheEntry>();

/** حداکثر تعداد entries در کش (eviction policy ساده). */
const _CACHE_MAX_SIZE = 100;

/**
 * دریافت داده از کش در صورت معتبر بودن (داخل TTL).
 *
 * @param url کلید کش (معمولاً URL کامل).
 * @param ttl  زمان اعتبار به میلی‌ثانیه.
 * @returns داده‌ی کش‌شده یا `null`.
 */
export function getCachedData(url: string, ttl: number): any | null {
  const entry = _fetchCache.get(url);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

/**
 * ذخیره‌سازی داده در کش.
 * اگر کش از حداکثر ظرفیت بیشتر شود، قدیمی‌ترین entry حذف می‌شود.
 *
 * @param url  کلید کش.
 * @param data داده‌ای که کش می‌شود.
 */
export function setCachedData(url: string, data: any): void {
  if (_fetchCache.size >= _CACHE_MAX_SIZE) {
    const firstKey = _fetchCache.keys().next().value;
    if (firstKey !== undefined) _fetchCache.delete(firstKey);
  }
  _fetchCache.set(url, { data, timestamp: Date.now() });
}

/**
 * پاک کردن کامل کش.
 */
export function clearFetchCache(): void {
  _fetchCache.clear();
}

/**
 * تابع کمکی برای fetch با کش (مشابه SWR).
 *
 * اگر در TTL داده موجود باشد، بلافاصله Promise.resolve برمی‌گرداند و هم‌زمان
 * یک درخواست مجدد در پس‌زمینه انجام می‌دهد (stale-while-revalidate).
 *
 * @param url URL درخواست.
 * @param ttl زمان اعتبار کش به میلی‌ثانیه (پیش‌فرض: ۳۰ ثانیه).
 * @returns Promise داده.
 */
export function processFetchWithCache(url: string, ttl: number = 30000): Promise<any> {
  const cached = getCachedData(url, ttl);
  if (cached !== null) {
    // بازگشت فوری داده + به‌روزرسانی در پس‌زمینه
    fetch(url)
      .then(res => res.json())
      .then(data => setCachedData(url, data))
      .catch(() => { /* سکوت — داده قدیمی هنوز موجود است */ });
    return Promise.resolve(cached);
  }
  return fetch(url).then(async (res) => {
    const data = await res.json();
    setCachedData(url, data);
    return data;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// URL validation (BUG-DAT-04)
// ═══════════════════════════════════════════════════════════════════════

/**
 * اعتبارسنجی اینکه یک رشته URL معتبر است یا خیر.
 *
 * از `new URL()` برای اعتبارسنجی استفاده می‌کند و origin پیش‌فرض را
 * به `window.location.origin` تنظیم می‌کند تا URLهای نسبی هم قبول شوند.
 *
 * @param urlStr رشته URL برای اعتبارسنجی.
 * @returns `true` اگر URL معتبر است.
 */
function isValidUrl(urlStr: string): boolean {
  if (typeof urlStr !== 'string' || urlStr.length === 0) return false;
  try {
    new URL(urlStr, window.location.origin);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Context builder
// ═══════════════════════════════════════════════════════════════════════

/**
 * ساخت Context محلی برای zen-fetch.
 *
 * این Context:
 *   - تمام کلیدهای Context والد را به ارث می‌برد (با prototype chain).
 *   - یک کلید جدید اضافه می‌کند: `$<stateName>` که به fetchStateSignal اشاره می‌کند.
 *
 * نکته: getter استفاده می‌کنیم تا dependency tracking فعال شود.
 */
function buildFetchContext(
  parentContext: Record<string, any>,
  stateName: string,
  fetchStateSignal: Signal<FetchState>,
): Record<string, any> {
  const child: Record<string, any> = Object.create(parentContext);

  Object.defineProperty(child, `$${stateName}`, {
    get: () => fetchStateSignal.get(),
    enumerable: true,
    configurable: true,
  });

  return child;
}

// ═══════════════════════════════════════════════════════════════════════
// Perform fetch
// ═══════════════════════════════════════════════════════════════════════

/**
 * انجام fetch و آپدیت fetchStateSignal.
 *
 * این تابع async است و نتیجه‌ی fetch را در Signal قرار می‌دهد.
 *
 * از AbortController برای لغو fetch در صورت شروع fetch جدید یا dispose استفاده
 * می‌کند. این کار از هدررفت bandwidth جلوگیری می‌کند.
 *
 * BUG-DAT-01: AbortController پس از اتمام (موفقیت یا خطا) پاک می‌شود.
 * BUG-DAT-02: HTTP 429 با Retry-After مدیریت می‌شود (حداکثر ۳ بار تلاش).
 * BUG-DAT-03: متد و بدنه درخواست قابل تنظیم است.
 *
 * @param url             URL درخواست.
 * @param signal          Signal وضعیت fetch.
 * @param fetchId         ID این fetch (برای race condition check).
 * @param getCurrentFetchId  ID آخرین fetch (برای مقایسه).
 * @param abortController AbortController برای لغو این fetch.
 * @param method          متد HTTP (GET, POST, PUT, DELETE). پیش‌فرض: GET.
 * @param body            بدنه درخواست (برای POST/PUT).
 * @param retryCount      تعداد تلاش مجدد (برای 429).
 * @returns Promise<void>.
 */
async function performFetch(
  url: string,
  signal: Signal<FetchState>,
  fetchId: number,
  getCurrentFetchId: () => number,
  abortController: AbortController,
  method: string = 'GET',
  body: string | null = null,
  retryCount: number = 0,
): Promise<void> {
  const MAX_RETRIES = 3;

  // فقط اگر این fetch هنوز آخرین fetch است.
  if (fetchId !== getCurrentFetchId()) return;
  signal.set({ loading: true, error: null, data: null });

  try {
    // BUG-DAT-03: پشتیبانی از متد و بدنه سفارشی
    const init: RequestInit = { signal: abortController.signal };
    if (method !== 'GET') {
      init.method = method;
      if (body !== null) {
        init.body = body;
      }
    }

    const res = await fetch(url, init);

    // BUG-DAT-02: مدیریت HTTP 429 (Too Many Requests)
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = res.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      console.warn(
        `[Zenith] Rate limited. Retrying after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      );
      abortController.abort(); // BUG-DAT-01: پاکسازی controller قدیمی
      await new Promise((resolve) => setTimeout(resolve, delay));
      // اگر در حین تأخیر، fetch دیگری شروع شده، تلاش مجدد را لغو کن.
      if (fetchId !== getCurrentFetchId()) return;
      return performFetch(url, signal, fetchId, getCurrentFetchId, new AbortController(), method, body, retryCount + 1);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // تلاش برای parse کردن JSON. اگر نشد، text برمی‌گردانیم.
    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    // اگر در حین fetch، fetch دیگری شروع شده بود، این نتیجه را دور بریز.
    if (fetchId !== getCurrentFetchId()) return;

    signal.set({ loading: false, error: null, data });
  } catch (err) {
    // اگر fetch abort شده (توسط fetch جدید یا dispose)، خطا را نمایش نده.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return; // Silent abort — این رفتار عمدی است.
    }

    // اگر در حین fetch، fetch دیگری شروع شده بود، این نتیجه را دور بریز.
    if (fetchId !== getCurrentFetchId()) return;

    // BUG-DAT-01: پاکسازی AbortController در صورت خطا (جلوگیری از انباشت)
    abortController.abort();

    const message = err instanceof Error ? err.message : String(err);
    signal.set({ loading: false, error: message, data: null });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Process fetch directive (point d'entrée)
// ═══════════════════════════════════════════════════════════════════════

/**
 * پردازش دایرکتیو zen-fetch.
 *
 * این تابع نقطه‌ی ورود اصلی سیستم Data Fetching است. توسط walker فراخوانی
 * می‌شود وقتی به عنصری با attribute `zen-fetch` می‌رسد.
 *
 * مراحل:
 *   1) نام state را از `zen-state` (یا پیش‌فرض "data") می‌گیرد.
 *   2) یک Signal محلی برای fetch state می‌سازد.
 *   3) Context محلی می‌سازد که `$<stateName>` به آن Signal اشاره می‌کند.
 *   4) فرزندان را با Context محلی process می‌کند.
 *   5) یک Effect ایجاد می‌کند که URL را watch می‌کند و fetch را انجام می‌دهد.
 *
 * @param el              عنصری که zen-fetch روی آن است.
 * @param expr            Expression URL (مثلا `"/api/users"` یا `"/api/products/${$route.params.id}"`).
 * @param context         Context والد.
 * @param processChildren callback برای walk فرزندان.
 *                        امضا: (node, context, disposes) => void
 * @param disposes        آرایه‌ی dispose functions والد.
 */
export function processFetch(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
  processChildren: (
    node: HTMLElement,
    context: Record<string, any>,
    disposes: (() => void)[],
  ) => void,
  disposes: (() => void)[],
): void {
  // ── ۱. گرفتن attributeها ──
  // HTML attribute names case-insensitive هستند و DOM آن‌ها را lowercase می‌کند.
  const stateName = el.getAttribute('zen-state') || 'data';

  // BUG-DAT-03: متد HTTP (GET, POST, PUT, DELETE)
  const method = (el.getAttribute('zen-fetch-method')?.toUpperCase() as RequestInit['method']) ?? 'GET';
  // BUG-DAT-03: بدنه درخواست (برای POST/PUT)
  const body = el.getAttribute('zen-fetch-body') ?? null;

  // IMP-DAT-02: TTL کش (0 = بدون کش)
  const cacheTtlAttr = el.getAttribute('zen-fetch-cache');
  const cacheTtl = cacheTtlAttr ? parseInt(cacheTtlAttr, 10) : 0;

  // IMP-DAT-01: کامپایل expression پارامترهای query string
  const paramsExpr = el.getAttribute('zen-fetch-params');
  const paramsEvalFn = paramsExpr ? compileExpression(paramsExpr) : null;

  // ── ۲. ساخت Signal محلی ──
  const fetchStateSignal = signal<FetchState>(initialFetchState());

  // ── ۳. ساخت Context محلی ──
  const localContext = buildFetchContext(context, stateName, fetchStateSignal);

  // ── ۴. Process فرزندان با Context محلی ──
  // نکته: فرزندان باید قبل از Effect پردازش شوند تا Effectهای آن‌ها (مثل
  // zen-if که به $product.loading وابسته است) ایجاد شوند و بتوانند به
  // fetchStateSignal subscribe کنند.
  const childDisposes: (() => void)[] = [];
  for (const child of Array.from(el.children)) {
    processChildren(child as HTMLElement, localContext, childDisposes);
  }

  // ── ۵. Effect: watch URL و fetch ──
  // این Effect هر بار که URL (و وابستگی‌هایش) تغییر می‌کند، اجرا می‌شود.
  // نکته: fetch به‌صورت async انجام می‌شود اما Effect خودش synchronous است.
  let currentFetchId = 0;
  // AbortController فعلی. در هر fetch جدید، قبلی abort می‌شود.
  let currentAbortController: AbortController | null = null;

  // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);

  const disposeEffect = effect(() => {
    // ارزیابی URL در parentContext (نه localContext).
    // چرا parentContext؟ چون URL ممکن است به `$route` وابسته باشد که در
    // parentContext موجود است. اگر در localContext ارزیابی کنیم، ممکن است
    // به `$product` (که خودمان ساختیم) دسترسی پیدا کند که منطقی نیست.
    let url: string;
    try {
      url = evalFn(context);
    } catch (err) {
      console.error(
        `[Zenith Fetch] Failed to evaluate URL expression "${expr}":`,
        err,
      );
      fetchStateSignal.set({
        loading: false,
        error: `Invalid URL expression: ${(err as Error).message}`,
        data: null,
      });
      return;
    }

    // BUG-DAT-04: اعتبارسنجی نوع — باید string باشد
    if (typeof url !== 'string') {
      console.error(`[Zenith Fetch] URL expression must evaluate to string. Got: ${typeof url}`);
      fetchStateSignal.set({
        loading: false,
        error: `URL must be a string, got ${typeof url}`,
        data: null,
      });
      return;
    }

    // BUG-DAT-04: اعتبارسنجی فرمت — باید URL معتبر باشد
    if (!isValidUrl(url)) {
      console.error(`[Zenith Fetch] Malformed URL:`, url);
      fetchStateSignal.set({
        loading: false,
        error: `Malformed URL: ${url}`,
        data: null,
      });
      return;
    }

    // IMP-DAT-01: افزودن پارامترهای query string پویا
    let finalUrl = url;
    if (paramsEvalFn) {
      try {
        const params = paramsEvalFn(context);
        if (params && typeof params === 'object' && !Array.isArray(params)) {
          const query = new URLSearchParams();
          for (const [key, value] of Object.entries(params)) {
            query.append(key, String(value));
          }
          const qs = query.toString();
          if (qs) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
          }
        }
      } catch (err) {
        // پارامترهای نامعتبر — با warn ادامه بده بدون پارامتر
        console.warn(`[Zenith Fetch] Failed to evaluate params expression:`, err);
      }
    }

    // IMP-DAT-02: بررسی کش — اگر داده معتبر در کش هست، skip fetch
    if (cacheTtl > 0) {
      const cached = getCachedData(finalUrl, cacheTtl);
      if (cached !== null) {
        fetchStateSignal.set({ loading: false, error: null, data: cached });
        return; // از fetch صرف‌نظر کن
      }
    }

    // ── لغو fetch قبلی با AbortController ──
    // این کار از هدررفت bandwidth جلوگیری می‌کند: اگر URL سریع تغییر کند،
    // fetch قدیمی به‌جای کامل شدن در پس‌زمینه، لغو می‌شود.
    if (currentAbortController) {
      currentAbortController.abort();
    }

    // شروع fetch جدید. ID و AbortController جدید ذخیره می‌کنیم.
    const fetchId = ++currentFetchId;
    const abortController = new AbortController();
    currentAbortController = abortController;

    performFetch(finalUrl, fetchStateSignal, fetchId, () => currentFetchId, abortController, method, body);
  });

  // ── ۶. ثبت dispose ──
  // این dispose:
  //   1) fetch در حال انجام را abort می‌کند (صرفه‌جویی bandwidth).
  //   2) Effect را dispose می‌کند (جلوگیری از fetch بعد از unmount).
  //   3) تمام effectهای فرزندان را dispose می‌کند.
  disposes.push(() => {
    currentFetchId++;  // جلوگیری از اعمال نتیجه‌ی fetch در حال انجام.
    // abort fetch در حال انجام.
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    disposeEffect();
    for (const d of childDisposes) {
      try {
        d();
      } catch (err) {
        console.error('[Zenith Fetch] Error during child dispose:', err);
      }
    }
    childDisposes.length = 0;
  });
}
