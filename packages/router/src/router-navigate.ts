// packages/router/src/router-navigate.ts
//
// هسته stateful مسیریاب (navigate، guards، scroll، popstate، cleanup) —
// استخراج مکانیکی از router.ts، بدون تغییر رفتار (#40).

import { browserRouteSignal, routeSignal } from './route-state';


/**
 * تغییر مسیر بدون رفرش صفحه.
 *
 * این تابع:
 *   1) `history.pushState` را فراخوانی می‌کند تا URL مرورگر عوض شود.
 *   2) `routeSignal` را آپدیت می‌کند تا تمام Effectهای وابسته (مثل
 *      `<zen-router>`) دوباره اجرا شوند.
 *
 * در SSR (داخل runWithRoute)، این تابع فقط context signal را آپدیت می‌کند
 * (history.pushState فراخوانی نمی‌شود چون window وجود ندارد).
 *
 * @param path مسیر جدید (مثل `/products/101`).
 */
// IMP-RTR-01 (v1.3.0): Navigation guards. Each guard receives the target
// URL and the current URL. To allow navigation, return true. To redirect,
// return a string (the redirect target). To block navigation, return false
// or a falsy value (other than true or a string).
export type NavigationGuard = (
  to: string,
  from: string,
) => boolean | string | Promise<boolean | string>;

/** #126: هوک پس از ناوبری موفق (`afterEach`). */
export type NavigationAfterHook = (to: string, from: string) => void | Promise<void>;

/** #126: موقعیت اسکرول صفحه. */
export interface ScrollPosition {
  left: number;
  top: number;
}

/** #126: تابع رفتار اسکرول هنگام تغییر مسیر. */
export type ScrollBehaviorFn = (
  to: string,
  from: string,
  savedPosition: ScrollPosition | null,
) => ScrollPosition | { el: string; behavior?: ScrollBehavior } | false | null | undefined;

const _guards: NavigationGuard[] = [];
const _afterHooks: NavigationAfterHook[] = [];
const _savedScrollPositions = new Map<string, ScrollPosition>();
let _scrollBehavior: ScrollBehaviorFn | null = null;

/**
 * #126: ثبت هوک `afterEach` که پس از هر تغییر مسیر موفق فراخوانی می‌شود.
 * @returns تابع `Cleanup` idempotent برای حذف هوک.
 */
export function afterEach(hook: NavigationAfterHook): () => void {
  _afterHooks.push(hook);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const idx = _afterHooks.indexOf(hook);
    if (idx !== -1) _afterHooks.splice(idx, 1);
  };
}

/**
 * #126: تنظیم رفتار اسکرول هنگام ناوبری (`scrollBehavior(to, from, savedPosition)`).
 * @returns تابع `Cleanup` idempotent برای بازنشانی رفتار اسکرول.
 */
export function setScrollBehavior(fn: ScrollBehaviorFn | null): () => void {
  _scrollBehavior = fn;
  let cleared = false;
  return () => {
    if (cleared) return;
    cleared = true;
    if (_scrollBehavior === fn) {
      _scrollBehavior = null;
    }
  };
}

function applyScrollBehavior(to: string, from: string, savedPosition: ScrollPosition | null): void {
  if (!_scrollBehavior || typeof window === 'undefined') return;
  const target = _scrollBehavior(to, from, savedPosition);
  if (!target) return;
  if ('el' in target) {
    if (typeof document !== 'undefined') {
      const el = document.querySelector(target.el);
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        (el as HTMLElement).scrollIntoView({ behavior: target.behavior ?? 'auto' });
      }
    }
    return;
  }
  if (typeof window.scrollTo === 'function') {
    window.scrollTo(target.left ?? 0, target.top ?? 0);
  }
}

function runAfterHooks(to: string, from: string): void {
  for (const hook of [..._afterHooks]) {
    try {
      void hook(to, from);
    } catch {
      // ignore individual hook errors
    }
  }
}

/**
 * IMP-RTR-01 (v1.3.0): Register a navigation guard that runs before every
 * navigate() call. Guards are executed in registration order. If any guard
 * returns:
 *   - `true`       → allow navigation to proceed.
 *   - `string`     → redirect to that URL (guard chain stops).
 *   - `false`/falsy → block navigation entirely.
 *
 * @param guard A NavigationGuard function.
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که این guard را
 *           از زنجیره حذف می‌کند (خروجی قبلاً void بود — سازگار، چون
 *           فراخوان‌های موجود مقدار بازگشتی را نادیده می‌گیرند).
 */
