// packages/runtime/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/runtime`.
//
// API عمومی:
//   - Zen.start(root, state): فریم‌ورک را روی یک عنصر HTML روشن می‌کند.
//   - Zen.stop(root): فریم‌ورک را خاموش می‌کند و Effectها را dispose می‌کند.
//   - Zen.action(name, fn): ثبت یک Action در Registry.
//
// در فاز ۴، Event Delegation به‌صورت خودکار در `Zen.start` فعال می‌شود.
// `Zen.stop` هم به‌صورت متقارن، Listenerهای document را پاک می‌کند.
import { processDOM, walkAndBind } from './walker.js';
import { setRouteSignalProvider } from './context.js';
import { initEventDelegation } from '@zenith/events';
import { registerAction, unregisterAction, hasAction, clearActions, listActions, getActionMeta } from '@zenith/actions';
import { loadComponents, clearComponents } from '@zenith/components';
import { flushSync } from '@zenith/scheduler';
import { navigate, routeSignal, cleanupRouter } from '@zenith/router';
import { initDevTools } from '@zenith/devtools';
// Bug Fix #1: resetResourceRegistry باید در Zen.stop فراخوانی شود تا
// نشت حافظه‌ی resource در SPA (که در گزارش قبلی مطرح شد) برطرف شود.
import { resetResourceRegistry } from '@zenith/resource';
/**
 * FEATURE (v0.6.0): شناسه‌ی یکتای تگ <style> تزریق‌شده برای ضد-FOUC.
 */
const CLOAK_STYLE_ID = 'zenith-cloak-style';
/**
 * FEATURE (v0.6.0): لیست دایرکتیوهایی که ممکن است قبل از hydration
 * باعث FOUC شوند.
 */
const CLOAK_DIRECTIVES = [
    'zen-if',
    'zen-for',
    'zen-show',
    'zen-text',
    'zen-html',
    'zen-html-trusted',
    'zen-model',
    'zen-bind',
    'zen-resource',
    'zen-fetch',
    'zen-cloak',
    'zen-resource-view',
    'zen-action-button',
    'zen-auth-view',
];
/**
 * بررسی اینکه آیا در حالت Development هستیم.
 *
 * این تابع از flag سراسری `__ZENITH_DEV__` استفاده می‌کند (که توسط Vite
 * plugin یا کاربر قابل تنظیم است). پیش‌فرض: فعال.
 *
 * در production، کاربر باید `(globalThis as any).__ZENITH_DEV__ = false` تنظیم کند
 * تا log های توسعه حذف شوند.
 */
function isDevMode() {
    if (typeof globalThis === 'undefined')
        return false;
    const flag = globalThis.__ZENITH_DEV__;
    // پیش‌فرض: فعال. اما اگر صراحتاً false باشد، غیرفعال.
    return flag !== false;
}
// FEATURE (v0.3.0): Plugin Architecture — registry از پلاگین‌های نصب‌شده.
const pluginRegistry = new Map();
/**
 * شیء‌ی Zen: API اصلی فریم‌ورک.
 *
 * استفاده:
 *   import { Zen } from '@zenith/runtime';
 *   Zen.action('save', ({ state }) => { ... });
 *   Zen.start(document.getElementById('app'), {
 *     user: signal({ name: 'Ali' }),
 *     count: signal(0),
 *   });
 */
