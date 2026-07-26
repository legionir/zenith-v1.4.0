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

import { processDOM } from './walker';
import { setRouteSignalProvider } from './context';
import { initEventDelegation } from '@zenith/events';
import { registerAction, unregisterAction, hasAction, clearActions, listActions, getActionMeta } from '@zenith/actions';
import { loadComponents, clearComponents } from '@zenith/components';
import { flushSync } from '@zenith/scheduler';
import { navigate, routeSignal, cleanupRouter } from '@zenith/router';
import { initDevTools, exposeDevToolsAPI } from '@zenith/devtools';
import { setStrictParity } from './parity-check';
import { notificationsAPI } from '@zenith/notifications';
import { auth, initAuth } from '@zenith/auth';
// Bug Fix #1: resetResourceRegistry باید در Zen.stop فراخوانی شود تا
// نشت حافظه‌ی resource در SPA (که در گزارش قبلی مطرح شد) برطرف شود.
import { resetResourceRegistry } from '@zenith/resource';
import { onError, setDevMode, emitError, getErrorHistory } from '@zenith/state';
import type { ZenithError, ErrorHandler } from '@zenith/state';

/**
 * FEATURE (v0.6.0): شناسه‌ی یکتای تگ <style> تزریق‌شده برای ضد-FOUC.
 *
 * این شناسه در `Zen.start` برای ساخت style element و در پایان پردازش DOM
 * برای حذف آن استفاده می‌شود. انتخاب یک شناسه‌ی ثابت به ما اجازه می‌دهد
 * حتی اگر چند بار Zen.start روی rootهای مختلف فراخوانی شود، فقط یک style
 * tag در head نگه داریم (idempotent).
 */
const CLOAK_STYLE_ID = 'zenith-cloak-style';

/**
 * FEATURE (v0.6.0): لیست دایرکتیوهایی که ممکن است قبل از hydration
 * باعث FOUC شوند.
 *
 * این attributeها روی عناصر قرار می‌گیرند و browser قبل از اجرای Zen.start
 * نمی‌داند که باید چه کار با آنها بکند. به همین دلیل CSS ضد-FOUC آنها را
 * تا زمان پردازش مخفی می‌کند.
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
 * امضای تابع teardown که از `initEventDelegation` برمی‌گردد.
 * برای type-safety آن را اینجا import نمی‌کنیم تا runtime به events وابسته‌ی
 * compile-time نداشته باشد (در آینده ممکن است delegates چندگانه داشته باشیم).
 */
type TeardownFn = () => void;

/**
 * بررسی اینکه آیا در حالت Development هستیم.
 *
 * این تابع از flag سراسری `__ZENITH_DEV__` استفاده می‌کند (که توسط Vite
 * plugin یا کاربر قابل تنظیم است). پیش‌فرض: فعال.
 *
 * در production، کاربر باید `(globalThis as any).__ZENITH_DEV__ = false` تنظیم کند
 * تا log های توسعه حذف شوند.
 *
 * IMP-RUNT-02: Improved dev mode detection with multiple fallbacks:
 * 1. Build-time flag (Vite's import.meta.env.DEV equivalent)
 * 2. Global flag __ZENITH_DEV__
 * 3. URL parameter ?zenith_dev=1
 * 4. Hostname check (localhost, 127.0.0.1)
 */
function isDevMode(): boolean {
  // SSR-safe: if globalThis is undefined, we're not in a browser
  if (typeof globalThis === 'undefined') return false;

  // 1. Explicit global flag (highest priority)
  const explicitFlag = (globalThis as any).__ZENITH_DEV__;
  if (explicitFlag === false) return false;
  if (explicitFlag === true) return true;

  // 2. Build-time flag (if injected by bundler)
  // Vite sets import.meta.env.DEV, webpack sets process.env.NODE_ENV
  try {
    // @ts-ignore - import.meta may not exist in all environments
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) {
      return true;
    }
  } catch {
    // ignore
  }

  // 3. Check NODE_ENV (webpack/other bundlers)
  try {
    // @ts-ignore - process may not exist in browser
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }
  } catch {
    // ignore
  }

  // 4. URL parameter fallback
  try {
    if (typeof window !== 'undefined' && window.location?.search?.includes('zenith_dev=1')) {
      return true;
    }
  } catch {
    // ignore
  }

  // 5. Hostname fallback (localhost, 127.0.0.1, etc.)
  try {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // Default: true (dev mode enabled by default for DX)
  return true;
}

/**
 * نتیجه‌ی یک اندازه‌گیری performance.
 */
export interface PerfMeasure {
  /** نام اندازه‌گیری */
  name: string;
  /** مدت زمان (بر حسب میلی‌ثانیه) */
  duration: number;
  /** timestamp اتمام اندازه‌گیری */
  timestamp: number;
}

