import { registerAction, unregisterAction, hasAction, clearActions, listActions, getActionMeta } from '@zenith/actions';
import { flushSync } from '@zenith/scheduler';
import { navigate } from '@zenith/router';
/**
 * FEATURE (v1.0.0): گزینه‌های اختیاری برای `Zen.start`.
 */
export interface ZenStartOptions {
    /**
     * آیا DevTools Hook نصب شود؟
     *
     * - `true` (پیش‌فرض): `initDevTools()` صدا زده می‌شود و `window.__ZENITH__`
     *   نصب می‌شود. `__trackDirective` در گراف DevTools ثبت می‌کند.
     * - `false`: `initDevTools()` صدا زده نمی‌شود. `window.__ZENITH__` تنظیم
     *   نمی‌شود. `__trackDirective` به no-op تبدیل می‌شود (صفر overhead).
     *
     * در benchmark و production پیشنهاد می‌شود `devtools: false` قرار دهید.
     * در development، `devtools: true` (یا حذف گزینه) برای تجربه‌ی بهتر.
     *
     * @default true
     */
    devtools?: boolean;
    /**
     * FEATURE (v1.3.0): ریشه‌ی سفارشی برای Event Delegation.
     *
     * @default document
     */
    delegationRoot?: Document | ShadowRoot | HTMLElement;
}
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
export declare const Zen: {
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
     * FEATURE (v1.0.0): پارامتر سوم `options` اضافه شد.
     *   - `options.devtools: false` برای غیرفعال‌کردن DevTools tracking.
     *     این در benchmark و production پیشنهاد می‌شود.
     *
     * @param root عنصر ریشه (معمولاً `<div id="app">`).
     * @param state آبجکت State شامل Signalها و Services.
     * @param options گزینه‌های اختیاری (v1.0.0).
     *
     * @example
     *   // حالت معمولی (DevTools فعال):
     *   Zen.start(root, state);
     *
     *   // benchmark/production (DevTools غیرفعال):
     *   Zen.start(root, state, { devtools: false });
     */
    start(root: HTMLElement, state: Record<string, any>, options?: ZenStartOptions): void;
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
    stop(root: HTMLElement): void;
    action: ((name: string, fn: (ctx: import("@zenith/actions").ActionContext) => void, metadata?: import("@zenith/actions").ActionMetadata) => void) & {
        register: typeof registerAction;
        unregister: typeof unregisterAction;
        has: typeof hasAction;
        clear: typeof clearActions;
        list: typeof listActions;
        getMeta: typeof getActionMeta;
    };
    flushSync: typeof flushSync;
    navigate: typeof navigate;
    route: import("@zenith/state").Signal<import("@zenith/router").RouteState>;
    /**
     * FEATURE (v0.6.0): نصب یک پلاگین.
     *
     * این الگو مشابه Vue.use(plugin) یا Express.use(middleware) است.
     * پلاگین یک‌بار نصب می‌شود (با نام یکتا) و می‌تواند actionها،
     * directiveها، یا state سراسری ثبت کند.
     *
     * @param plugin شیء پلاگین با `name` و `install`.
     * @param options گزینه‌های اختیاری که به `install` پاس داده می‌شوند.
     * @returns `Zen` خودش (برای chaining).
     */
    use(plugin: ZenithPlugin, options?: any): typeof Zen;
    /**
     * FEATURE (v0.6.0): تولید CSS برای جلوگیری از FOUC (Flash of Unstyled Content).
     *
     * این متد یک CSS string برمی‌گرداند که تمام عناصری با directiveهای zen-*
     * را `visibility: hidden` می‌کند تا قبل از پردازش، محتوای پردازش‌نشده
     * دیده نشود.
     *
     * استفاده‌ی توصیه‌شده: inline کردن در HTML head:
     *   ```html
     *   <style>${Zen.cloakCSS()}</style>
     *   ```
     *
     * @returns CSS string برای مخفی کردن عناصر پردازش‌نشده.
     */
    cloakCSS(): string;
    /**
     * FEATURE (v0.6.0): تزریق داخلی CSS ضد-FOUC.
     *
     * این متد توسط `Zen.start` به‌صورت خودکار صدا زده می‌شود. کاربر معمولاً
     * نیازی به فراخوانی دستی ندارد. اگر style قبلاً تزریق شده باشد، false
     * برمی‌گرداند (idempotent).
     *
     * @returns true اگر style تزریق شد، false اگر قبلاً وجود داشت.
     * @internal
     */
    __injectCloakStyle(): boolean;
    /**
     * FEATURE (v0.6.0): حذف CSS ضد-FOUC پس از پردازش DOM.
     *
     * این متد توسط `Zen.start` به‌صورت خودکار پس از `processDOM` صدا زده می‌شود.
     *
     * @internal
     */
    __removeCloakStyle(): void;
};
/**
 * FEATURE (v0.6.0): Interface برای پلاگین‌های Zenith.
 *
 * یک Plugin یک شیء است که متد `install` دارد. این متد یک‌بار توسط `Zen.use`
 * فراخوانی می‌شود و می‌تواند actionها، directiveها، یا state سراسری ثبت کند.
 *
 * @example
 *   export const myPlugin: ZenithPlugin = {
 *     name: 'my-plugin',
 *     install(Zen, options) {
 *       Zen.action('doSomething', () => { ... });
 *     },
 *   };
 *
 * نصب:
 *   Zen.use(myPlugin, { foo: 'bar' });
 */