export const Zen = {
    /**
     * شروع فریم‌ورک روی یک عنصر HTML.
     *
     * این تابع:
     *   1) Event Delegation را در سطح document فعال می‌کند (یک Listener برای
     *      هر نوع رویداد: click, input, change, submit, keydown, keyup).
     *   2) DOM را پیمایش می‌کند و دایرکتیوهای zen-* را فعال می‌کند.
     *   3) Effectهای ایجادشده را در `root.__zenithDisposes` ذخیره می‌کند.
     *   4) تابع teardown delegation را در `root.__zenithDelegationTeardown` ذخیره
     *      می‌کند تا در `Zen.stop` بتوان آن را فراخوانی کرد.
     *
     * @param root عنصر ریشه (معمولاً `<div id="app">`).
     * @param state آبجکت State شامل Signalها و Services.
     * @param options گزینه‌های اختیاری (v1.0.0): `devtools: false` برای غیرفعال‌کردن DevTools.
     */
    start(root, state, options) {
        if (!root) {
            throw new Error('[Zen.start] Root element is required.');
        }
        // FEATURE (v1.0.0): امکان غیرفعال‌کردن DevTools برای benchmark و production.
        const enableDevTools = !(options && options.devtools === false);
        // ── پیام شروع فقط در حالت Development ──
        if (isDevMode()) {
            console.log('🚀 Zenith Framework is starting...');
        }
        // ─ـ ۱. نصب DevTools Hook (فاز ۱۰) ──
        if (enableDevTools) {
            initDevTools();
        }
        // ── ۲. تزریق Route Signal Provider (فاز ۸) ──
        // این کار با dependency injection انجام می‌شود تا context.ts به‌صورت
        // static به router وابسته نباشد. اگر @zenith/router در دسترس نباشد،
        // `$route` در Context تعریف نمی‌شود.
        setRouteSignalProvider(() => routeSignal.get());
        // ── ۳. لود کردن تعاریف کامپوننت‌ها ──
        // این کار را قبل از هر چیز انجام می‌دهیم تا walker بتواند تگ‌های سفارشی
        // (مثل <app-product-card>) را به‌عنوان کامپوننت تشخیص دهد.
        // نکته: اگر قبلاً کامپوننت‌هایی ثبت شده بودند (مثلاً در HMR)، overwrite می‌شوند.
        loadComponents(root);
        // ─ـ ۳. فعال‌سازی Event Delegation در سطح Document ──
        // این کار را قبل از processDOM انجام می‌دهیم تا اگر در حین پردازش
        // یک کلیک رخ دهد (بعید ولی ممکن)، handler آماده باشد.
        //
        // FEATURE (v1.3.0): پشتیبانی از `options.delegationRoot` برای Shadow DOM
        // یا subtree delegation. اگر `delegationRoot` مشخص نشده باشد، از `document`
        // استفاده می‌شود (backward compatible).
        const delegationRoot = options?.delegationRoot;
        const teardown = initEventDelegation(state, delegationRoot ? { root: delegationRoot } : undefined);
        root.__zenithDelegationTeardown = teardown;
        // FEATURE (v0.6.0): تزریق CSS ضد-FOUC (Flash of Unstyled Content) قبل از
        // processDOM. این style تمام عناصری که هنوز دایرکتیوهای zen-* دارند را
        // مخفی می‌کند تا کاربر محتوای پردازش‌نشده نبیند. بعد از پایان processDOM
        // (که synchronous است) style حذف می‌شود.
        //
        // نکته: اگر کاربر CSS را به‌صورت inline در HTML خود قرار دهد:
        //   <style>${Zen.cloakCSS()}</style>
        // آن زمان FOUC به‌طور کامل جلوگیری می‌شود. این style تزریق‌شده فقط یک
        // safety net برای کاربرانی است که این کار را نکرده‌اند.
        //
        // SSR-safe: اگر document تعریف نشده باشد، این بخش no-op.
        const cloakInjected = Zen.__injectCloakStyle();
        // ── ۴. پردازش DOM و وصل کردن Signalها ──
        processDOM(root, state);
        // FEATURE (v0.6.0): حذف CSS ضد-FOUC بعد از پایان processDOM.
        if (cloakInjected) {
            Zen.__removeCloakStyle();
        }
        // ── ۵. Exposing HMR Reload Function (فاز ۱۰) ──
        // این تابع توسط Vite Plugin در زمان HMR فراخوانی می‌شود.
        // ابتدا یک cleanup کامل انجام می‌دهد (Zen.stop) و سپس دوباره start می‌کند.
        globalThis.__ZENITH_RELOAD__ = (_changedPath) => {
            console.log('[Zenith HMR] Re-processing DOM...', _changedPath ? `(${_changedPath})` : '');
            // Cleanup کامل: stopEffect، Event Delegation، Components، Router.
            Zen.stop(root);
            // Restart: loadComponents، Event Delegation، processDOM.
            Zen.start(root, state);
        };
    },
    /**
     * خاموش کردن فریم‌ورک روی یک عنصر.
     *
     * این تابع:
     *   1) تمام Listenerهای Event Delegation را از document حذف می‌کند.
     *   2) تمام Effectهای ایجادشده توسط دایرکتیوها را dispose می‌کند.
     *
     * کاربردها:
     *   - HMR (Hot Module Replacement) در Development
     *   - تخریب یک صفحه در SPA
     *   - پاکسازی حافظه در تست‌ها
     *
     * @param root عنصری که قبلاً Zen.start روی آن فراخوانی شده.
     */
    stop(root) {
        // ─ـ ۱. Teardown Event Delegation ──
        const teardown = root.__zenithDelegationTeardown;
        if (teardown) {
            teardown();
            delete root.__zenithDelegationTeardown;
        }
        // ── ۲. Dispose Effectهای دایرکتیوها ──
        const disposes = root.__zenithDisposes;
        if (disposes) {
            disposes.forEach((d) => d());
            disposes.length = 0;
            delete root.__zenithDisposes;
        }
        // ── ۳. پاکسازی Component Registry ──
        // این کار برای HMR و تست‌ها ضروری است تا کامپوننت‌های قدیمی با تعاریف
        // جدید overwrite نشوند (یا برعکس). در حالت عادی production هم ضرری ندارد
        // چون در start دوباره loadComponents فراخوانی می‌شود.
        clearComponents();
        // ── ۴. پاکسازی Router ──
        // reset routeSignal به حالت اولیه (برای تست‌ها).
        cleanupRouter();
        // ─ـ ۵. پاکسازی Resource Registry (Bug Fix #1) ──
        // قبلاً resetResourceRegistry وجود داشت اما در Zen.stop فراخوانی نمی‌شد.
        // این باعث نشت حافظه‌ی resource در SPA می‌شد: هر بار که کاربر بین صفحات
        // ناوبری می‌کرد، Resourceهای قبلی در registry باقی می‌ماندند.
        // حالا در Zen.stop پاکسازی می‌شوند تا حافظه آزاد شود.
        try {
            resetResourceRegistry();
        }
        catch (e) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[Zenith] resetResourceRegistry failed:', e);
            }
        }
        // ─ـ ۶. پاکسازی HMR Reload Function (فاز ۱۰) ──
        if (typeof globalThis !== 'undefined') {
            delete globalThis.__ZENITH_RELOAD__;
        }
        // نکته: DevTools Hook را cleanup نمی‌کنیم چون可能在 HMR reload دوباره
        // استفاده شود. اگر کاربر بخواهد آن را پاک کند، می‌تواند cleanupDevtools()
        // را دستی فراخوانی کند.
    },
    // ── Action Registry API ──
    // این‌ها میانبرهای راحتی برای `Zen.action('save', fn)` هستند.
    // معادل `registerAction` از `@zenith/actions`.
    //
    // FEATURE (v1.3.0): `Zen.action` حالا تمام متدهای `action` از `@zenith/actions`
    // را شامل می‌شود: `register`, `unregister`, `has`, `clear`, `list`, `getMeta`.
    // همچنین فراخوانی مستقیم `Zen.action(name, fn, metadata?)` هم metadata قبول می‌کند.
    action: Object.assign((name, fn, metadata) => registerAction(name, fn, metadata), {
        register: registerAction,
        unregister: unregisterAction,
        has: hasAction,
        clear: clearActions,
        list: listActions,
        getMeta: getActionMeta,
    }),
    // ── Scheduler API (فاز ۷) ──
    // اجرای اجباری و Synchronous صف Effectها.
    // معمولاً نیازی به فراخوانی دستی نیست (Event Handlers به‌طور خودکار
    // flushSync را فراخوانی می‌کنند). اما در موارد خاص (مثلاً بعد از
    // state.set() در تست‌ها) مفید است.
    flushSync,
    // ── Router API (فاز ۸) ──
    // ناوبری SPA بدون رفرش صفحه.
    // می‌توان از آن در Actions استفاده کرد:
    //   Zen.action('goHome', () => Zen.navigate('/'));
    navigate,
    // Route Signal سراسری.
    // می‌توان از آن برای خواندن مسیر فعلی استفاده کرد:
    //   const { path, params } = Zen.route.get();
    route: routeSignal,
    // ── Plugin API (v0.3.0) ──
    // FEATURE (v0.3.0): Plugin Architecture — نگه‌داشتن Core کوچک.
    // Zen.use(plugin, options) متد install پلاگین را یک‌بار فراخوانی می‌کند.
    use(plugin, options) {
        if (!plugin || typeof plugin.install !== 'function') {
            console.warn('[Zenith] Zen.use: plugin must have an install() method.');
            return Zen;
        }
        if (pluginRegistry.has(plugin.name)) {
            if (isDevMode()) {
                console.warn(`[Zenith] Plugin "${plugin.name}" is already installed. Skipping.`);
            }
            return Zen;
        }
        try {
            plugin.install(Zen, options);
            pluginRegistry.set(plugin.name, plugin);
            if (isDevMode()) {
                console.log(`🔌 Zenith plugin installed: ${plugin.name}`);
            }
        }
        catch (err) {
            console.error(`[Zenith] Plugin "${plugin.name}" failed to install:`, err);
        }
        return Zen;
    },
    plugins() {
        return Array.from(pluginRegistry.keys());
    },
    // ─────────────────────────────────────────────────────────────
    // FEATURE (v0.6.0): FOUC Prevention — Auto-Cloak CSS.
    // ─────────────────────────────────────────────────────────────
    /**
     * رشته‌ی CSS ضد-FOUC را برمی‌گرداند.
     * کاربر می‌تواند آن را inline در HTML خود قرار دهد:
     *   <style>${Zen.cloakCSS()}</style>
     */
    cloakCSS() {
        const selectors = CLOAK_DIRECTIVES.map((d) => `[${d}]`).join(',\n  ');
        return `  ${selectors} {\n    visibility: hidden !important;\n  }\n`;
    },
    /**
     * تزریق CSS ضد-FOUC به <head> document.
     * این متد داخلی است و توسط `Zen.start` فراخوانی می‌شود.
     * SSR-safe: اگر document تعریف نشده باشد، false برمی‌گرداند.
     */
    __injectCloakStyle() {
        if (typeof document === 'undefined' || !document.head)
            return false;
        if (document.getElementById(CLOAK_STYLE_ID))
            return false;
        const style = document.createElement('style');
        style.id = CLOAK_STYLE_ID;
        style.textContent = Zen.cloakCSS();
        document.head.prepend(style);
        return true;
    },
    /**
     * حذف CSS ضد-FOUC از <head> document.
     * SSR-safe: اگر document تعریف نشده باشد، no-op است.
     */
    __removeCloakStyle() {
        if (typeof document === 'undefined' || !document.head)
            return;
        const existing = document.getElementById(CLOAK_STYLE_ID);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
    },
};
// ── Re-exports برای راحتی کاربران ──
/**
 * Re-export State از Phase 1 برای راحتی کاربران.
 *
 * به جای:
 *   import { signal } from '@zenith/state';
 *   import { Zen } from '@zenith/runtime';
 * می‌توانند فقط:
 *   import { Zen, signal } from '@zenith/runtime';
 */
