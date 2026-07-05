// packages/service-worker/src/index.ts
//
// FEATURE (v0.4.0): Main-thread API برای Service Worker.
//
// این ماژول در main thread اجرا می‌شود (نه در SW context). بنابراین:
//   - از `navigator.serviceWorker` با guard استفاده می‌کند.
//   - از `window`/`document` مستقیماً استفاده نمی‌کند (در عوض `globalThis` یا
//     `navigator` را guard می‌کند).
//
// شامل:
//   - registerSW(swUrl, options) — ثبت SW و بازگرداندن controller.
//   - unregisterSW()              — لغو ثبت SW.
//   - updateSW()                  — بررسی برای آپدیت.
//   - SWConfig                    — اینترفیس پیکربندی.
//   - ZenithSWPlugin              — پلاگین Zenith برای نصب با Zen.use.
/**
 * FEATURE (v0.4.0): ثبت Service Worker.
 *
 * این تابع `navigator.serviceWorker.register` را با guard می‌پوشاند.
 * اگر SW پشتیبانی نمی‌شود (مثل SSR یا محیط غیر مرورگری)، یک controller با
 * `supported: false` برمی‌گرداند و هیچ‌کاری نمی‌کند.
 *
 * FEATURE (v0.5.0): SSR guard در ابتدای تابع اضافه شد. در محیط Node.js/SSR
 * (جایی که `window` تعریف نشده است) تابع فوراً `return` می‌کند تا از crash
 * جلوگیری شود. در مرورگر بدون SW پشتیبانی، یک پیام هشدار چاپ می‌کند.
 */
export function registerSW(swUrl = '/sw.js', options = {}) {
    // SECURITY (v0.5.0): SSR guard — در Node.js/SSR `window` تعریف نشده است.
    // تابع بدون خطا return می‌کند تا import در SSR safe باشد.
    if (typeof window === 'undefined')
        return; // SSR guard
    // SECURITY (v0.5.0): اگر مرورگر SW پشتیبانی نمی‌کند، هشدار بده و return کن.
    if (!('serviceWorker' in navigator)) {
        console.warn('[Zenith SW] Service Workers not supported.');
        return;
    }
    // Guard: محیط غیر مرورگری یا مرورگر بدون SW.
    const hasSW = typeof navigator !== 'undefined' &&
        typeof navigator.serviceWorker !== 'undefined' &&
        typeof navigator.serviceWorker.register === 'function';
    if (!hasSW) {
        return {
            registration: null,
            supported: false,
            update: async () => false,
            unregister: async () => false,
            skipWaiting: () => { },
            destroy: () => { },
        };
    }
    const sw = navigator.serviceWorker;
    const listeners = [];
    let registration = null;
    // FEATURE (v0.4.0): controllerchange — وقتی SW جدید کنترل را به‌دست می‌گیرد.
    const onControllerChange = () => {
        if (options.onControllerChange) {
            options.onControllerChange(sw.controller);
        }
    };
    sw.addEventListener('controllerchange', onControllerChange);
    listeners.push({ type: 'controllerchange', fn: onControllerChange });
    // ثبت واقعی SW.
    sw.register(swUrl, { scope: options.scope || '/' })
        .then((reg) => {
        registration = reg;
        // FEATURE (v0.4.0): updatefound — وقتی SW جدیدی در حال نصب است.
        const onUpdateFound = () => {
            if (options.onUpdateFound) {
                options.onUpdateFound(reg);
            }
        };
        reg.addEventListener('updatefound', onUpdateFound);
        listeners.push({ type: 'updatefound', fn: onUpdateFound });
    })
        .catch((err) => {
        if (options.onError) {
            options.onError(err instanceof Error ? err : new Error(String(err)));
        }
        else {
            console.error('[Zenith SW] registration failed:', err);
        }
    });
    return {
        get registration() {
            return registration;
        },
        supported: true,
        update: async () => {
            if (!registration)
                return false;
            try {
                await registration.update();
                return true;
            }
            catch (err) {
                console.error('[Zenith SW] update failed:', err);
                return false;
            }
        },
        unregister: async () => {
            if (!registration)
                return false;
            try {
                const result = await registration.unregister();
                // پاک کردن listenerها بعد از unregister.
                for (const { type, fn } of listeners) {
                    sw.removeEventListener(type, fn);
                }
                if (registration) {
                    for (const { type, fn } of listeners) {
                        registration.removeEventListener(type, fn);
                    }
                }
                listeners.length = 0;
                return result;
            }
            catch (err) {
                console.error('[Zenith SW] unregister failed:', err);
                return false;
            }
        },
        skipWaiting: () => {
            // FEATURE (v0.4.0): ارسال پیام skipWaiting به SW در حالت waiting.
            const waiting = registration?.waiting;
            if (waiting) {
                waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            else if (sw.controller) {
                sw.controller.postMessage({ type: 'SKIP_WAITING' });
            }
        },
        destroy: () => {
            for (const { type, fn } of listeners) {
                sw.removeEventListener(type, fn);
                if (registration) {
                    registration.removeEventListener(type, fn);
                }
            }
            listeners.length = 0;
        },
    };
}
/**
 * FEATURE (v0.4.0): لغو ثبت SW — shortcut برای registerSW().unregister().
 *
 * اگر SW فعالی ثبت شده باشد، آن را لغو ثبت می‌کند. در غیر این‌صورت false.
 */
export async function unregisterSW() {
    if (typeof navigator === 'undefined' ||
        typeof navigator.serviceWorker === 'undefined') {
        return false;
    }
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0)
            return false;
        let allOk = true;
        for (const reg of regs) {
            const ok = await reg.unregister();
            if (!ok)
                allOk = false;
        }
        return allOk;
    }
    catch (err) {
        console.error('[Zenith SW] unregisterSW failed:', err);
        return false;
    }
}
/**
 * FEATURE (v0.4.0): بررسی برای آپدیت SW.
 *
 * همه‌ی registrationهای فعال را می‌گیرد و `update()` را روی هرکدام صدا می‌زند.
 *
 * @returns true اگر حداقل یک registration بدون خطا update شد.
 */
