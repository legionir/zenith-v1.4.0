import { clearComponents } from '@zenith/components';
import { cleanupRouter } from '@zenith/router';
import { resetResourceRegistry } from '@zenith/resource';
import { clearActions } from '@zenith/actions';
import { logger } from '@zenith/logger';
import { clearPluginInstallLocks } from './plugins';
import type { ZenApi } from './api-types';
import type { ZenithRootElement, ZenithReloadGlobal, ZenithDevtoolsGlobal } from './host-types';
/** Retain legacy document-level stop order; App.dispose is a separate API. @internal */
export function stopRuntime(api: ZenApi, root: HTMLElement): void {

    api.perf.mark('zen.stop');
    // ─ـ ۱. Teardown Event Delegation ──
    const teardown = (root as ZenithRootElement).__zenithDelegationTeardown;
    if (teardown) {
      teardown();
      delete (root as ZenithRootElement).__zenithDelegationTeardown;
    }

    // ── ۲. Dispose Effectهای دایرکتیوها ──
    const disposes = (root as ZenithRootElement).__zenithDisposes;
    if (disposes) {
      disposes.forEach((d) => d());
      disposes.length = 0;
      delete (root as ZenithRootElement).__zenithDisposes;
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
    // قبلاً resetResourceRegistry وجود داشت اما در api.stop فراخوانی نمی‌شد.
    // این باعث نشت حافظه‌ی resource در SPA می‌شد: هر بار که کاربر بین صفحات
    // ناوبری می‌کرد، Resourceهای قبلی در registry باقی می‌ماندند.
    // حالا در api.stop پاکسازی می‌شوند تا حافظه آزاد شود.
    try {
      resetResourceRegistry();
    } catch (e) {
      logger.error(
        `[Zenith] resetResourceRegistry failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // ─ـ ۶. پاکسازی HMR Reload Function (فاز ۱۰) ──
    // IMP-RUNT-07: Clean up HMR reload function to prevent stale functions
    // from accumulating in SPAs with multiple HMR cycles.
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as ZenithReloadGlobal).__ZENITH_RELOAD__;
    }

    // ─ـ ۷. پاکسازی Action Registry (IMP-RUNT-10) ──
    // Prevent accumulation of stale action references in SPAs
    try {
      clearActions();
    } catch (e) {
      logger.error(`[Zenith] clearActions failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ─ـ ۸. پاکسازی Plugin Registry (IMP-RUNT-10) ──
    // For SPA navigation, clear plugin installation locks
    // but keep installed plugins (they're meant to be singleton)
    clearPluginInstallLocks();

    // ─ـ ۹. پاکسازی DevTools References (IMP-RUNT-10) ──
    // Prevent stale global references in SPAs
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as ZenithDevtoolsGlobal;
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
    api.perf.measure('zen.stop');
  }