export { signal, effect, computed, batch } from '@zenith/state';
/**
 * Re-export Action Registry API.
 */
export { registerAction, unregisterAction, getAction, getActionMeta, hasAction, clearActions, listActions, getDefaultRegistry, ActionRegistry } from '@zenith/actions';
/**
 * Re-export Event Delegation API (برای کاربران پیشرفته).
 */
export { initEventDelegation, parseBinding } from '@zenith/events';
/**
 * Re-export Component API (فاز ۶).
 */
export { loadComponents, registerComponent, unregisterComponent, isComponent, clearComponents, } from '@zenith/components';
/**
 * Re-export Scheduler API (فاز ۷).
 */
export { scheduleEffect, flushSync, hasPendingEffects, pendingEffectCount, pendingEffectsByPriority, } from '@zenith/scheduler';
/**
 * Re-export Router API (فاز ۸).
 */
export { routeSignal, navigate, matchRoute, findMatchingRoute, setRouteParams, } from '@zenith/router';
/**
 * Re-export Data Fetching API (فاز ۸).
 */
export { processFetch } from '@zenith/data';
/**
 * Re-export Security API (فاز ۹).
 */
export { sanitizeHTML, sanitizeHTMLWithOptions, sanitizeHTMLTrusted, } from '@zenith/security';
/**
 * FEATURE (v0.4.0): Re-export zen-html-trusted directive processor.
 *
 * `processHtmlTrusted` مثل `processHtml` است اما به‌جای sanitizeHTML از
 * sanitizeHTMLTrusted (Identity function + dev warn) استفاده می‌کند. این
 * خروجی مستقیم برای کاربران پیشرفته‌ای است که می‌خواهند بدون walker از این
 * دایرکتیو استفاده کنند (مثلاً در pluginها یا manual DOM processing).
 *
 * کاربرد:
 *   import { processHtmlTrusted } from '@zenith/runtime';
 *   const dispose = processHtmlTrusted(el, expr, context);
 */
