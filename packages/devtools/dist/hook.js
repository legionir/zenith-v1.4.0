// packages/devtools/src/hook.ts
//
// DevTools Hook — پل ارتباطی بین فریم‌ورک و افزونه مرورگر (فاز ۱۰).
//
// این ماژول در زمان Development اجرا می‌شود و یک شیء سراسری روی `window`
// قرار می‌دهد (`window.__ZENITH__`) تا افزونه Chrome بتواند:
//   - نسخه‌ی فریم‌ورک را بخواند.
//   - لیست تمام Signal های فعال را بگیرد.
//   - Timeline تغییرات State را ببیند.
//   - لیست کامپوننت‌های ثبت‌شده را ببیند.
//   - روی تغییرات State گوش دهد.
//
// ── نکات طراحی ──
//
// 1) Only in Browser:
//    این ماژول فقط در محیط مرورگر (با `window`) کار می‌کند. در SSR یا
//    تست‌های Node، no-op است.
//
// 2) Dev Mode Detection:
//    به‌جای `import.meta.env?.DEV` (که فقط در Vite کار می‌کند)، از یک
//    flag پیکربندی‌پذیر استفاده می‌کنیم: `(globalThis as any).__ZENITH_DEVTOOLS__`.
//    پیش‌فرض: فعال. برای غیرفعال کردن، `window.__ZENITH_DEVTOOLS__ = false` تنظیم کنید.
//
// 3) Idempotent:
//    اگر `initDevTools` چندبار فراخوانی شود، فقط یکبار Hook نصب می‌شود.
//
// 4) No Overhead in Production:
//    اگر DevTools غیرفعال باشد، تمام توابع no-op می‌شوند.
import { getAllSignals, getStateTimeline, onStateChange, } from '@zenith/state';
import { componentRegistry } from '@zenith/components';
// FEATURE (v0.4.0): Dependency Graph Viewer
import { graph, getDependencyGraph, clearDependencyGraph, } from './graph.js';
/**
 * نسخه‌ی فریم‌ورک (برای نمایش در DevTools).
 */
export const DEVTOOLS_VERSION = '1.0.0';
/**
 * Flag برای جلوگیری از نصب چندباره‌ی Hook.
 */
let hookInstalled = false;
// ── FEATURE (v1.0.0): Data stores for new tracking features ──
const staticFors = [];
const destroyedResources = [];
const cacheStats = { hits: 0, misses: 0, uniqueExpressions: new Set() };
const activeSSRStores = new Set();
/**
 * بررسی اینکه آیا DevTools باید فعال باشد.
 *
 * پیش‌فرض: فعال.
 * برای غیرفعال کردن: `(globalThis as any).__ZENITH_DEVTOOLS__ = false`
 */
function shouldEnableDevtools() {
    if (typeof globalThis === 'undefined')
        return false;
    const flag = globalThis.__ZENITH_DEVTOOLS__;
    return flag !== false;
}
/**
 * نصب DevTools Hook روی `window.__ZENITH__`.
 *
 * این تابع:
 *   1) بررسی می‌کند که در محیط مرورگر هستیم.
 *   2) بررسی می‌کند که DevTools فعال است.
 *   3) یک شیء `ZenithDevtoolsHook` روی `window.__ZENITH__` قرار می‌دهد.
 *   4) یک پیام در console چاپ می‌کند (با استایل).
 *
 * این تابع idempotent است — چندبار فراخوانی آن مشکلی ایجاد نمی‌کند.
 */
export function initDevTools() {
    // فقط در محیط مرورگر.
    if (typeof window === 'undefined')
        return;
    // اگر DevTools غیرفعال است، کاری نکن.
    if (!shouldEnableDevtools())
        return;
    // اگر قبلاً نصب شده، کاری نکن.
    if (hookInstalled)
        return;
    if (window.__ZENITH__)
        return;
    const hook = {
        version: DEVTOOLS_VERSION,
        getSignals: () => getAllSignals(),
        getTimeline: (limit) => getStateTimeline(limit),
        onStateChange: (callback) => onStateChange(callback),
        components: componentRegistry,
        installedAt: Date.now(),
        // FEATURE (v0.4.0): Dependency Graph Viewer
        getDependencyGraph: () => getDependencyGraph(),
        addSignal: (id, name, value) => graph.addSignal(id, name, value),
        addEffect: (id, deps) => graph.addEffect(id, deps || []),
        addDirective: (id, type, sel, expr) => graph.addDirective(id, type, sel, expr),
        addDom: (id, tag) => graph.addDom(id, tag),
        recordRead: (s, e) => graph.recordRead(s, e),
        recordWrite: (e, d) => graph.recordWrite(e, d),
        recordDomUpdate: (d, n) => graph.recordDomUpdate(d, n),
        clearDependencyGraph: () => clearDependencyGraph(),
        // ── FEATURE (v1.0.0): zen-static, Resource.destroy, compileExpression, SSR ──
        addStaticFor: (id, expr, itemCount) => {
            const existing = staticFors.findIndex(s => s.id === id);
            if (existing >= 0) {
                staticFors[existing].itemCount = itemCount;
            } else {
                staticFors.push({ id, expr, itemCount, createdAt: Date.now() });
            }
        },
        getStaticFors: () => staticFors.slice(),
        recordResourceDestroy: (name, url, stack) => {
            destroyedResources.push({ name, url, destroyedAt: Date.now(), stack });
        },
        getDestroyedResources: () => destroyedResources.slice(),
        recordCacheHit: (expr) => {
            cacheStats.hits++;
            cacheStats.uniqueExpressions.add(expr);
        },
        recordCacheMiss: (expr) => {
            cacheStats.misses++;
            cacheStats.uniqueExpressions.add(expr);
        },
        getCacheStats: () => {
            const total = cacheStats.hits + cacheStats.misses;
            return {
                hits: cacheStats.hits,
                misses: cacheStats.misses,
                total,
                hitRatio: total > 0 ? cacheStats.hits / total : 0,
                size: cacheStats.uniqueExpressions.size,
                uniqueExpressions: cacheStats.uniqueExpressions.size,
            };
        },
        recordSSRStore: (requestId) => {
            activeSSRStores.add(requestId);
        },
        recordSSRStoreDone: (requestId) => {
            activeSSRStores.delete(requestId);
        },
        getActiveSSRStores: () => Array.from(activeSSRStores),
    };
    window.__ZENITH__ = hook;
    hookInstalled = true;
    // پیام خوش‌آمدگویی با استایل.
    console.log('%c[Zenith DevTools] Hook installed. 🛠️', 'color: #bada55; font-weight: bold; font-size: 12px;');
    console.log('%cAccess via window.__ZENITH__', 'color: #888; font-size: 11px;');
}
/**
 * دریافت نسخه‌ی DevTools.
 */
export function getDevtoolsVersion() {
    return DEVTOOLS_VERSION;
}
/**
 * بررسی اینکه آیا Hook نصب شده است.
 */
export function isDevtoolsHookInstalled() {
    return hookInstalled && typeof window !== 'undefined' && !!window.__ZENITH__;
}
/**
 * پاکسازی Hook (برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export function cleanupDevtools() {
    if (typeof window !== 'undefined') {
        delete window.__ZENITH__;
    }
    hookInstalled = false;
    // FEATURE (v1.0.0): پاکسازی data stores جدید.
    staticFors.length = 0;
    destroyedResources.length = 0;
    cacheStats.hits = 0;
    cacheStats.misses = 0;
    cacheStats.uniqueExpressions.clear();
    activeSSRStores.clear();
}
//# sourceMappingURL=hook.js.map