// packages/service-worker/src/strategies.ts
//
// FEATURE (v0.4.0): استراتژی‌های کشِ Service Worker (بدون وابستگی).
//
// این ماژول پیاده‌سازیِ سبکِ Workbox-style از استراتژی‌های رایج کش را فراهم
// می‌کند. هدف: راه‌حلِ offline-first با صفر وابستگی خارجی.
//
// استراتژی‌ها:
//   1. cacheFirst      — اول cache، اگر نبود network (و cache شود).
//   2. networkFirst    — اول network (با timeout)، اگر شکست خورد cache.
//   3. staleWhileRevalidate — cache را فوراً برمی‌گرداند و در پس‌زمینه revalidate می‌کند.
//   4. networkOnly     — مستقیم fetch.
//   5. cacheOnly       — مستقیم cache.
//   6. cacheThenNetwork (v0.5.0) — cache فوراً، fetch در پس‌زمینه با onUpdate callback.
//
// همه‌ی توابع در context محدودِ SW اجرا می‌شوند اما برای تست‌پذیری، از Cache API
// سراسری (`caches`) استفاده می‌کنند که در مرورگر نیز در دسترس است.
//
// SECURITY (v0.5.0): همه‌ی استراتژی‌های cache-aware یک POST guard در ابتدا دارند تا
// از تطبیقِ cache مربوط به GET با درخواست POST/PUT/DELETE به همان URL جلوگیری شود.
//
// نکته: این کد نباید از `window` یا `document` استفاده کند — از `self` استفاده
// می‌کنیم که در SW context به‌عنوان global scope در دسترس است.
/**
 * کمکی: دریافت Cache API با guard (ممکن است در SSR/Node در دسترس نباشد).
 */
function getCaches() {
    if (typeof caches === 'undefined')
        return undefined;
    return caches;
}
/**
 * کمکی: ساخت یک Response خطای شبیه‌سازی‌شده برای زمان‌هایی که fetch ناموفق است.
 */
function offlineResponse(request, message) {
    // FEATURE (v0.4.0): در حالت offline، یک Response با status 503 برمی‌گردانیم
    // تا کدهای consumer بتوانند آن را تشخیص دهند.
    const body = JSON.stringify({ error: message, url: request.url });
    return new Response(body, {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
    });
}
/**
 * FEATURE (v0.4.0): استراتژی Cache-First.
 *
 * ۱) cache را بررسی کن. اگر موجود بود، همان را برگردان.
 * ۲) اگر نبود، از شبکه بگیر.
 * ۳) response شبکه را در cache ذخیره کن (برای دفعه بعد).
 * ۴) اگر شبکه هم ناموفق بود و cache هم خالی بود، یک 503 برگردان.
 *
 * بهترین برای: assets استاتیک با hash (JS/CSS/Images/Fonts).
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 * @returns Promise<Response>.
 */
export async function cacheFirst(request, cacheName) {
    // SECURITY (v0.5.0): POST guard — جلوگیری از تطبیقِ cache GET با درخواست POST.
    // `cache.match(request)` می‌تواند یک response مربوط به GET را برای POST هم match
    // کند که خطرناک است. mutationها مستقیماً به شبکه می‌روند (networkOnly fallback).
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fetch(request);
    }
    const cacheStore = getCaches();
    if (!cacheStore) {
        // محیط بدون Cache API — مستقیم fetch کن.
        return fetch(request);
    }
    const cache = await cacheStore.open(cacheName);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        // فقط responseهای موفق و از نوع GET را کش کن (best practice).
        if (response.ok && request.method === 'GET') {
            cache.put(request, response.clone());
        }
        return response;
    }
    catch (err) {
        return offlineResponse(request, 'Network unavailable (cacheFirst).');
    }
}
/**
 * FEATURE (v0.4.0): استراتژی Network-First.
 *
 * ۱) شبکه را با timeout امتحان کن.
 * ۲) اگر timeout یا خطا، cache را برگردان.
 * ۳) اگر cache هم خالی بود، 503 برگردان.
 * ۴) در صورت موفقیت، response را در cache ذخیره کن.
 *
 * بهترین برای: APIهای دیتا که داده‌ی تازه مهم است (مثل /api/users).
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 * @param timeout   مدت timeout به میلی‌ثانیه (پیش‌فرض: 3000).
 */