export interface ZenithPlugin {
    /** نام یکتای پلاگین (برای جلوگیری از نصب مجدد). */
    name: string;
    /** یک‌بار توسط Zen.use فراخوانی می‌شود. */
    install: (zen: typeof Zen, options?: any) => void;
}
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
export type { ActionContext, ActionFn, ActionMetadata } from '@zenith/actions';
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
export { scheduleEffect, flushSync, hasPendingEffects, pendingEffectCount, pendingEffectsByPriority, type Priority, } from '@zenith/scheduler';
/**
 * Re-export Router API (فاز ۸).
 */
export { routeSignal, navigate, matchRoute, findMatchingRoute, setRouteParams, type RouteState, } from '@zenith/router';
/**
 * Re-export Data Fetching API (فاز ۸).
 */
export { processFetch, type FetchState } from '@zenith/data';
/**
 * Re-export Security API (فاز ۹).
 */
export { sanitizeHTML, sanitizeHTMLWithOptions, sanitizeHTMLTrusted, type SanitizeOptions, } from '@zenith/security';
/**
 * FEATURE (v0.4.0): Re-export zen-html-trusted directive processor.
 *
 * `processHtmlTrusted` مثل `processHtml` است اما به‌جای sanitizeHTML از
 * sanitizeHTMLTrusted (Identity function + dev warn) استفاده می‌کند.
 */
export { processHtmlTrusted } from './directives/html-trusted';
/**
 * Re-export DevTools API (فاز ۱۰).
 */
export { initDevTools, cleanupDevtools, isDevtoolsHookInstalled, getDevtoolsVersion, type ZenithDevtoolsHook, } from '@zenith/devtools';
/**
 * Re-export Error Boundary API (فاز ۱۱).
 */
export { errorSignal, onError, reportError, clearError, type ZenithError, } from '@zenith/error-boundary';
/**
 * Re-export Context API (برای dependency injection).
 */
export { setRouteSignalProvider } from './context';
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
export { walkAndBind } from './walker';
/**
 * FEATURE (v0.6.0): Re-export Custom Directive Registry API از walker.
 *
 * این API به پلاگین‌ها (مثل @zenith/stateful) اجازه می‌دهد تا handlerهای
 * خود را برای تگ‌های سفارشی مثل <zen-resource-view> ثبت کنند. walker هنگام
 * پیمایش، اگر به تگ ثبت‌شده‌ای برسد، handler آن را فراخوانی می‌کند.
 *
 * کاربرد:
 *   import { registerCustomDirective } from '@zenith/runtime';
 *   registerCustomDirective('zen-resource-view', processResourceView, 'config');
 *
 * نکته: برای راه‌اندازی خودکار، می‌توان از `Zen.use(plugin)` استفاده کرد.
 */
export {
  registerCustomDirective,
  unregisterCustomDirective,
  clearCustomDirectives,
  getCustomDirective,
  type CustomDirectiveHandler,
} from './walker';
/**
 * FEATURE (v1.0.0): Re-export HTML attribute types.
 *
 * این types برای کاربران TypeScript طراحی شده‌اند تا بتوانند zen-*
 * attribute ها را در پروژه‌های خود به‌صورت type-safe استفاده کنند.
 *
 * @example
 *   import type { ZenithAttributes, AllZenithAttributes } from '@zenith/runtime';
 *
 *   // برای extend کردن یک element:
 *   function MyComponent(props: ZenithAttributes & { children?: React.ReactNode }) {
 *     return <div {...props} />;
 *   }
 */
export {
  type ZenithAttributes,
  type ZenBindAttribute,
  type AllZenithAttributes,
} from './attributes';
//# sourceMappingURL=index.d.ts.map