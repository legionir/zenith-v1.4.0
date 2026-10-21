// packages/service-worker/src/sw-register.ts
//
// ثبت Service Worker — استخراج مکانیکی از index.ts، بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { s, validate } from '@zenith/schema';
import { logger } from '@zenith/logger';
import type { RegisterSWOptions, SWController } from './sw-types';
import { registerSWOptions } from './sw-options';


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
 *
 * @param swUrl   URL فایل SW (مثل '/sw.js').
 * @param options گزینه‌های ثبت.
 * @returns Controller برای کنترل SW (یا `undefined` در SSR).
 * @public
 */
export function registerSW(
  swUrl: string = '/sw.js',
  options: RegisterSWOptions = {},
): SWController | void {
  // #52 — اعتبارسنجی در مرز ورودی پیش از SSR guard
  validate(s.string({ min: 1 }), swUrl, { name: 'registerSW.swUrl' });
  const resolvedOptions = registerSWOptions.resolve(options);

  // SECURITY (v0.5.0): SSR guard — در Node.js/SSR `window` تعریف نشده است.
  // تابع بدون خطا return می‌کند تا import در SSR safe باشد.
  if (typeof window === 'undefined') return; // SSR guard
  // SECURITY (v0.5.0): اگر مرورگر SW پشتیبانی نمی‌کند، هشدار بده و return کن.
  if (!('serviceWorker' in navigator)) {
    logger.warn('[Zenith SW] Service Workers not supported.');
    return;
  }

  // Guard: محیط غیر مرورگری یا مرورگر بدون SW.
  const hasSW =
    typeof navigator !== 'undefined' &&
    typeof navigator.serviceWorker !== 'undefined' &&
    typeof navigator.serviceWorker.register === 'function';

  if (!hasSW) {
    return {
      registration: null,
      supported: false,
      update: async () => false,
      unregister: async () => false,
      skipWaiting: () => {
        /* no-op */
      },
      dispose: () => {
        /* no-op */
      },
      /**
       * @deprecated #116 — نام قدیمی؛ از `dispose()` استفاده کن
       * (ZEN-DEPR-024؛ حذف در ۲.۰ — DEC-026).
       */
      destroy: () => {
        deprecate('ZEN-DEPR-024', 'SWController.destroy()', 'SWController.dispose()');
        /* no-op */
      },
    };
  }

  const sw = navigator.serviceWorker;
  const listeners: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];

  let registration: ServiceWorkerRegistration | null = null;

  // FEATURE (v0.4.0): controllerchange — وقتی SW جدید کنترل را به‌دست می‌گیرد.
  const onControllerChange = () => {
    if (resolvedOptions.onControllerChange) {
      resolvedOptions.onControllerChange(sw.controller);
    }
  };
  sw.addEventListener('controllerchange', onControllerChange);
  listeners.push({ type: 'controllerchange', fn: onControllerChange as EventListener });

  // ثبت واقعی SW.
  sw.register(swUrl, { scope: resolvedOptions.scope || '/' })
    .then((reg) => {
      registration = reg;

      // FEATURE (v0.4.0): updatefound — وقتی SW جدیدی در حال نصب است.
      const onUpdateFound = () => {
        if (resolvedOptions.onUpdateFound) {
          resolvedOptions.onUpdateFound(reg);
        }
      };
      reg.addEventListener('updatefound', onUpdateFound);
      listeners.push({ type: 'updatefound', fn: onUpdateFound as EventListener });
    })
    .catch((err) => {
      if (resolvedOptions.onError) {
        resolvedOptions.onError(err instanceof Error ? err : new Error(String(err)));
      } else {
        logger.error(
          `[Zenith SW] registration failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

  return {
    get registration() {
      return registration;
    },
    supported: true,
    update: async () => {
      if (!registration) return false;
      try {
        await registration.update();
        return true;
      } catch (err) {
        logger.error(
          `[Zenith SW] update failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return false;
      }
    },
    unregister: async () => {
      if (!registration) return false;
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
      } catch (err) {
        logger.error(
          `[Zenith SW] unregister failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return false;
      }
    },
    skipWaiting: () => {
      // FEATURE (v0.4.0): ارسال پیام skipWaiting به SW در حالت waiting.
      const waiting = registration?.waiting;
      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if (sw.controller) {
        sw.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    },
    dispose: () => {
      // #116: idempotent — listeners.length = 0 دوباره بی‌اثر است.
      for (const { type, fn } of listeners) {
        sw.removeEventListener(type, fn);
        if (registration) {
          registration.removeEventListener(type, fn);
        }
      }
      listeners.length = 0;
    },
    /**
     * @deprecated #116 — نام قدیمی؛ از `dispose()` استفاده کن
     * (ZEN-DEPR-024؛ حذف در ۲.۰ — DEC-026).
     */
    destroy: () => {
      deprecate('ZEN-DEPR-024', 'SWController.destroy()', 'SWController.dispose()');
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