export async function updateSW() {
    if (typeof navigator === 'undefined' ||
        typeof navigator.serviceWorker === 'undefined') {
        return false;
    }
    try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0)
            return false;
        let anyOk = false;
        for (const reg of regs) {
            try {
                await reg.update();
                anyOk = true;
            }
            catch (err) {
                // ignore individual registration errors
            }
        }
        return anyOk;
    }
    catch (err) {
        console.error('[Zenith SW] updateSW failed:', err);
        return false;
    }
}
/**
 * FEATURE (v0.4.0): پلاگین Zenith برای نصب SW.
 *
 * استفاده:
 *   import { Zen } from '@zenith/runtime';
 *   import { zenithSWPlugin } from '@zenith/service-worker';
 *   Zen.use(zenithSWPlugin, {
 *     swUrl: '/sw.js',
 *     precache: ['/'],
 *     routes: [ { urlPattern: '/api', strategy: 'networkFirst' } ],
 *   });
 *
 * `install` یک Controller برمی‌دارد و روی `Zen` به‌عنوان `Zen.sw` قرار می‌دهد.
 * علاوه بر این، در محیط‌های غیر مرورگری no-op است.
 */
export const zenithSWPlugin = {
    name: 'zenith-service-worker',
    install: (zen, options) => {
        const config = options || {
            swUrl: '/sw.js',
            routes: [],
            precache: [],
            defaultStrategy: 'networkOnly',
        };
        // ثبت SW و قرار دادن controller روی Zen.
        const controller = registerSW(config.swUrl || '/sw.js', {
            scope: config.scope,
        });
        // SECURITY (v0.5.0): اگر registerSW در SSR بود و undefined برگرداند،
        // plugin به‌صورت no-op عمل می‌کند تا crash رخ ندهد.
        if (!controller) {
            return;
        }
        // FEATURE (v0.4.0): افزودن helper ها روی Zen (اختیاری).
        // کاربر می‌تواند با `Zen.sw.update()` یا `Zen.sw.unregister()` کار کند.
        zen.sw = controller;
        // در dev mode، یک action 'swUpdate' ثبت می‌کنیم تا کاربر بتواند از HTML
        // با zen-action="swUpdate" آپدیت را صدا بزند.
        if (zen && typeof zen.action === 'function') {
            zen.action('swUpdate', async () => {
                await controller.update();
            });
            zen.action('swUnregister', async () => {
                await controller.unregister();
            });
        }
    },
};
//# sourceMappingURL=index.js.map