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

import type { CacheStrategyName } from './strategies.js';

// NOTE: نوع ZenithPlugin را به‌صورت structural تعریف می‌کنیم تا از وابستگیِ
// compile-time به @zenith/runtime جلوگیری شود. در صورت نیاز کاربر می‌تواند
// واقعی import کند و این شیء به‌عنوان ZenithPlugin استفاده شود.
interface ZenithPluginStructural {
  name: string;
  install: (zen: any, options?: any) => void;
}

/**
 * FEATURE (v0.4.0): پیکربندی یک route در main-thread API.
 *
 * این ساختار معادل RouteMatcher در SW است، اما بدون استراتژی اینجا — فقط
 * برای ارسال به SW از طریق تنظیمات (که خود SW آن‌ها را از فایل sw.js می‌خواند).
 */
export interface RouteConfig {
  /** الگوی URL. regex یا string. */
  urlPattern: RegExp | string;
  /** متد HTTP برای تطبیق. */
  method?: string;
  /** استراتژی کش. */
  strategy: CacheStrategyName;
  /** نام cache. */
  cacheName?: string;
  /** timeout برای networkFirst. */
  timeout?: number;
}

/**
 * FEATURE (v0.4.0): پیکربندی Service Worker از دید main thread.
 *
 * این شیء به `ZenithSWPlugin` داده می‌شود و توسط `registerSW` برای ثبت SW
 * استفاده می‌شود. علاوه بر این، فایل SW باید با همان routes تنظیم شود.
 *
 * نمونه:
 *   const config: SWConfig = {
 *     swUrl: '/sw.js',
 *     precache: ['/', '/index.html', '/app.js'],
 *     routes: [
 *       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users' },
 *       { urlPattern: /\/assets\//,  strategy: 'cacheFirst',  cacheName: 'assets' },
 *     ],
 *     defaultStrategy: 'networkOnly',
 *   };
 */
export interface SWConfig {
  /** URL فایل SW. پیش‌فرض: '/sw.js'. */
  swUrl?: string;
  /** scope ثبت SW. پیش‌فرض: '/' . */
  scope?: string;
  /** لیست routes. */
  routes: RouteConfig[];
  /** لیست URLهایی که باید pre-cache شوند. */
  precache: string[];
  /** استراتژی پیش‌فرض برای requestهای unmatched. پیش‌فرض: 'networkOnly'. */
  defaultStrategy?: CacheStrategyName;
  /** آیا به‌محض آپدیت، skipWaiting کنیم؟ پیش‌فرض: false. */
  skipWaiting?: boolean;
  /** آیا clients.claim در activate کنیم؟ پیش‌فرض: false. */
  clientsClaim?: boolean;
}

/**
 * FEATURE (v0.4.0): Controller — شیء برگشتی از registerSW.
 *
 * به کاربر اجازه می‌دهد update/unregister را صدا بزند و listenerها را پاک کند.
 */
export interface SWController {
  /** نمونه‌ی ServiceWorkerRegistration (در صورت موفقیت). */
  registration: ServiceWorkerRegistration | null;
  /** بررسی برای آپدیت. */
  update: () => Promise<boolean>;
  /** لغو ثبت SW. */
  unregister: () => Promise<boolean>;
  /** فرمان skipWaiting به SW در انتظار. */
  skipWaiting: () => void;
  /** پاک کردن listenerها (در teardown). */
  destroy: () => void;
  /** آیا SW پشتیبانی می‌شود؟ */
  supported: boolean;
}

/**
 * FEATURE (v0.4.0): Options برای registerSW.
 */
export interface RegisterSWOptions {
  /** scope ثبت. */
  scope?: string;
  /** Callback وقتی آپدیت SW پیدا شد. */
  onUpdateFound?: (registration: ServiceWorkerRegistration) => void;
  /** Callback وقتی SW جدید کنترل صفحه را به‌دست گرفت (بعد از reload). */
  onControllerChange?: (controller: ServiceWorker | null) => void;
  /** Callback وقتی خطای ثبت رخ داد. */
  onError?: (err: Error) => void;
}

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
 */
export function registerSW(
  swUrl: string = '/sw.js',
  options: RegisterSWOptions = {},
): SWController | void {
  // SECURITY (v0.5.0): SSR guard — در Node.js/SSR `window` تعریف نشده است.
  // تابع بدون خطا return می‌کند تا import در SSR safe باشد.
  if (typeof window === 'undefined') return; // SSR guard
  // SECURITY (v0.5.0): اگر مرورگر SW پشتیبانی نمی‌کند، هشدار بده و return کن.
  if (!('serviceWorker' in navigator)) {
    console.warn('[Zenith SW] Service Workers not supported.');
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
      skipWaiting: () => { /* no-op */ },
      destroy: () => { /* no-op */ },
    };
  }

  const sw = navigator.serviceWorker;
  const listeners: Array<{ type: string; fn: EventListenerOrEventListenerObject }> = [];

  let registration: ServiceWorkerRegistration | null = null;

  // FEATURE (v0.4.0): controllerchange — وقتی SW جدید کنترل را به‌دست می‌گیرد.
  const onControllerChange = () => {
    if (options.onControllerChange) {
      options.onControllerChange(sw.controller);
    }
  };
  sw.addEventListener('controllerchange', onControllerChange);
  listeners.push({ type: 'controllerchange', fn: onControllerChange as EventListener });

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
      listeners.push({ type: 'updatefound', fn: onUpdateFound as EventListener });
    })
    .catch((err) => {
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.error('[Zenith SW] registration failed:', err);
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
        console.error('[Zenith SW] update failed:', err);
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
        console.error('[Zenith SW] unregister failed:', err);
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
export async function unregisterSW(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.serviceWorker === 'undefined'
  ) {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return false;
    let allOk = true;
    for (const reg of regs) {
      const ok = await reg.unregister();
      if (!ok) allOk = false;
    }
    return allOk;
  } catch (err) {
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
export async function updateSW(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.serviceWorker === 'undefined'
  ) {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return false;
    let anyOk = false;
    for (const reg of regs) {
      try {
        await reg.update();
        anyOk = true;
      } catch (err) {
        // ignore individual registration errors
      }
    }
    return anyOk;
  } catch (err) {
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
export const zenithSWPlugin: ZenithPluginStructural = {
  name: 'zenith-service-worker',
  install: (zen: any, options?: any): void => {
    const config: SWConfig = (options as SWConfig) || {
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