export function beforeEach(guard: NavigationGuard): () => void {
  _guards.push(guard);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const idx = _guards.indexOf(guard);
    if (idx !== -1) _guards.splice(idx, 1);
  };
}

export interface NavigateOptions {
  /** IMP-RTR-02 (v1.3.0): Use history.replaceState instead of pushState.
   *  This replaces the current history entry rather than pushing a new one.
   *  Useful for redirect-after-login flows where the login page should not
   *  appear in the browser's back-stack. */
  replace?: boolean;
  /** #126: اجرای تغییر مسیر داخل انتقال صفحه (با رعایت prefers-reduced-motion). */
  transition?: boolean;
}

export async function navigate(path: string, options?: NavigateOptions): Promise<void> {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    // در محیط غیر مرورگر (SSR یا تست‌های Node): فقط Signal را آپدیت کن.
    // routeSignal proxy به‌طور خودکار به context فعلی (اگر موجود) می‌رود.
    // FIX (v1.2.3): clean path — search و hash را از path ورودی جدا کن.
    const prevPath = routeSignal.get().path;
    const cleanPath = path.split('?')[0]!.split('#')[0]!;
    routeSignal.set({ path: cleanPath, params: {} });
    runAfterHooks(cleanPath, prevPath);
    return;
  }

  // FIX (v1.2.3): مسیر فعلی را با pathname + search + hash مقایسه کن. قبلاً فقط
  // pathname مقایسه می‌شد، در نتیجه navigate به همان صفحه ولی با query متفاوت
  // skip می‌شد (مثلاً navigate('/users?tab=posts') وقتی صفحه‌ی /users بود).
  // IMP-RTR-01 (v1.3.0): Run navigation guards before any actual navigation.
  // If a guard redirects (returns a string), we redirect instead. If a guard
  // blocks (returns false), we stop entirely.
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  for (const guard of _guards) {
    const result = await guard(path, currentPath);
    if (result === false) return; // block
    if (typeof result === 'string' && result !== path) {
      return navigate(result, { ...options, replace: true }); // redirect (replace to avoid redirect loop in back-stack)
    }
  }

  const currentFull = currentPath;
  if (currentFull === path) return;

  // FIX (v1.2.7): hash-only navigation should not trigger a full re-render.
  // If pathname+search are unchanged and only the hash differs, we just
  // pushState so the browser can scroll to the anchor — routeSignal is
  // left untouched and <zen-router> does not re-fetch / re-render. We use
  // `new URL(path, base)` for robust parsing (handles relative paths,
  // query strings, and bare `#fragment` inputs uniformly).
  let targetUrl: URL | null = null;
  try {
    targetUrl = new URL(path, window.location.href);
  } catch {
    targetUrl = null;
  }
  if (
    targetUrl &&
    targetUrl.pathname === window.location.pathname &&
    targetUrl.search === window.location.search
  ) {
    if (options?.replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    return;
  }

  // IMP-RTR-02 (v1.3.0): Support replace:true option — uses
  // history.replaceState instead of pushState so the current entry
  // is overwritten rather than pushed onto the history stack.
  _savedScrollPositions.set(currentFull, {
    left: typeof window.scrollX === 'number' ? window.scrollX : 0,
    top: typeof window.scrollY === 'number' ? window.scrollY : 0,
  });

  if (options?.replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  // FIX (v1.2.3): clean path را در routeSignal ذخیره کن (بدون search/hash).
  // outlet و matchRoute فقط با pathname کار می‌کنند و نباید query در آن برود.
  const cleanPath = path.split('?')[0]!.split('#')[0]!;
  const commitRoute = () => {
    routeSignal.set({ path: cleanPath, params: {} });
    applyScrollBehavior(path, currentFull, null);
    runAfterHooks(path, currentFull);
  };

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const docAny = typeof document !== 'undefined' ? document as Document & { startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> } } : null;
  if (
    options?.transition &&
    !reducedMotion &&
    docAny &&
    typeof docAny.startViewTransition === 'function'
  ) {
    docAny.startViewTransition(commitRoute);
  } else {
    commitRoute();
  }
}

/**
 * آپدیت params در routeSignal.
 *
 * این تابع توسط `<zen-router>` فراخوانی می‌شود وقتی یک مسیر منطبق پیدا می‌کند.
 * params در Signal ذخیره می‌شود تا در Expressionها با `$route.params.id` قابل
 * دسترسی باشد.
 *
 * @param params پارامترهای استخراج‌شده از مسیر.
 */
