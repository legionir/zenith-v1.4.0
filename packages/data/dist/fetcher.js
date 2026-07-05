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
import { signal, effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
/**
 * مقدار اولیه‌ی وضعیت fetch.
 */
function initialFetchState() {
    return { loading: true, error: null, data: null };
}
/**
 * ساخت Context محلی برای zen-fetch.
 *
 * این Context:
 *   - تمام کلیدهای Context والد را به ارث می‌برد (با prototype chain).
 *   - یک کلید جدید اضافه می‌کند: `$<stateName>` که به fetchStateSignal اشاره می‌کند.
 *
 * نکته: getter استفاده می‌کنیم تا dependency tracking فعال شود.
 */
function buildFetchContext(parentContext, stateName, fetchStateSignal) {
    const child = Object.create(parentContext);
    Object.defineProperty(child, `$${stateName}`, {
        get: () => fetchStateSignal.get(),
        enumerable: true,
        configurable: true,
    });
    return child;
}
/**
 * انجام fetch و آپدیت fetchStateSignal.
 *
 * این تابع async است و نتیجه‌ی fetch را در Signal قرار می‌دهد.
 *
 * از AbortController برای لغو fetch در صورت شروع fetch جدید یا dispose استفاده
 * می‌کند. این کار از هدررفت bandwidth جلوگیری می‌کند.
 *
 * @param url             URL درخواست.
 * @param signal          Signal وضعیت fetch.
 * @param fetchId         ID این fetch (برای race condition check).
 * @param getCurrentFetchId  ID آخرین fetch (برای مقایسه).
 * @param getAbortController  تابعی که AbortController فعلی را برمی‌گرداند (برای abort).
 * @returns Promise<void>.
 */
async function performFetch(url, signal, fetchId, getCurrentFetchId, abortController) {
    // آپدیت state به loading.
    // فقط اگر این fetch هنوز آخرین fetch است.
    if (fetchId !== getCurrentFetchId())
        return;
    signal.set({ loading: true, error: null, data: null });
    try {
        // استفاده از AbortController برای لغو fetch در صورت نیاز.
        const res = await fetch(url, { signal: abortController.signal });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        // تلاش برای parse کردن JSON. اگر نشد، text برمی‌گردانیم.
        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await res.json();
        }
        else {
            data = await res.text();
        }
        // اگر در حین fetch، fetch دیگری شروع شده بود، این نتیجه را دور بریز.
        if (fetchId !== getCurrentFetchId())
            return;
        signal.set({ loading: false, error: null, data });
    }
    catch (err) {
        // اگر fetch abort شده (توسط fetch جدید یا dispose)، خطا را نمایش نده.
        if (err instanceof DOMException && err.name === 'AbortError') {
            return; // Silent abort — این رفتار عمدی است.
        }
        // اگر در حین fetch، fetch دیگری شروع شده بود، این نتیجه را دور بریز.
        if (fetchId !== getCurrentFetchId())
            return;
        const message = err instanceof Error ? err.message : String(err);
        signal.set({ loading: false, error: message, data: null });
    }
}
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
export function processFetch(el, expr, context, processChildren, disposes) {
    // ── ۱. گرفتن نام state ──
    // HTML attribute names case-insensitive هستند و DOM آن‌ها را lowercase می‌کند.
    // پس `zen-state="product"` در Context به `$product` تبدیل می‌شود.
    const stateName = el.getAttribute('zen-state') || 'data';
    // ── ۲. ساخت Signal محلی ──
    const fetchStateSignal = signal(initialFetchState());
    // ── ۳. ساخت Context محلی ──
    const localContext = buildFetchContext(context, stateName, fetchStateSignal);
    // ── ۴. Process فرزندان با Context محلی ──
    // نکته: فرزندان باید قبل از Effect پردازش شوند تا Effectهای آن‌ها (مثل
    // zen-if که به $product.loading وابسته است) ایجاد شوند و بتوانند به
    // fetchStateSignal subscribe کنند.
    const childDisposes = [];
    for (const child of Array.from(el.children)) {
        processChildren(child, localContext, childDisposes);
    }
    // ── ۵. Effect: watch URL و fetch ──
    // این Effect هر بار که URL (و وابستگی‌هایش) تغییر می‌کند، اجرا می‌شود.
    // نکته: fetch به‌صورت async انجام می‌شود اما Effect خودش synchronous است.
    let currentFetchId = 0;
    // AbortController فعلی. در هر fetch جدید، قبلی abort می‌شود.
    let currentAbortController = null;
    // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
    const evalFn = compileExpression(expr);
    const disposeEffect = effect(() => {
        // ارزیابی URL در parentContext (نه localContext).
        let url;
        try {
            url = evalFn(context);
        }
        catch (err) {
            console.error(`[Zenith Fetch] Failed to evaluate URL expression "${expr}":`, err);
            fetchStateSignal.set({
                loading: false,
                error: `Invalid URL expression: ${err.message}`,
                data: null,
            });
            return;
        }
        if (typeof url !== 'string') {
            console.error(`[Zenith Fetch] URL expression must evaluate to string. Got: ${typeof url}`);
            fetchStateSignal.set({
                loading: false,
                error: `URL must be a string, got ${typeof url}`,
                data: null,
            });
            return;
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
        performFetch(url, fetchStateSignal, fetchId, () => currentFetchId, abortController);
    });
    // ── ۶. ثبت dispose ──
    // این dispose:
    //   1) fetch در حال انجام را abort می‌کند (صرفه‌جویی bandwidth).
    //   2) Effect را dispose می‌کند (جلوگیری از fetch بعد از unmount).
    //   3) تمام effectهای فرزندان را dispose می‌کند.
    disposes.push(() => {
        currentFetchId++; // جلوگیری از اعمال نتیجه‌ی fetch در حال انجام.
        // abort fetch در حال انجام.
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
        disposeEffect();
        for (const d of childDisposes) {
            try {
                d();
            }
            catch (err) {
                console.error('[Zenith Fetch] Error during child dispose:', err);
            }
        }
        childDisposes.length = 0;
    });
}
//# sourceMappingURL=fetcher.js.map