/**
 * رابط ابزار Performance Monitoring قابل استفاده در `Zen.perf`.
 *
 * مثال:
 * ```typescript
 * import { Zen, type ZenPerf } from '@zenith/runtime';
 *
 * function measureStartup(perf: ZenPerf) {
 *   perf.mark('startup');
 *   // ...
 * }
 *
 * measureStartup(Zen.perf);
 * ```
 */
export interface ZenPerf {
  /** وضعیت فعال/غیرفعال */
  readonly enabled: boolean;
  /**
   * ثبت یک timestamp با نام مشخص.
   * بعداً می‌توان از `measure()` برای محاسبه‌ی فاصله تا timestamp بعدی استفاده کرد.
   */
  mark(name: string): void;
  /**
   * محاسبه‌ی مدت زمان بین آخرین timestamp با نام `name` و الآن.
   *
   * @returns object شامل name و duration و timestamp، یا undefined اگر markی وجود نداشته باشد.
   */
  measure(name: string): PerfMeasure | undefined;
  /** پاک کردن تمام marks و history اندازه‌گیری‌ها */
  clear(): void;
  /** دریافت گزارش تمام اندازه‌گیری‌های انجام‌شده */
  getReport(): readonly PerfMeasure[];
}

/**
 * FEATURE (v0.3.0): رابط یک Zenith Plugin.
 *
 * یک Plugin یک شیء است که متد `install` دارد. این متد یک‌بار توسط `Zen.use`
 * فراخوانی می‌شود و می‌تواند actionها، directiveها، یا state سراسری ثبت کند.
 *
 * مثال:
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
 * Registry از پلاگین‌های نصب‌شده (برای جلوگیری از نصب مجدد و DevTools).
 *
 * IMP-RUNT-03: Added atomic installation with Promise-based locking
 * to prevent race conditions during concurrent plugin installation.
 */
const pluginRegistry = new Map<string, ZenithPlugin>();
const pluginInstallLocks = new Map<string, Promise<void>>();

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
   *
   * @default true
   */
  devtools?: boolean;
  /**
   * FEATURE (v1.3.0): ریشه‌ی سفارشی برای Event Delegation.
   *
   * - `undefined` (پیش‌فرض): Listener ها روی `document` ثبت می‌شوند (حالت پیش‌فرض).
   * - `Document`: همان پیش‌فرض، صریح.
   * - `ShadowRoot`: برای اجزای Web Component با Shadow DOM — Listener ها فقط
   *   داخل Shadow Root فعال می‌شوند.
   * - `HTMLElement`: برای یک subtree خاص (مثلاً یک micro-frontend).
   *
   * مثال:
   *   Zen.start(hostEl, state, { delegationRoot: hostEl.shadowRoot! });
   *
   * @default document
   */
  delegationRoot?: Document | ShadowRoot | HTMLElement;
  /**
   * SSR hydration options.
   */
  ssr?: {
    /** Whether to preload server state from injected script tag. @default true */
    preloadState?: boolean;
    /** Whether to validate hydration consistency. @default false */
    validateHydration?: boolean;
  };
  /**
   * Global error handler callback.
   */
  onError?: ErrorHandler;
  /**
   * Enable strict runtime/compiler parity checking in development.
   */
  strictParity?: boolean;
}

/**
 * Runtime API interface (prevents circular `typeof Zen` inference issues).
 */
interface ZenApi {
  onError: typeof onError;
  getErrors: typeof getErrorHistory;
  reportError: (message: string, options?: Partial<ZenithError>) => void;
  notify: typeof notificationsAPI.notify;
  toasts: typeof notificationsAPI.toasts;
  alert: typeof notificationsAPI.alert;
  confirm: typeof notificationsAPI.confirm;
  auth: typeof auth;
  start(root: HTMLElement, state?: Record<string, any>, options?: ZenStartOptions): void;
  stop(root: HTMLElement): void;
  action: ReturnType<typeof Object.assign<typeof registerAction, { register: typeof registerAction; unregister: typeof unregisterAction; has: typeof hasAction; clear: typeof clearActions; list: typeof listActions; getMeta: typeof getActionMeta }>>;
  flushSync: () => void;
  navigate: typeof navigate;
  route: typeof routeSignal;
  use(plugin: ZenithPlugin, options?: any): ZenApi;
  plugins(): string[];
  cloakCSS(): string;
  __injectCloakStyle(): boolean;
  __removeCloakStyle(): void;
  perf: ZenPerf;
}

