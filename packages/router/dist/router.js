// packages/router/src/router.ts
//
// مغز مسیریاب (Router) — فاز ۸.
//
// این ماژول مسیر فعلی را در یک Signal نگه می‌دارد، پارامترهای URL
// (مثل `:id`) را استخراج می‌کند، و قابلیت ناوبری (`navigate`) را فراهم
// می‌کند — بدون رفرش صفحه.
//
// نکته‌ی مهم: این ماژول فقط در محیط مرورگر کار می‌کند (نیاز به `window`,
// `history`, `location` دارد). در SSR یا تست‌های Node باید mock شود.
//
// ── Bug Fix: SSR Concurrency ──
//
// قبلاً routeSignal یک singleton ماژول-level بود. در SSR concurrent،
// دو درخواست همزمان به route های مختلف باعث می‌شد route صفحه‌ی B روی
// صفحه‌ی A overwrite شود.
//
// راه‌حل: استفاده از AsyncLocalStorage برای isolation per-request.
//   - در مرورگر: routeSignal همان singleton است (تعداد clients = 1).
//   - در SSR: هر درخواست context خود را دارد. routeSignal.get() و
//     routeSignal.set() به context فعلی اشاره می‌کنند.
//
// استفاده در SSR:
//   import { runWithRoute } from '@zenith/router';
//   await runWithRoute('/users/123', async () => {
//     // در این block، routeSignal به /users/123 اشاره می‌کند.
//     // navigate() و setRouteParams() فقط این context را تغییر می‌دهند.
//     const html = await renderToString(...);
//   });
import { signal } from '@zenith/state';
// ── AsyncLocalStorage برای SSR concurrency safety ──
// در Node.js موجود است. در مرورگر undefined است (که مشکلی نیست چون
// مرورگر فقط یک client دارد).
//
// نکته: در ESM نمی‌توانیم از require() استفاده کنیم. پس از
// createRequire(import.meta.url) استفاده می‌کنیم تا sync به
// node:async_hooks دسترسی داشته باشیم.
let routeAsyncLocalStorage = null;
try {
    // بررسی اینکه در Node.js هستیم (نه مرورگر)
    if (typeof globalThis !== 'undefined' && globalThis.process?.versions?.node) {
        // در ESM، از createRequire برای sync require استفاده می‌کنیم
        const { createRequire } = await import('node:module');
        const nodeRequire = createRequire(import.meta.url);
        const { AsyncLocalStorage } = nodeRequire('node:async_hooks');
        routeAsyncLocalStorage = new AsyncLocalStorage();
    }
}
catch {
    // در محیط‌هایی که node:module در دسترس نیست (مرورگر)،
    // fallback به singleton استفاده می‌شود.
}
/**
 * Signal سراسری مسیر فعلی (برای مرورگر).
 *
 * در مرورگر، این singleton است چون فقط یک client وجود دارد.
 * در SSR، از `runWithRoute()` استفاده کنید تا context per-request ایجاد شود.
 * در آن case، `routeSignal.get()` و `routeSignal.set()` به context فعلی اشاره می‌کنند.
 */
const browserRouteSignal = signal({
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
    params: {},
});
/**
 * Proxy Signal که در SSR به context فعلی اشاره می‌کند.
 *
 * این Proxy interface همانند یک Signal واقعی عمل می‌کند:
 *   - get(): اگر در SSR context است، از AsyncLocalStorage می‌خواند.
 *            در غیر این صورت، از browserRouteSignal.
 *   - set(): اگر در SSR context است، در AsyncLocalStorage می‌نویسد.
 *            در غیر این صورت، در browserRouteSignal.
 *
 * این الگو به navigate() و setRouteParams() اجازه می‌دهد بدون تغییر،
 * هم در مرورگر و هم در SSR کار کنند — با isolation کامل در SSR.
 */
export const routeSignal = {
    get() {
        if (routeAsyncLocalStorage) {
            const store = routeAsyncLocalStorage.getStore();
            if (store) {
                return store.signal.get();
            }
        }
        return browserRouteSignal.get();
    },
    set(value) {
        if (routeAsyncLocalStorage) {
            const store = routeAsyncLocalStorage.getStore();
            if (store) {
                store.signal.set(value);
                return;
            }
        }
        browserRouteSignal.set(value);
    },
    // متدهای داخلی Signal (برای dependency tracking)
    addSubscriber(effect) {
        if (routeAsyncLocalStorage) {
            const store = routeAsyncLocalStorage.getStore();
            if (store) {
                store.signal.addSubscriber(effect);
                return;
            }
        }
        browserRouteSignal.addSubscriber(effect);
    },
    removeSubscriber(effect) {
        if (routeAsyncLocalStorage) {
            const store = routeAsyncLocalStorage.getStore();
            if (store) {
                store.signal.removeSubscriber(effect);
                return;
            }
        }
        browserRouteSignal.removeSubscriber(effect);
    },
    get subscriberCount() {
        if (routeAsyncLocalStorage) {
            const store = routeAsyncLocalStorage.getStore();
            if (store) {
                return store.signal.subscriberCount;
            }
        }
        return browserRouteSignal.subscriberCount;
    },
    // Helper برای تست‌ها
    _getUnderlyingSignal() {
        if (routeAsyncLocalStorage) {
            const store = routeAsyncLocalStorage.getStore();
            if (store)
                return store.signal;
        }
        return browserRouteSignal;
    },
};
/**
 * اجرای یک تابع در context یک route مشخص (برای SSR).
 *
 * هر درخواست SSR باید این تابع را با route خود صدا بزند. داخل callback،
 * routeSignal به یک Signal مستقل اشاره می‌کند که فقط در این context قابل
 * دسترسی است. این از race condition بین درخواست‌های concurrent جلوگیری می‌کند.
 *
 * استفاده:
 *   const html = await runWithRoute('/users/123', async () => {
 *     return await renderToString(template, state);
 *   });
 *
 * @param initialPath مسیر اولیه برای این context.
 * @param fn تابع که در context اجرا می‌شود.
 * @returns نتیجه‌ی fn.
 */