export function setRouteParams(params: Record<string, string>): void {
  const current = routeSignal.get();
  routeSignal.set({ ...current, params });
}

// ── Listener برای دکمه‌های Back/Forward مرورگر ──
//
// این listener یک‌بار در module load ثبت می‌شود. وقتی کاربر دکمه‌ی Back یا
// Forward را می‌زند، `popstate` event رخ می‌دهد و ما routeSignal را آپدیت
// می‌کنیم.
//
// نکته: این کد با `typeof window !== 'undefined'` محافظت می‌شود تا در SSR
// یا تست‌های Node بدون jsdom خطا ندهد.
let popstateListenerInstalled = false;

// BUG-RTR-03 (v1.3.0): Global cleanup callbacks registered by other modules
// (e.g. outlet.ts for link-click handler, prefetch, route cache). All are
// invoked when cleanupRouter() is called so that no stale listeners or data
// survive a HMR reload or manual teardown.
const _routerCleanups: Array<() => void> = [];

/**
 * BUG-RTR-03 (v1.3.0): Register a function to be called when cleanupRouter()
 * is invoked. Used by outlet.ts to clean up link-click handlers, prefetch
 * handlers, the route cache, and the route definition store.
 *
 * @param fn Cleanup function to register.
 * @returns #116 cleanup protocol: یک `Cleanup` idempotent که fn را از صف
 *           cleanups حذف می‌کند (تا cleanupRouter دیگر آن را اجرا نکند).
 */
export function registerRouterCleanup(fn: () => void): () => void {
  if (cleaningRouter) { fn(); return () => {}; }
  _routerCleanups.push(fn);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    const idx = _routerCleanups.indexOf(fn);
    if (idx !== -1) _routerCleanups.splice(idx, 1);
  };
}

/**
 * Reference به popstate listener (برای remove کردن در cleanup).
 */
let popstateHandler: (() => void) | null = null;

export function installPopstateListener(): void {
  if (popstateListenerInstalled) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

  // listener را در یک متغیر ذخیره می‌کنیم تا بتوانیم آن را remove کنیم.
  popstateHandler = () => {
    // FIX (v1.2.3): شامل search و hash هم باش. قبلاً فقط pathname ست می‌شد،
    // در نتیجه Back/Forward به همان صفحه با query متفاوت، routeSignal را
    // آپدیت نمی‌کرد. حالا کل URL را می‌گیریم و سپس clean (split روی ? و #)
    // می‌کنیم تا outlet با pathname خالص کار کند.
    const prevPath = routeSignal.get().path;
    const full = window.location.pathname + window.location.search + window.location.hash;
    const cleanPath = full.split('?')[0]!.split('#')[0]!;
    routeSignal.set({
      path: cleanPath,
      params: {},
    });
    const saved = _savedScrollPositions.get(full) ?? _savedScrollPositions.get(cleanPath) ?? null;
    applyScrollBehavior(full, prevPath, saved);
    runAfterHooks(full, prevPath);
  };
  window.addEventListener('popstate', popstateHandler);
  popstateListenerInstalled = true;
}

// نصب خودکار در module load (در محیط مرورگر).
installPopstateListener();

/**
 * پاکسازی listener های Router (برای تست‌ها و HMR).
 *
 * ⚠️ در Production استفاده نکنید.
 */
let cleaningRouter = false;
export function cleanupRouter(): void {
  if (cleaningRouter) return; cleaningRouter = true;
  try {
    // listener را واقعاً remove می‌کنیم (با همان reference).
    if (
      popstateHandler &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('popstate', popstateHandler);
      popstateHandler = null;
    }
    popstateListenerInstalled = false;

    // BUG-RTR-03 (v1.3.0): Run all registered external cleanups (prefetch
    // handlers, link-click handlers, route cache, route definitions, etc.)
    // registered by outlet.ts via registerRouterCleanup().
    for (const cleanup of _routerCleanups.splice(0)) {
      try {
        cleanup();
      } catch {
        /* one bad cleanup must not break the rest */
      }
    }

    _guards.length = 0;
    _afterHooks.length = 0;
    _savedScrollPositions.clear();
    _scrollBehavior = null;

    // reset browser route signal (در SSR، context signals به‌طور خودکار
    // با تمام شدن runWithRoute پاک می‌شوند).
    browserRouteSignal.set({ path: '/', params: {} });
  } finally { cleaningRouter = false; }
}
