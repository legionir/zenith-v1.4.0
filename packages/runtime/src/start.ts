import { processDOM } from './walker';
import { setRouteSignalProvider } from './context';
import { initEventDelegation, setLinkNavigationHandler } from '@zenith/events';
import { loadComponents } from '@zenith/components';
import { navigate, routeSignal } from '@zenith/router';
import { initDevTools, exposeDevToolsAPI } from '@zenith/devtools';
import { onError, setDevMode, emitError } from '@zenith/state';
import { ZenithError, ErrorCode } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { initAuth } from './auth-api';
import { setStrictParity } from './parity-check';
import { zenStartOptions } from './options';
import { isDevMode } from './dev-mode';
import type { ZenApi, ZenStartOptions } from './api-types';
import type { ZenithRootElement, ZenithReloadGlobal } from './host-types';
/** Private start operands; this helper is not a public positional API. @internal */
export interface StartInput { root: HTMLElement; state?: Record<string, unknown>; options?: ZenStartOptions; }
/** Execute the existing synchronous start sequence against the canonical API. @internal */
export function startRuntime(api: ZenApi, input: StartInput): void {
  const { root, state = {} } = input;
  let { options } = input;

    api.perf.mark('zen.start');
    // IMP-RUNT-06: Enhanced error message with helpful debugging hints
    if (!root) {
      throw new ZenithError({
        code: ErrorCode.RUNTIME_ZEN_IF_NO_PARENT,
        category: 'Runtime',
        message:
          '[Zen.start] Root element is required.\n' +
          '  Common causes:\n' +
          '  - DOM not fully loaded: Ensure Zen.start runs after DOMContentLoaded or place script at end of body.\n' +
          '  - Selector mismatch: Check document.getElementById("app") matches your HTML element ID.\n' +
          '  - SSR hydration: In SSR, ensure the root element exists in the hydrated HTML.',
      });
    }

    // #52 — اعتبارسنجی گزینه‌های api.start در مرز ورودی (ZEN-1001/1002/1004)
    const resolvedOptions = zenStartOptions.resolve(options);
    options = resolvedOptions;

    // BUG-RUNT-05 FIX: If start was already called on this root without stop,
    // clean up the previous instance first to prevent resource leaks.
    const existingTeardown = (root as ZenithRootElement).__zenithDelegationTeardown;
    if (existingTeardown) {
      if (isDevMode()) {
        // #39: logger مرکزی — گاید isDevMode بیرونی نگه داشته شد (flip زمان‌اجرا در تست).
        logger.warn(
          '[Zen.start] Root element already has an active Zen instance. Stopping previous instance first.',
        );
      }
      // Run the previous teardown to clean up event delegation
      try {
        existingTeardown();
      } catch (e) {
        if (isDevMode()) {
          logger.warn(
            `[Zen.start] Error during previous instance teardown: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      // Also dispose previous effects
      const existingDisposes = (root as ZenithRootElement).__zenithDisposes;
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
            // #39: assert → logger.warn (همان معنا: فقط وقتی match=false چاپ).
            if (!match) {
              logger.warn('[Zenith] Hydration mismatch: client and server state differ');
            }
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
      logger.info('🚀 Zenith Framework is starting...');
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
          logger.warn(
            `[Zen.start] DevTools initialization failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        // Continue without DevTools - not a fatal error
      }
    }

    // ── ۲. تزریق Route Signal Provider (فاز ۸) ──
    // این کار با dependency injection انجام می‌شود تا context.ts به‌صورت
    // static به router وابسته نباشد. اگر @zenith/router در دسترس نباشد،
    // `$route` در Context تعریف نمی‌شود.
    setRouteSignalProvider(() => routeSignal.get());
    setLinkNavigationHandler(navigate);

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
    (root as ZenithRootElement).__zenithDelegationTeardown = teardown;

    // FEATURE (v0.6.0): تزریق CSS ضد-FOUC (Flash of Unstyled Content) قبل از
    // processDOM. این style تمام عناصری که هنوز دایرکتیوهای zen-* دارند را
    // مخفی می‌کند تا کاربر محتوای پردازش‌نشده نبیند. بعد از پایان processDOM
    // (که synchronous است) style حذف می‌شود چون در آن زمان عناصر یا حذف
    // شده‌اند (zen-if=false) یا attributeهایشان به‌درستی set شده‌اند.
    //
    // نکته‌ی مهم: اگر کاربر CSS را به‌صورت inline در HTML خود قرار دهد:
    //   <style>${api.cloakCSS()}</style>
    // آن زمان FOUC به‌طور کامل جلوگیری می‌شود (حتی قبل از اجرای api.start).
    // این style تزریق‌شده فقط یک safety net برای کاربرانی است که این کار را
    // نکرده‌اند. به همین دلیل style را در صورت وجود، دوباره تزریق نمی‌کنیم.
    //
    // SSR-safe: اگر document تعریف نشده باشد (مثلاً در Node.js)، این بخش no-op.
    const cloakInjected = api.__injectCloakStyle();

    // ── ۴. پردازش DOM و وصل کردن Signalها ──
    api.perf.mark('processDOM');
    processDOM(root, state);
    api.perf.measure('processDOM');

    // FEATURE (v0.6.0): حذف CSS ضد-FOUC بعد از پایان processDOM.
    // چون processDOM به‌صورت synchronous تمام دایرکتیوها را پردازش کرده است،
    // دیگر نیازی به مخفی کردن عناصر نیست.
    if (cloakInjected) {
      api.__removeCloakStyle();
    }

    // ── ۵. Exposing HMR Reload Function (فاز ۱۰) ──
    // این تابع توسط Vite Plugin در زمان HMR فراخوانی می‌شود.
    // ابتدا یک cleanup کامل انجام می‌دهد (api.stop) و سپس دوباره start می‌کند.
    // BUG-RUNT-06 FIX: Clean up any existing HMR reload function before setting new one
    if (typeof globalThis !== 'undefined') {
      // Store previous reload function for cleanup if needed
      const prevReload = (globalThis as ZenithReloadGlobal).__ZENITH_RELOAD__;
      if (prevReload && isDevMode()) {
        logger.warn('[Zen.start] Overwriting existing HMR reload function');
      }
    }
    (globalThis as ZenithReloadGlobal).__ZENITH_RELOAD__ = (_changedPath?: string) => {
      logger.debug(`[Zenith HMR] Re-processing DOM...${_changedPath ? ` (${_changedPath})` : ''}`);
      // Cleanup کامل: stopEffect، Event Delegation، Components، Router.
      api.stop(root);
      // Restart: loadComponents، Event Delegation، processDOM.
      api.start(root, state);
    };
    api.perf.measure('zen.start');
  }