export async function runWithRoute(initialPath, fn) {
    if (!routeAsyncLocalStorage) {
        // در مرورگر یا Node بدون AsyncLocalStorage، fallback به browserRouteSignal.
        // این فقط در تست‌های بدون Node environment رخ می‌دهد.
        const oldPath = browserRouteSignal.get().path;
        browserRouteSignal.set({ path: initialPath, params: {} });
        try {
            return await fn();
        }
        finally {
            browserRouteSignal.set({ path: oldPath, params: {} });
        }
    }
    // ساخت یک Signal مستقل برای این context.
    const contextSignal = signal({
        path: initialPath,
        params: {},
    });
    return routeAsyncLocalStorage.run({ signal: contextSignal }, fn);
}
/**
 * نسخه‌ی sync از runWithRoute برای مواردی که callback sync است.
 *
 * استفاده:
 *   const result = runWithRouteSync('/users/123', () => {
 *     // کد sync
 *   });
 */
export function runWithRouteSync(initialPath, fn) {
    if (!routeAsyncLocalStorage) {
        const oldPath = browserRouteSignal.get().path;
        browserRouteSignal.set({ path: initialPath, params: {} });
        try {
            return fn();
        }
        finally {
            browserRouteSignal.set({ path: oldPath, params: {} });
        }
    }
    const contextSignal = signal({
        path: initialPath,
        params: {},
    });
    return routeAsyncLocalStorage.run({ signal: contextSignal }, fn);
}
/**
 * تطبیق یک الگوی مسیر با یک مسیر واقعی.
 *
 * الگو می‌تواند شامل پارامترهای `:name` باشد. مثلا:
 *   matchRoute('/products/:id', '/products/101')  → { id: '101' }
 *   matchRoute('/users/:userId/posts/:postId', '/users/5/posts/12')
 *     → { userId: '5', postId: '12' }
 *   matchRoute('/', '/')  → {}
 *   matchRoute('/', '/about')  → null
 *
 * Wildcard: الگوی `**` با هر مسیری تطبیق می‌شود (برای صفحات 404).
 *   matchRoute('**', '/anything')  → {} (همیشه تطبیق می‌خورد)
 *
 * @param pattern الگوی مسیر (مثل `/products/:id` یا `**`).
 * @param path    مسیر واقعی (مثل `/products/101`).
 * @returns آبجکت پارامترها در صورت تطبیق، یا `null` در صورت عدم تطبیق.
 */
export function matchRoute(pattern, path) {
    // ── Wildcard `**` — با هر مسیری تطبیق می‌خورد ──
    if (pattern === '**') {
        return {};
    }
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    // اگر تعداد بخش‌ها برابر نبود (و الگو wildcard نبود)، تطبیق نمی‌خورد.
    if (patternParts.length !== pathParts.length)
        return null;
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];
        if (patternPart.startsWith(':')) {
            // پارامتر: مقدار را در params ذخیره کن.
            const paramName = patternPart.slice(1);
            params[paramName] = decodeURIComponent(pathPart);
        }
        else if (patternPart !== pathPart) {
            // تطبیق دقیق: اگر برابر نبود، null برگردان.
            return null;
        }
    }
    return params;
}
/**
 * پیدا کردن اولین مسیر منطبق از لیست مسیرها.
 *
 * @param routes   لیست مسیرها (با فیلدهای `path` و `src`).
 * @param path     مسیر فعلی.
 * @returns اولین مسیر منطبق همراه با params، یا `null` اگر هیچ‌کدام منطبق نبود.
 */