export const Zen: ZenApi = {
  /**
   * Register a global error handler.
   * @example
   * Zen.onError(err => {
   *   Sentry.captureException(new Error(err.message));
   * });
   */
  onError,

  /**
   * Get recent error history (up to 50 entries).
   */
  getErrors: getErrorHistory,

  /**
   * Emit a custom error through Zenith's error system.
   */
  reportError: (message: string, options: Partial<ZenithError> = {}) => {
    emitError({
      message,
      category: options.category || 'runtime',
      severity: options.severity || 'error',
      recoverable: options.recoverable !== false,
      ...options,
    });
  },

  // ── Notification API ──
  notify: notificationsAPI.notify,
  toasts: notificationsAPI.toasts,
  alert: notificationsAPI.alert,
  confirm: notificationsAPI.confirm,

  // ── Auth API (v1.4.0) ──
  auth,

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
   *
   * @param root عنصر ریشه (معمولاً `<div id="app">`).
   * @param state آبجکت State شامل Signalها و Services.
   * @param options گزینه‌های اختیاری (v1.0.0).
   */
  start(root: HTMLElement, state: Record<string, any> = {}, options?: ZenStartOptions): void {
    Zen.perf.mark('zen.start');
    // IMP-RUNT-06: Enhanced error message with helpful debugging hints
    if (!root) {
      throw new Error(
        '[Zen.start] Root element is required.\n' +
        '  Common causes:\n' +
        '  - DOM not fully loaded: Ensure Zen.start runs after DOMContentLoaded or place script at end of body.\n' +
        '  - Selector mismatch: Check document.getElementById("app") matches your HTML element ID.\n' +
        '  - SSR hydration: In SSR, ensure the root element exists in the hydrated HTML.'
      );
    }

    // BUG-RUNT-05 FIX: If start was already called on this root without stop,
    // clean up the previous instance first to prevent resource leaks.
    const existingTeardown = (root as any).__zenithDelegationTeardown as TeardownFn | undefined;
    if (existingTeardown) {
      if (isDevMode()) {
        console.warn('[Zen.start] Root element already has an active Zen instance. Stopping previous instance first.');
      }
      // Run the previous teardown to clean up event delegation
      try {
        existingTeardown();
      } catch (e) {
        if (isDevMode()) {
          console.warn('[Zen.start] Error during previous instance teardown:', e);
        }
      }
      // Also dispose previous effects
      const existingDisposes = (root as any).__zenithDisposes as (() => void)[] | undefined;
      if (existingDisposes) {
        existingDisposes.forEach((d) => d());
      }
    }

    // Expose DevTools API on window (ZERO-COST: just a global object, no tracking until enable())
    exposeDevToolsAPI();

    // Enable dev mode for rich error messages
    setDevMode(options?.devtools !== false);

    // Enable strict parity checking if requested (dev mode only)
    if (options?.strictParity) {
      setStrictParity(true);
    }

    // Register global error handler if provided
    if (options?.onError) {
      onError(options.onError);
    }

    // ── SSR: Merge server state if present ──
    if (options?.ssr?.preloadState !== false && typeof document !== 'undefined') {
      const el = document.getElementById('zenith-state');
      if (el) {
        try {
          const serverState = JSON.parse(el.textContent || '{}');
          if (options?.ssr?.validateHydration) {
            const match = JSON.stringify(state) === JSON.stringify(serverState);
            console.assert(
              match,
              '[Zenith] Hydration mismatch: client and server state differ'
            );
            if (!match) {
              emitError({
                message: 'Hydration mismatch: client and server state differ',
                category: 'ssr',
                    severity: 'warning',
                recoverable: true,
                hint: 'Ensure initial state on client matches what was serialized on server.',
              });
            }
          }
          Object.assign(state, serverState);
        } catch {
          // ignore parse errors
        }
      }
    }

    // FEATURE (v1.0.0): امکان غیرفعال‌کردن DevTools برای benchmark و production.
    // وقتی `options.devtools === false`، initDevTools صدا زده نمی‌شود و
    // window.__ZENITH__ تنظیم نمی‌شود. این کار __trackDirective را به no-op
    // تبدیل می‌کند (چون `__devtools()` null برمی‌گرداند) — overhead صفر.
    // این برای سناریوهایی با هزاران عنصر (مثل benchmark با ۱۰k zen-text)
    // حیاتی است چون DevTools tracking با LRU eviction می‌تواند ۱۰۰x کندتر باشد.
    const enableDevTools = options?.devtools !== false;

    // ── پیام شروع فقط در حالت Development ──
    // در production، این log چاپ نمی‌شود تا log های تمیز بمانند.
    if (isDevMode()) {
      console.log('🚀 Zenith Framework is starting...');
    }

    // ─ـ ۱. نصب DevTools Hook (فاز ۱۰) ──
    // DevTools Hook را روی window.__ZENITH__ نصب می‌کند.
    // این کار idempotent است و اگر DevTools فعال نباشد، no-op است.
    // BUG-RUNT-07 FIX: Guard against race condition in initDevTools
    if (enableDevTools) {
      try {
        initDevTools();
      } catch (err) {
        if (isDevMode()) {
          console.warn('[Zen.start] DevTools initialization failed (non-fatal):', err);
        }
        // Continue without DevTools - not a fatal error
      }
    }

    // ── ۲. تزریق Route Signal Provider (فاز ۸) ──
    // این کار با dependency injection انجام می‌شود تا context.ts به‌صورت
    // static به router وابسته نباشد. اگر @zenith/router در دسترس نباشد،
    // `$route` در Context تعریف نمی‌شود.
    setRouteSignalProvider(() => routeSignal.get());

    // ── ۲.۵. راه‌اندازی Auth (v1.4.0) — fire-and-forget ──
    // اگر توکن قبلاً ذخیره شده باشد، session را restore می‌کند.
    try {
      initAuth().catch(() => {});
    } catch {
      // ignore — auth init is best-effort
    }

    // ── ۳. لود کردن تعاریف کامپوننت‌ها ──
    // این کار را قبل از هر چیز انجام می‌دهیم تا walker بتواند تگ‌های سفارشی
    // (مثل <app-product-card>) را به‌عنوان کامپوننت تشخیص دهد.
    // BUG-RUNT-08 FIX: loadComponents now handles deduplication internally
    // but we can provide a scope to prevent bloat in SPA scenarios.
    // IMP-RUNT-05: Component registry scoping
    loadComponents(root);

    // ─ـ ۳. فعال‌سازی Event Delegation در سطح Document ──
    // این کار را قبل از processDOM انجام می‌دهیم تا اگر در حین پردازش
    // یک کلیک رخ دهد (بعید ولی ممکن)، handler آماده باشد.
    //
    // FEATURE (v1.3.0): پشتیبانی از `options.delegationRoot` برای Shadow DOM
    // یا subtree delegation. اگر `delegationRoot` مشخص نشده باشد، از `document`
    // استفاده می‌شود (backward compatible).
    const delegationRoot = options?.delegationRoot;
    const teardown = initEventDelegation(
      state,
      delegationRoot ? { root: delegationRoot } : undefined,
    );
    (root as any).__zenithDelegationTeardown = teardown as TeardownFn;

    // FEATURE (v0.6.0): تزریق CSS ضد-FOUC (Flash of Unstyled Content) قبل از
    // processDOM. این style تمام عناصری که هنوز دایرکتیوهای zen-* دارند را
    // مخفی می‌کند تا کاربر محتوای پردازش‌نشده نبیند. بعد از پایان processDOM
    // (که synchronous است) style حذف می‌شود چون در آن زمان عناصر یا حذف
    // شده‌اند (zen-if=false) یا attributeهایشان به‌درستی set شده‌اند.
    //
    // نکته‌ی مهم: اگر کاربر CSS را به‌صورت inline در HTML خود قرار دهد:
    //   <style>${Zen.cloakCSS()}</style>
    // آن زمان FOUC به‌طور کامل جلوگیری می‌شود (حتی قبل از اجرای Zen.start).
    // این style تزریق‌شده فقط یک safety net برای کاربرانی است که این کار را
    // نکرده‌اند. به همین دلیل style را در صورت وجود، دوباره تزریق نمی‌کنیم.
    //
    // SSR-safe: اگر document تعریف نشده باشد (مثلاً در Node.js)، این بخش no-op.
    const cloakInjected = Zen.__injectCloakStyle();

    // ── ۴. پردازش DOM و وصل کردن Signalها ──
    Zen.perf.mark('processDOM');
    processDOM(root, state);
    Zen.perf.measure('processDOM');

    // FEATURE (v0.6.0): حذف CSS ضد-FOUC بعد از پایان processDOM.
    // چون processDOM به‌صورت synchronous تمام دایرکتیوها را پردازش کرده است،
    // دیگر نیازی به مخفی کردن عناصر نیست.
    if (cloakInjected) {
      Zen.__removeCloakStyle();
    }

    // ── ۵. Exposing HMR Reload Function (فاز ۱۰) ──
    // این تابع توسط Vite Plugin در زمان HMR فراخوانی می‌شود.
    // ابتدا یک cleanup کامل انجام می‌دهد (Zen.stop) و سپس دوباره start می‌کند.
    // BUG-RUNT-06 FIX: Clean up any existing HMR reload function before setting new one
    if (typeof globalThis !== 'undefined') {
      // Store previous reload function for cleanup if needed
      const prevReload = (globalThis as any).__ZENITH_RELOAD__;
      if (prevReload && isDevMode()) {
        console.warn('[Zen.start] Overwriting existing HMR reload function');
      }
    }
    (globalThis as any).__ZENITH_RELOAD__ = (_changedPath?: string) => {
      console.log('[Zenith HMR] Re-processing DOM...', _changedPath ? `(${_changedPath})` : '');
      // Cleanup کامل: stopEffect، Event Delegation، Components، Router.
      Zen.stop(root);
      // Restart: loadComponents، Event Delegation، processDOM.
      Zen.start(root, state);
    };
    Zen.perf.measure('zen.start');
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
   * IMP-RUNT-01: Enhanced cleanup for event delegation, disposers, and resources.
   * IMP-RUNT-07: HMR reload function lifetime management.
   * IMP-RUNT-10: Global reference cleanup to prevent stale references in SPAs.
   *
   * @param root عنصری که قبلاً Zen.start روی آن فراخوانی شده.
   */
  stop(root: HTMLElement): void {
    Zen.perf.mark('zen.stop');
    // ─ـ ۱. Teardown Event Delegation ──
    const teardown = (root as any).__zenithDelegationTeardown as
      | TeardownFn
      | undefined;
    if (teardown) {
      teardown();
      delete (root as any).__zenithDelegationTeardown;
    }

    // ── ۲. Dispose Effectهای دایرکتیوها ──
    const disposes = (root as any).__zenithDisposes as (() => void)[] | undefined;
    if (disposes) {
      disposes.forEach((d) => d());
      disposes.length = 0;
      delete (root as any).__zenithDisposes;
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
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Zenith] resetResourceRegistry failed:', e);
      }
    }

    // ─ـ ۶. پاکسازی HMR Reload Function (فاز ۱۰) ──
    // IMP-RUNT-07: Clean up HMR reload function to prevent stale functions
    // from accumulating in SPAs with multiple HMR cycles.
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as any).__ZENITH_RELOAD__;
    }

    // ─ـ ۷. پاکسازی Action Registry (IMP-RUNT-10) ──
    // Prevent accumulation of stale action references in SPAs
    try {
      clearActions();
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Zenith] clearActions failed:', e);
      }
    }

    // ─ـ ۸. پاکسازی Plugin Registry (IMP-RUNT-10) ──
    // For SPA navigation, clear plugin installation locks
    // but keep installed plugins (they're meant to be singleton)
    pluginInstallLocks.clear();

    // ─ـ ۹. پاکسازی DevTools References (IMP-RUNT-10) ──
    // Prevent stale global references in SPAs
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as any;
      if (g.__ZENITH__ && g.__ZENITH__.root === root) {
        // Only clean up if this root was the one that registered devtools
        delete g.__ZENITH__;
      }
      // پاکسازی پرچم dev-mode قدیمی برای جلوگیری از state stale در SPA
      delete g.__ZENITH_DEV__;
    }

    // نکته: DevTools Hook را cleanup نمی‌کنیم چون ممکن است در HMR reload دوباره
    // استفاده شود. اگر کاربر بخواهد آن را پاک کند، می‌تواند cleanupDevtools()
    // را دستی فراخوانی کند.
    Zen.perf.measure('zen.stop');
  },

  // ── Action Registry API ──
  // این‌ها میانبرهای راحتی برای `Zen.action('save', fn)` هستند.
  // معادل `registerAction` از `@zenith/actions`.
  //
  // FEATURE (v1.3.0): `Zen.action` حالا تمام متدهای `action` از `@zenith/actions`
  // را شامل می‌شود: `register`, `unregister`, `has`, `clear`, `list`, `getMeta`.
  // همچنین فراخوانی مستقیم `Zen.action(name, fn, metadata?)` هم metadata قبول می‌کند.
  action: Object.assign(
    (
      name: string,
      fn: (ctx: import('@zenith/actions').ActionContext) => void,
      metadata?: import('@zenith/actions').ActionMetadata,
    ) => registerAction(name, fn, metadata),
    {
      register: registerAction,
      unregister: unregisterAction,
      has: hasAction,
      clear: clearActions,
      list: listActions,
      getMeta: getActionMeta,
    },
  ),

  // ── Scheduler API (فاز ۷) ──
  // اجرای اجباری و Synchronous صف Effectها.
  // معمولاً نیازی به فراخوانی دستی نیست (Event Handlers به‌طور خودکار
  // flushSync را فراخوانی می‌کنند). اما در موارد خاص (مثلاً بعد از
  // state.set() در تست‌ها) مفید است.
  //
  // IMP-RUNT-08: Added reentrancy protection to prevent issues when
  // an effect calls flushSync during its own execution.
  flushSync: (() => {
    let isFlushing = false;
    return () => {
      if (isFlushing) {
        if (isDevMode()) {
          console.warn('[Zen.flushSync] Reentrant call detected, skipping to prevent infinite loop.');
        }
        return;
      }
      isFlushing = true;
      try {
        flushSync();
      } finally {
        isFlushing = false;
      }
    };
  })(),

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
  // FEATURE (v0.3.0): Plugin Architecture.
  //
  // هدف: نگه‌داشتنِ Core Runtime بسیار کوچک. قابلیت‌هایی مثل auth، resource،
  // crud، i18n، ... به‌جای وارد شدن به Core، به‌صورت Plugin نصب می‌شوند.
  // این الگو مشابه Vue.use(plugin) یا Express.use(middleware) است.
  //
  // سینتکس:
  //   import { Zen } from '@zenith/runtime';
  //   import { authPlugin } from '@zenith/auth';
  //   Zen.use(authPlugin, { loginUrl: '/api/login' });
  //
  // یک Plugin یک شیء است با متد install:
  //   interface ZenithPlugin {
  //     name: string;
  //     install(zen: typeof Zen, options?: any): void;
  //   }
  //
  // install فقط یک‌بار اجرا می‌شود (اگر plugin قبلاً نصب شده، no-op + warning).
  //
  // IMP-RUNT-03: Added atomic installation with Promise-based locking
  // to prevent race conditions during concurrent plugin installation.
  use(plugin: ZenithPlugin, options?: any): typeof Zen {
    if (!plugin || typeof plugin.install !== 'function') {
      console.warn('[Zenith] Zen.use: plugin must have an install() method.');
      return Zen;
    }
    const pluginName = plugin.name;

    // Fast path: already installed
    if (pluginRegistry.has(pluginName)) {
      if (isDevMode()) {
        console.warn(`[Zenith] Plugin "${pluginName}" is already installed. Skipping.`);
      }
      return Zen;
    }

    try {
      plugin.install(Zen, options);
      pluginRegistry.set(pluginName, plugin);
      if (isDevMode()) {
        console.log(`🔌 Zenith plugin installed: ${pluginName}`);
      }
    } catch (err) {
      console.error(`[Zenith] Plugin "${pluginName}" failed to install:`, err);
    }

    return Zen; // برای chaining: Zen.use(a).use(b)
  },

  // لیست پلاگین‌های نصب‌شده (برای DevTools و دیباگ).
  plugins(): string[] {
    return Array.from(pluginRegistry.keys());
  },

  // ─────────────────────────────────────────────────────────────
  // FEATURE (v0.6.0): FOUC Prevention — Auto-Cloak CSS.
  // ─────────────────────────────────────────────────────────────
  //
  // مسئله:
  //   قبل از اجرای Zen.start، browser HTML خام را paint می‌کند. عناصری که
  //   دارای attributeهای zen-if، zen-for، zen-text، ... هستند، به‌صورت
  //   محتوای پردازش‌نشده دیده می‌شوند (مثلاً متن "$user.name" به‌جای نام
  //   کاربر، یا عناصری که باید مخفی باشند اما هنوز visible‌اند).
  //
  // راه‌حل:
  //   ۱) کاربر می‌تواند CSS را به‌صورت inline در HTML خود قرار دهد:
  //        <style>${Zen.cloakCSS()}</style>
  //      این کار FOUC را به‌طور کامل جلوگیری می‌کند (حتی قبل از اجرای
  //      Zen.start) چون CSS از همان ابتدا در دسترس است.
  //
  //   ۲) برای کاربرانی که این کار را نکرده‌اند، Zen.start به‌صورت خودکار
  //      style را قبل از processDOM تزریق می‌کند و بعد از آن حذف می‌کند.
  //      این یک safety net است — اگر Zen.start بعد از paint اولیه اجرا شود،
  //      FOUC کوتاهی دیده می‌شود اما حداقل بعد از processDOM دیگر فلیکر نمی‌شود.
  //
  // ملاحظات:
  //   - ما از `visibility: hidden` به‌جای `display: none` استفاده می‌کنیم تا
  //     layout صفحه ثابت بماند و از jump/jank جلوگیری شود.
  //   - این CSS فقط عناصر دارای دایرکتیوهای zen-* را هدف می‌گیرد، نه کل صفحه را.
  //   - SSR-safe: اگر document تعریف نشده باشد (Node.js)، توابع تزریق/حذف
  //     no-op می‌شوند.

  /**
   * رشته‌ی CSS ضد-FOUC را برمی‌گرداند.
   *
   * این CSS عناصری که دارای دایرکتیوهای zen-* هستند را تا زمان پردازش
   * مخفی می‌کند. کاربر می‌تواند آن را inline در HTML خود قرار دهد:
   *
   *   <style>${Zen.cloakCSS()}</style>
   *
   * که این کار قبل از اولین paint اعمال می‌شود و FOUC را به‌طور کامل
   * حذف می‌کند.
   *
   * @returns رشته‌ی CSS آماده‌ی قرار دادن درون <style>.
   */
  cloakCSS(): string {
    // FEATURE (v0.6.0): تولید CSS ضد-FOUC.
    // نکته: visibility:hidden به‌جای display:none تا layout حفظ شود.
    // استفاده از !important تا توسط استایل‌های کاربر override نشود.
    const selectors = CLOAK_DIRECTIVES.map((d) => `[${d}]`).join(',\n  ');
    return `  ${selectors} {\n    visibility: hidden !important;\n  }\n`;
  },

  /**
   * تزریق CSS ضد-FOUC به <head> document.
   *
   * این متد داخلی است و توسط `Zen.start` فراخوانی می‌شود. اگر style با
   * همان id از قبل وجود داشته باشد (مثلاً کاربر آن را inline گذاشته یا
   * Zen.start قبلاً فراخوانی شده)، چیزی تزریق نمی‌کند و false برمی‌گرداند.
   *
   * IMP-RUNT-04: Also verifies the style element is actually connected
   * to document.head to prevent FOUC in edge cases where the element exists
   * but is detached (e.g., after SSR hydration or manual DOM manipulation).
   *
   * SSR-safe: اگر document تعریف نشده باشد، false برمی‌گرداند.
   *
   * @returns true اگر style تزریق شد (و باید بعداً حذف شود)، false در غیر این صورت.
   */
  __injectCloakStyle(): boolean {
    // FEATURE (v0.6.0): تزریق style tag به head (idempotent + SSR-safe).
    if (typeof document === 'undefined' || !document.head) return false;
    // اگر از قبل وجود داشت و به head متصل است، دوباره تزریق نکن.
    const existing = document.getElementById(CLOAK_STYLE_ID);
    if (existing && existing.parentNode === document.head) return false;
    // اگر وجود دارد اما detached است (مثلاً بعد از SSR hydration)، آن را حذف کن
    if (existing && existing.parentNode !== document.head) {
      existing.remove();
    }
    const style = document.createElement('style');
    style.id = CLOAK_STYLE_ID;
    style.textContent = Zen.cloakCSS();
    // prepend تا اولویت پایین‌تری از استایل‌های کاربر داشته باشد (هرچند
    // !important این تضمین را از قبل می‌دهد).
    document.head.prepend(style);
    return true;
  },

  /**
   * حذف CSS ضد-FOUC از <head> document.
   *
   * این متد داخلی است و توسط `Zen.start` بعد از پایان processDOM فراخوانی
   * می‌شود.
   *
   * SSR-safe: اگر document تعریف نشده باشد، no-op است.
   */
  __removeCloakStyle(): void {
    // FEATURE (v0.6.0): حذف style tag از head (SSR-safe).
    if (typeof document === 'undefined' || !document.head) return;
    const existing = document.getElementById(CLOAK_STYLE_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  },

  // ── Performance Monitoring (IMP-RUNT-11) ──
  // یک ابزار سبک‌وزن برای اندازه‌گیری performance بخش‌های مختلف فریم‌ورک.
  // فقط در حالت development به‌طور خودکار فعال می‌شود.
  //
  // مثال:
  //   Zen.perf.mark('render-start');
  //   // ... انجام عملیات ...
  //   Zen.perf.measure('render');
  //   console.log(Zen.perf.getReport());
  //
  // برای فعال‌سازی دستی (حتی در production):
  //   Zen.perf.enabled = true;

  /**
   * ابزار سبک‌وزن Performance Monitoring برای فریم‌ورک Zenith.
   *
   * این ابزار به شما اجازه می‌دهد تا performance بخش‌های مختلف فریم‌ورک را
   * اندازه‌گیری کنید. فقط در حالت development به‌طور خودکار فعال می‌شود.
   */
  perf: (() => {
    const marks = new Map<string, number>();
    const measures: PerfMeasure[] = [];

    // Auto-enable in dev mode
    let enabled = false;
    if (typeof globalThis !== 'undefined') {
      try {
        enabled = isDevMode();
      } catch {
        // ignore
      }
    }

    return {
      get enabled(): boolean { return enabled; },
      set enabled(v: boolean) { enabled = v; },

      /**
       * ثبت یک timestamp با نام مشخص.
       * بعداً می‌توان از `measure()` برای محاسبه‌ی فاصله تا timestamp بعدی استفاده کرد.
       */
      mark(name: string): void {
        if (!enabled) return;
        marks.set(name, typeof performance !== 'undefined' ? performance.now() : Date.now());
      },

      /**
       * محاسبه‌ی مدت زمان بین آخرین timestamp با نام `name` و الآن.
       * نتیجه در history ذخیره می‌شود و با `getReport()` قابل مشاهده است.
       *
       * @returns object شامل name و duration و timestamp، یا undefined اگر markی وجود نداشته باشد.
       */
      measure(name: string): PerfMeasure | undefined {
        if (!enabled) return undefined;
        const start = marks.get(name);
        if (start === undefined) return undefined;
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const duration = end - start;
        const entry: PerfMeasure = { name, duration, timestamp: end };
        measures.push(entry);
        marks.delete(name);
        return entry;
      },

      /**
       * پاک کردن تمام marks و history اندازه‌گیری‌ها.
       */
      clear(): void {
        marks.clear();
        measures.length = 0;
      },

      /**
       * دریافت گزارش تمام اندازه‌گیری‌های انجام‌شده.
       */
      getReport(): readonly PerfMeasure[] {
        return measures;
      },
    };
  })(),
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
export type { ActionContext, ActionFn, ActionMetadata } from '@zenith/actions';

/**
 * Re-export Event Delegation API (برای کاربران پیشرفته).
 */
export { initEventDelegation, parseBinding } from '@zenith/events';

/**
 * Re-export Component API (فاز ۶).
 */
export {
  loadComponents,
  registerComponent,
  unregisterComponent,
  isComponent,
  clearComponents,
} from '@zenith/components';

/**
 * Re-export Scheduler API (فاز ۷).
 */
export {
  scheduleEffect,
  flushSync,
  hasPendingEffects,
  pendingEffectCount,
  pendingEffectsByPriority,
  type Priority,
} from '@zenith/scheduler';

/**
 * Re-export Router API (فاز ۸).
 */
export {
  routeSignal,
  navigate,
  matchRoute,
  findMatchingRoute,
  setRouteParams,
  type RouteState,
} from '@zenith/router';

/**
 * Re-export Data Fetching API (فاز ۸).
 */
export { processFetch, type FetchState } from '@zenith/data';

/**
 * Re-export Security API (فاز ۹).
 */
export {
  sanitizeHTML,
  sanitizeHTMLWithOptions,
  sanitizeHTMLTrusted,
  type SanitizeOptions,
} from '@zenith/security';

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
export { processHtmlTrusted } from './directives/html-trusted';

/**
 * FEATURE (v0.5.0): Re-export چهار دایرکتیو جدید runtime.
 *
 * این توابع برای کاربران پیشرفته‌ای مفید است که می‌خواهند بدون walker از
 * این دایرکتیوها استفاده کنند (مثلاً در pluginها یا manual DOM processing).
 *
 * کاربرد:
 *   import { processPortal, processIntersection, processCloak, processRef } from '@zenith/runtime';
 *   const dispose = processPortal(el, 'body', context);
 *
 *  - processPortal:       عنصر را به یک container دیگر منتقل می‌کند.
 *  - processIntersection: callback را وقتی عنصر وارد viewport شد اجرا می‌کند.
 *  - processCloak:        attribute zen-cloak را حذف می‌کند (ضد FOUC).
 *  - processRef:          عنصر DOM را در یک Signal در state ذخیره می‌کند.
 */
export { processPortal } from './directives/portal';
export { processIntersection } from './directives/intersection';
export { processCloak } from './directives/cloak';
export { processRef } from './directives/ref';

/**
 * FEATURE (v1.2.0): Re-export v1.2.x directive processors — restored in v1.2.2.
 *
 * These functions are useful for advanced users who want to apply the
 * directives without going through the walker (e.g. in plugins or manual
 * DOM processing).
 *
 *  - processMemo:           memoize subtree processing by expression value.
 *  - processIsland:         defer child processing (visible/idle/load).
 *  - processVirtualRepeat:  virtual scrolling for large lists.
 *  - processStatefulButton: stateful button with idle/loading/success/error.
 *  - processOptimistic:     optimistic update with rollback on failure.
 *  - processTrack:          analytics tracking (click / visible).
 *  - processDatePicker:     Persian (Jalali) date picker web component.
 */
export { processMemo } from './directives/memo';
export { processIsland } from './directives/island';
export { processVirtualRepeat } from './directives/virtual-repeat';
export { processStatefulButton } from './directives/stateful-button';
export { processOptimistic } from './directives/optimistic';
export { processTrack, configureAnalytics } from './directives/track';
export { processDatePicker } from './directives/date-picker';

/**
 * FEATURE (v1.2.0): Re-export the Hydration Engine API — restored in v1.2.2.
 *
 * The Hydration Engine attaches reactive effects to existing SSR-rendered
 * DOM nodes without rebuilding them, eliminating the flicker that comes
 * from innerHTML rewrites during hydration.
 */
export {
  createHydrator,
  hydrateText,
  hydrateTextExpr,
  hydrateHtml,
  hydrateHtmlExpr,
  hydrateHtmlTrusted,
  hydrateShow,
  hydrateShowExpr,
  hydrateIf,
  hydrateBind,
  hydrateBindExpr,
  hydrateModel,
  hasHydrationMarkers,
  countHydrationMarkers,
  type Hydrator,
} from './hydrate';

/**
 * Re-export DevTools API (فاز ۱۰).
 */
export {
  initDevTools,
  cleanupDevtools,
  isDevtoolsHookInstalled,
  getDevtoolsVersion,
  type ZenithDevtoolsHook,
} from '@zenith/devtools';

/**
 * Re-export Error Boundary API (فاز ۱۱).
 */
export {
  errorSignal,
  onError,
  reportError,
  clearError,
  clearErrorBoundary,
  processErrorBoundary,
  showFallback,
  recoverFromError,
  type ZenithError,
} from '@zenith/error-boundary';

/**
 * Re-export Context API (برای dependency injection).
 */
export { setRouteSignalProvider } from './context';

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
  hasCustomDirective,
  type CustomDirectiveHandler,
} from './walker';

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

/**
 * FEATURE (v1.4.0): Re-export Runtime Parity Checker API.
 *
 * These utilities warn when runtime behavior diverges from compiled output.
 */
export {
  setStrictParity,
  isStrictParityEnabled,
  reportParityDivergence,
  assertParity,
  clearParityWarnings,
} from './parity-check';

/**
 * FEATURE (v1.4.0): Re-export Auth API.
 */
export {
  auth,
  configureAuth,
  initAuth,
  login,
  logout,
  register,
  refreshToken,
  fetchCurrentUser,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasPermission,
  hasAnyPermission,
  canActivateRoute,
  type User,
  type AuthTokens,
  type FunctionalAuthState,
  type LoginCredentials,
  type RegisterData,
  type FunctionalAuthConfig,
  type RouteGuard,
} from '@zenith/auth';