export async function networkFirst(request, cacheName, timeout = 3000) {
    // SECURITY (v0.5.0): POST guard — جلوگیری از fallback به cache GET برای mutationها.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fetch(request);
    }
    const cacheStore = getCaches();
    if (!cacheStore) {
        return fetch(request);
    }
    const cache = await cacheStore.open(cacheName);
    // FIX (v1.2.7): use AbortController instead of Promise.race so the
    // fetch is actually cancelled when the timeout fires. Previously the
    // fetch kept running in the background consuming bandwidth even after
    // we fell back to cache. We also `clearTimeout` on completion so the
    // timer does not leak.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok && request.method === 'GET') {
            cache.put(request, response.clone());
        }
        return response;
    }
    catch (err) {
        clearTimeout(timeoutId);
        // Fallback به cache. (AbortError از timeout نیز اینجا می‌رسد.)
        const cached = await cache.match(request);
        if (cached)
            return cached;
        return offlineResponse(request, 'Network failed and cache empty (networkFirst).');
    }
}
/**
 * FEATURE (v0.4.0): استراتژی Stale-While-Revalidate.
 *
 * ۱) اگر cache موجود است، فوراً همان را برگردان.
 * ۲) در پس‌زمینه، یک fetch انجام بده و cache را به‌روزرسانی کن.
 * ۳) اگر cache نبود، مستقیم fetch کن (و کش کن).
 *
 * بهترین برای: منابعی که به‌روزرسانی فوری حیاتی نیست اما cache شدنشان مهم است.
 *
 * نکته: این تابع response را فوراً برمی‌گرداند؛ revalidation به‌صورت fire-and-forget
 * در پس‌زمینه انجام می‌شود و خطاهایش نادیده گرفته می‌شوند.
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 */
export async function staleWhileRevalidate(request, cacheName) {
    // SECURITY (v0.5.0): POST guard — جلوگیری از بازگشتِ cache GET برای درخواست POST.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fetch(request);
    }
    const cacheStore = getCaches();
    if (!cacheStore) {
        return fetch(request);
    }
    const cache = await cacheStore.open(cacheName);
    const cached = await cache.match(request);
    // FEATURE (v0.4.0): revalidation در پس‌زمینه (fire-and-forget).
    // توجه: اگر cache موجود باشد، این Promise را نگاه نمی‌داریم و خطایش را نادیده
    // می‌گیریم (تا unhandled rejection نباشد). اگر cache نبود، await می‌کنیم.
    const revalidatePromise = fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
            // NOTE: `cache.put` Promise برمی‌گرداند؛ به‌صورت fire-and-forget اجرا می‌شود.
            cache.put(request, response.clone()).catch(() => { });
        }
        return response;
    });
    if (cached) {
        // فوراً cache را برگردان؛ revalidation در پس‌زمینه در حال اجراست.
        // خطای احتمالی revalidate را swallow می‌کنیم تا unhandled rejection رخ ندهد.
        revalidatePromise.catch(() => { });
        return cached;
    }
    // cache نبود — منتظر revalidate می‌مانیم تا response واقعی برگردد.
    try {
        return await revalidatePromise;
    }
    catch (err) {
        return offlineResponse(request, 'Network failed and cache empty (SWR).');
    }
}
/**
 * FEATURE (v0.4.0): استراتژی Network-Only.
 *
 * مستقیم fetch بدون درگیر کردن cache. مفید برای درخواست‌های غیر cached مثل
 * mutationها (POST/PUT/DELETE) یا endpointهای حساس.
 *
 * @param request درخواست.
 */