export function findMatchingRoute(routes, path) {
    for (const route of routes) {
        const params = matchRoute(route.path, path);
        if (params !== null) {
            return { route, params };
        }
    }
    return null;
}
/**
 * تغییر مسیر بدون رفرش صفحه.
 *
 * این تابع:
 *   1) `history.pushState` را فراخوانی می‌کند تا URL مرورگر عوض شود.
 *   2) `routeSignal` را آپدیت می‌کند تا تمام Effectهای وابسته (مثل
 *      `<zen-router>`) دوباره اجرا شوند.
 *
 * در SSR (داخل runWithRoute)، این تابع فقط context signal را آپدیت می‌کند
 * (history.pushState فراخوانی نمی‌شود چون window وجود ندارد).
 *
 * @param path مسیر جدید (مثل `/products/101`).
 */
export function navigate(path) {
    if (typeof window === 'undefined' || typeof window.history === 'undefined') {
        // در محیط غیر مرورگر (SSR یا تست‌های Node): فقط Signal را آپدیت کن.
        // routeSignal proxy به‌طور خودکار به context فعلی (اگر موجود) می‌رود.
        // FIX (v1.2.3): clean path — search و hash را از path ورودی جدا کن.
        const cleanPath = path.split('?')[0].split('#')[0];
        routeSignal.set({ path: cleanPath, params: {} });
        return;
    }
    // FIX (v1.2.3): مسیر فعلی را با pathname + search + hash مقایسه کن. قبلاً فقط
    // pathname مقایسه می‌شد، در نتیجه navigate به همان صفحه ولی با query متفاوت
    // skip می‌شد.
    const currentFull = window.location.pathname + window.location.search + window.location.hash;
    if (currentFull === path)
        return;
    // FIX (v1.2.7): hash-only navigation should not trigger a full re-render.
    // If pathname+search are unchanged and only the hash differs, we just
    // pushState so the browser can scroll to the anchor — routeSignal is
    // left untouched and <zen-router> does not re-fetch / re-render.
    let targetUrl = null;
    try {
        targetUrl = new URL(path, window.location.href);
    }
    catch {
        targetUrl = null;
    }
    if (targetUrl &&
        targetUrl.pathname === window.location.pathname &&
        targetUrl.search === window.location.search) {
        window.history.pushState({}, '', path);
        return;
    }
    window.history.pushState({}, '', path);
    // FIX (v1.2.3): clean path را در routeSignal ذخیره کن (بدون search/hash).
    const cleanPath = path.split('?')[0].split('#')[0];
    routeSignal.set({ path: cleanPath, params: {} });
}
/**
 * آپدیت params در routeSignal.
 *
 * این تابع توسط `<zen-router>` فراخوانی می‌شود وقتی یک مسیر منطبق پیدا می‌کند.
 * params در Signal ذخیره می‌شود تا در Expressionها با `$route.params.id` قابل
 * دسترسی باشد.
 *
 * @param params پارامترهای استخراج‌شده از مسیر.
 */
export function setRouteParams(params) {
    const current = routeSignal.get();
    routeSignal.set({ ...current, params });
}
// ── Listener برای دکمه‌های Back/Forward مرورگر ──
//
// این listener یک‌بار در module load ثبت می‌شود. وقتی کاربر دکمه‌ی Back یا
// Forward را می‌زند، `popstate` event رخ می‌دهد و ما routeSignal را آپدیت
// می‌کنیم.
//
// نکته: این کد با `typeof window !== 'undefined'` محافظت می‌شود تا در SSR
// یا تست‌های Node بدون jsdom خطا ندهد.
let popstateListenerInstalled = false;
/**
 * Reference به popstate listener (برای remove کردن در cleanup).
 */
let popstateHandler = null;
export function installPopstateListener() {
    if (popstateListenerInstalled)
        return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function')
        return;
    // listener را در یک متغیر ذخیره می‌کنیم تا بتوانیم آن را remove کنیم.
    popstateHandler = () => {
        // FIX (v1.2.3): شامل search و hash هم باش. قبلاً فقط pathname ست می‌شد،
        // در نتیجه Back/Forward به همان صفحه با query متفاوت، routeSignal را
        // آپدیت نمی‌کرد. حالا کل URL را می‌گیریم و سپس clean می‌کنیم.
        const full = window.location.pathname + window.location.search + window.location.hash;
        const cleanPath = full.split('?')[0].split('#')[0];
        routeSignal.set({
            path: cleanPath,
            params: {},
        });
    };
    window.addEventListener('popstate', popstateHandler);
    popstateListenerInstalled = true;
}
// نصب خودکار در module load (در محیط مرورگر).
installPopstateListener();
/**
 * پاکسازی listener های Router (برای تست‌ها و HMR).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export function cleanupRouter() {
    // listener را واقعاً remove می‌کنیم (با همان reference).
    if (popstateHandler &&
        typeof window !== 'undefined' &&
        typeof window.removeEventListener === 'function') {
        window.removeEventListener('popstate', popstateHandler);
        popstateHandler = null;
    }
    popstateListenerInstalled = false;
    // reset browser route signal (در SSR، context signals به‌طور خودکار
    // با تمام شدن runWithRoute پاک می‌شوند).
    browserRouteSignal.set({ path: '/', params: {} });
}
//# sourceMappingURL=router.js.map