export { processHtmlTrusted } from './directives/html-trusted.js';
/**
 * FEATURE (v0.5.0): Re-export چهار دایرکتیو جدید runtime.
 *
 *  - processPortal:       عنصر را به یک container دیگر منتقل می‌کند.
 *  - processIntersection: callback را وقتی عنصر وارد viewport شد اجرا می‌کند.
 *  - processCloak:        attribute zen-cloak را حذف می‌کند (ضد FOUC).
 *  - processRef:          عنصر DOM را در یک Signal در state ذخیره می‌کند.
 */
export { processPortal } from './directives/portal.js';
export { processIntersection } from './directives/intersection.js';
export { processCloak } from './directives/cloak.js';
export { processRef } from './directives/ref.js';
/**
 * FEATURE (v1.2.0): Re-export v1.2.x directive processors — restored in v1.2.2.
 */
export { processMemo } from './directives/memo.js';
export { processIsland } from './directives/island.js';
export { processVirtualRepeat } from './directives/virtual-repeat.js';
export { processStatefulButton } from './directives/stateful-button.js';
export { processOptimistic } from './directives/optimistic.js';
export { processTrack, configureAnalytics } from './directives/track.js';
export { processDatePicker } from './directives/date-picker.js';
/**
 * FEATURE (v1.2.0): Re-export the Hydration Engine API — restored in v1.2.2.
 */