export async function networkOnly(request) {
    try {
        return await fetch(request);
    }
    catch (err) {
        return offlineResponse(request, 'Network unavailable (networkOnly).');
    }
}
/**
 * FEATURE (v0.4.0): استراتژی Cache-Only.
 *
 * فقط cache را بررسی می‌کند. اگر نبود، 503 برمی‌گرداند. هیچ‌وقت به شبکه نمی‌رود.
 *
 * بهترین برای: منابعی که فقط از cache خوانده می‌شوند (مثل pre-critical assets).
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 */
export async function cacheOnly(request, cacheName) {
    const cacheStore = getCaches();
    if (!cacheStore) {
        return offlineResponse(request, 'Cache API unavailable (cacheOnly).');
    }
    const cache = await cacheStore.open(cacheName);
    const cached = await cache.match(request);
    if (cached)
        return cached;
    return offlineResponse(request, 'Cache miss (cacheOnly).');
}
/**
 * FEATURE (v0.5.0): استراتژی Cache-Then-Network.
 *
 * ۱) اگر cache موجود است، فوراً همان را برگردان (UI سریع).
 * ۲) در پس‌زمینه یک fetch انجام بده؛ اگر موفق و GET بود، cache را به‌روز کن و
 *    `onUpdate(fresh)` را صدا بزن تا main thread بتواند UI را refresh کند.
 * ۳) اگر cache خالی است، مستقیم fetch کن (و کش کن).
 * ۴) SECURITY (v0.5.0): POST guard در ابتدای تابع — mutationها مستقیم fetch می‌شوند.
 */
export async function cacheThenNetwork(request, cacheName, onUpdate) {
    // SECURITY (v0.5.0): POST guard — mutationها نباید از cache بخوانند.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fetch(request);
    }
    const cacheStore = getCaches();
    if (!cacheStore) {
        return fetch(request);
    }
    const cache = await cacheStore.open(cacheName);
    const cached = await cache.match(request);
    // FEATURE (v0.5.0): fetch در پس‌زمینه — cache را به‌روز می‌کند و onUpdate را صدا می‌زند.
    const freshPromise = fetch(request)
        .then((response) => {
        if (response.ok && request.method === 'GET') {
            // به‌روزرسانی cache (fire-and-forget).
            cache.put(request, response.clone()).catch(() => { });
            // notification به caller (برای refresh UI).
            if (typeof onUpdate === 'function') {
                try {
                    onUpdate(response.clone());
                }
                catch (e) {
                    // خطای callback نباید flow را بشکند.
                }
            }
        }
        return response;
    })
        .catch(() => {
        // خطای fetch پس‌زمینه نادیده گرفته می‌شود (cache همچنان معتبر است).
        throw new Error('background fetch failed');
    });
    if (cached) {
        // فوراً cache را برگردان؛ freshPromise در پس‌زمینه اجرا می‌شود.
        // خطای احتمالی freshPromise را swallow می‌کنیم تا unhandled rejection نباشد.
        freshPromise.catch(() => { });
        return cached;
    }
    // cache نبود — منتظر fetch می‌مانیم تا response واقعی برگردد.
    try {
        return await freshPromise;
    }
    catch (err) {
        return offlineResponse(request, 'Network failed and cache empty (cacheThenNetwork).');
    }
}
/**
 * FEATURE (v0.4.0): Dispatch به استراتژی با نام.
 *
 * تابعی کمکی برای route-matching: نام استراتژی را می‌گیرد و تابع مناسب را صدا می‌زند.
 *
 * نکته: برای `cacheThenNetwork`، `onUpdate` در این مسیر ست نمی‌شود (تنها cache در
 * پس‌زمینه به‌روز می‌شود). برای callback، استراتژی را مستقیماً صدا بزنید.
 */
export async function applyStrategy(strategyName, request, cacheName, timeout) {
    switch (strategyName) {
        case 'cacheFirst':
            return cacheFirst(request, cacheName);
        case 'networkFirst':
            return networkFirst(request, cacheName, timeout);
        case 'staleWhileRevalidate':
            return staleWhileRevalidate(request, cacheName);
        case 'networkOnly':
            return networkOnly(request);
        case 'cacheOnly':
            return cacheOnly(request, cacheName);
        case 'cacheThenNetwork':
            return cacheThenNetwork(request, cacheName);
        default: {
            // TypeScript exhaustiveness check — اگر در آینده نوع استراتژی اضافه شد،
            // اینجا خطای compile-time بگیرد.
            const _exhaustive = strategyName;
            throw new Error(`Unknown strategy: ${String(_exhaustive)}`);
        }
    }
}
//# sourceMappingURL=strategies.js.map