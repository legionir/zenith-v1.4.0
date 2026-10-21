import type { registerAction, unregisterAction, hasAction, clearActions, listActions, getActionMeta } from '@zenith/actions';
import type { onError, getErrorHistory, ErrorHandler } from '@zenith/state';
import type { ZenithError } from '@zenith/errors';
import type { notificationsAPI } from '@zenith/notifications';
import type { auth } from './auth-api';
import type { navigate, routeSignal } from '@zenith/router';
/** Public legacy runtime shape. @public */
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
/** Public legacy runtime shape. @public */
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

/** Public legacy runtime shape. @public */
export interface ZenithPlugin {
  /** نام یکتای پلاگین (برای جلوگیری از نصب مجدد). */
  name: string;
  /** یک‌بار توسط Zen.use فراخوانی می‌شود. */
  install: (zen: ZenApi, options?: unknown) => void;
}

/** Public legacy runtime shape. @public */
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

/** Public legacy runtime shape. @public */
export interface ZenApi {
  onError: typeof onError;
  getErrors: typeof getErrorHistory;
  reportError: (message: string, options?: Partial<ZenithError>) => void;
  notify: typeof notificationsAPI.notify;
  toasts: typeof notificationsAPI.toasts;
  alert: typeof notificationsAPI.alert;
  confirm: typeof notificationsAPI.confirm;
  auth: typeof auth;
  start(root: HTMLElement, state?: Record<string, unknown>, options?: ZenStartOptions): void;
  // #116/DEC-032: `stop` فعل خاموش‌کردن کامل اپ است (teardown سند + فراخوانی
  // disposeها) — نه چرخهٔ عمر یک نمونه؛ در گیت cleanup-hygiene allowlist شده.
  stop(root: HTMLElement): void;
  action: ReturnType<
    typeof Object.assign<
      typeof registerAction,
      {
        register: typeof registerAction;
        unregister: typeof unregisterAction;
        has: typeof hasAction;
        clear: typeof clearActions;
        list: typeof listActions;
        getMeta: typeof getActionMeta;
      }
    >
  >;
  flushSync: () => void;
  navigate: typeof navigate;
  route: typeof routeSignal;
  use(plugin: ZenithPlugin, options?: unknown): ZenApi;
  plugins(): string[];
  cloakCSS(): string;
  __injectCloakStyle(): boolean;
  __removeCloakStyle(): void;
  perf: ZenPerf;
}