export { createHydrator, hydrateText, hydrateTextExpr, hydrateHtml, hydrateHtmlExpr, hydrateHtmlTrusted, hydrateShow, hydrateShowExpr, hydrateIf, hydrateBind, hydrateBindExpr, hydrateModel, hasHydrationMarkers, countHydrationMarkers, } from './hydrate.js';
/**
 * Re-export DevTools API (فاز ۱۰).
 */
export { initDevTools, cleanupDevtools, isDevtoolsHookInstalled, getDevtoolsVersion, } from '@zenith/devtools';
/**
 * Re-export Error Boundary API (فاز ۱۱).
 */
export { errorSignal, onError, reportError, clearError, } from '@zenith/error-boundary';
/**
 * Re-export Context API (برای dependency injection).
 */
export { setRouteSignalProvider } from './context.js';
/**
 * FEATURE (v0.6.0): Re-export Custom Directive Registry API از walker.
 *
 * این API به پلاگین‌ها (مثل @zenith/stateful) اجازه می‌دهد تا handlerهای
 * خود را برای تگ‌های سفارشی مثل <zen-resource-view> ثبت کنند.
 *
 * کاربرد:
 *   import { registerCustomDirective } from '@zenith/runtime';
 *   registerCustomDirective('zen-resource-view', processResourceView, 'config');
 */
export { registerCustomDirective, unregisterCustomDirective, clearCustomDirectives, getCustomDirective, } from './walker.js';
/**
 * FEATURE (v0.4.0): Re-export Walker API سطح پایین.
 *
 * `walkAndBind` یک نسخه‌ی سبک‌وزنِ processDOM است که برای per-clone binding
 * در zen-for کامپایل‌شده استفاده می‌شود. برخلاف `Zen.start`، این تابع:
 *   - Event Delegation را re-init نمی‌کند.
 *   - resetResourceRegistry صدا نمی‌زند.
 *   - یک تابع teardown برمی‌گرداند که Effectهای ایجادشده را dispose می‌کند.
 *
 * مورد استفاده‌ی اصلی: vite-plugin `processChildren` برای zen-for کامپایل‌شده.
 */
export { walkAndBind } from './walker.js';
//# sourceMappingURL=index.js.map