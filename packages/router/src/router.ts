// packages/router/src/router.ts
//
// مغز مسیریاب (Router) — فاز ۸.
//
// این ماژول مسیر فعلی را در یک Signal نگه می‌دارد، پارامترهای URL
// (مثل `:id`) را استخراج می‌کند، و قابلیت ناوبری (`navigate`) را فراهم
// می‌کند — بدون رفرش صفحه.
//
// نکته‌ی مهم: این ماژول فقط در محیط مرورگر کار می‌کند (نیاز به `window`,
// `history`, `location` دارد). در SSR یا تست‌های Node باید mock شود.
//
// ── Bug Fix: SSR Concurrency ──
//
// قبلاً routeSignal یک singleton ماژول-level بود. در SSR concurrent،
// دو درخواست همزمان به route های مختلف باعث می‌شد route صفحه‌ی B روی
// صفحه‌ی A overwrite شود.
//
// راه‌حل: استفاده از AsyncLocalStorage برای isolation per-request.
//   - در مرورگر: routeSignal همان singleton است (تعداد clients = 1).
//   - در SSR: هر درخواست context خود را دارد. routeSignal.get() و
//     routeSignal.set() به context فعلی اشاره می‌کنند.
//
// استفاده در SSR:
//   import { runWithRoute } from '@zenith/router';
//   await runWithRoute('/users/123', async () => {
//     // در این block، routeSignal به /users/123 اشاره می‌کند.
//     // navigate() و setRouteParams() فقط این context را تغییر می‌دهند.
//     const html = await renderToString(...);
//   });

import { signal, type Signal } from '@zenith/state';

/**
 * Route definition interface.
 */
export interface Route {
  path: string;
  component?: string | (() => Promise<any>);
  lazy?: boolean;
  prefetch?: boolean;
  guard?: (params: Record<string, string>) => boolean | Promise<boolean>;
  children?: Route[];
}

/**
 * Current route information.
 */
export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  name?: string;
}

/**
 * Define application routes.
 */
export function defineRoutes(routes: Route[]): Route[] {
  return routes;
}

/**
 * Get current route context.
 */
export function useRoute(): RouteContext {
  const current = routeSignal.get();
  return {
    path: current.path,
    params: current.params,
    query: {},
  };
}

// ── AsyncLocalStorage برای SSR concurrency safety ──
// در Node.js موجود است. در مرورگر undefined است (که مشکلی نیست چون
// مرورگر فقط یک client دارد).
//
// نکته: در ESM نمی‌توانیم از require() استفاده کنیم. پس از
// createRequire(import.meta.url) استفاده می‌کنیم تا sync به
// node:async_hooks دسترسی داشته باشیم.
let routeAsyncLocalStorage: any = null;
try {
  // بررسی اینکه در Node.js هستیم (نه مرورگر)
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
    // در ESM، از createRequire برای sync require استفاده می‌کنیم
    const { createRequire } = await import('node:module');
    const nodeRequire = createRequire(import.meta.url);
    const { AsyncLocalStorage } = nodeRequire('node:async_hooks');
    routeAsyncLocalStorage = new AsyncLocalStorage();
  }
} catch {
  // در محیط‌هایی که node:module در دسترس نیست (مرورگر)،
  // fallback به singleton استفاده می‌شود.
}

/**
 * وضعیت مسیر فعلی.
 *
 * @property path   مسیر فعلی (مثل `/products/101`).
 * @property params پارامترهای استخراج‌شده از مسیر (مثل `{ id: '101' }`).
 */
export interface RouteState {
  path: string;
  params: Record<string, string>;
}

/**
 * Signal سراسری مسیر فعلی (برای مرورگر).
 *
 * در مرورگر، این singleton است چون فقط یک client وجود دارد.
 * در SSR، از `runWithRoute()` استفاده کنید تا context per-request ایجاد شود.
 * در آن case، `routeSignal.get()` و `routeSignal.set()` به context فعلی اشاره می‌کنند.
 */
const browserRouteSignal: Signal<RouteState> = signal<RouteState>({
  path: typeof window !== 'undefined' ? window.location.pathname : '/',
  params: {},
});

/**
 * Proxy Signal که در SSR به context فعلی اشاره می‌کند.
 *
 * این Proxy interface همانند یک Signal واقعی عمل می‌کند:
 *   - get(): اگر در SSR context است، از AsyncLocalStorage می‌خواند.
 *            در غیر این صورت، از browserRouteSignal.
 *   - set(): اگر در SSR context است، در AsyncLocalStorage می‌نویسد.
 *            در غیر این صورت، در browserRouteSignal.
 *
 * این الگو به navigate() و setRouteParams() اجازه می‌دهد بدون تغییر،
 * هم در مرورگر و هم در SSR کار کنند — با isolation کامل در SSR.
 */
export const routeSignal: Signal<RouteState> = {
  get(): RouteState {
    if (routeAsyncLocalStorage) {
      const store = routeAsyncLocalStorage.getStore() as { signal: Signal<RouteState> } | undefined;
      if (store) {
        return store.signal.get();
      }
    }
    return browserRouteSignal.get();
  },
  set(value: RouteState): void {
    if (routeAsyncLocalStorage) {
      const store = routeAsyncLocalStorage.getStore() as { signal: Signal<RouteState> } | undefined;
      if (store) {
        store.signal.set(value);
        return;
      }
    }
    browserRouteSignal.set(value);
  },
  // متدهای داخلی Signal (برای dependency tracking)
  addSubscriber(effect: Function): void {
    if (routeAsyncLocalStorage) {
      const store = routeAsyncLocalStorage.getStore() as { signal: Signal<RouteState> } | undefined;
      if (store) {
        (store.signal as any).addSubscriber(effect);
        return;
      }
    }
    (browserRouteSignal as any).addSubscriber(effect);
  },
  removeSubscriber(effect: Function): void {
    if (routeAsyncLocalStorage) {
      const store = routeAsyncLocalStorage.getStore() as { signal: Signal<RouteState> } | undefined;
      if (store) {
        (store.signal as any).removeSubscriber(effect);
        return;
      }
    }
    (browserRouteSignal as any).removeSubscriber(effect);
  },
  get subscriberCount(): number {
    if (routeAsyncLocalStorage) {
      const store = routeAsyncLocalStorage.getStore() as { signal: Signal<RouteState> } | undefined;
      if (store) {
        return (store.signal as any).subscriberCount;
      }
    }
    return (browserRouteSignal as any).subscriberCount;
  },
  // Helper برای تست‌ها
  _getUnderlyingSignal(): Signal<RouteState> {
    if (routeAsyncLocalStorage) {
      const store = routeAsyncLocalStorage.getStore() as { signal: Signal<RouteState> } | undefined;
      if (store) return store.signal;
    }
    return browserRouteSignal;
  },
} as any;

/**
 * اجرای یک تابع در context یک route مشخص (برای SSR).
 *
 * هر درخواست SSR باید این تابع را با route خود صدا بزند. داخل callback،
 * routeSignal به یک Signal مستقل اشاره می‌کند که فقط در این context قابل
 * دسترسی است. این از race condition بین درخواست‌های concurrent جلوگیری می‌کند.
 *
 * استفاده:
 *   const html = await runWithRoute('/users/123', async () => {
 *     return await renderToString(template, state);
 *   });
 *
 * @param initialPath مسیر اولیه برای این context.
 * @param fn تابع که در context اجرا می‌شود.
 * @returns نتیجه‌ی fn.
 */
export async function runWithRoute<T>(
  initialPath: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!routeAsyncLocalStorage) {
    // در مرورگر یا Node بدون AsyncLocalStorage، fallback به browserRouteSignal.
    // این فقط در تست‌های بدون Node environment رخ می‌دهد.
    const oldPath = browserRouteSignal.get().path;
    browserRouteSignal.set({ path: initialPath, params: {} });
    try {
      return await fn();
    } finally {
      browserRouteSignal.set({ path: oldPath, params: {} });
    }
  }

  // ساخت یک Signal مستقل برای این context.
  const contextSignal = signal<RouteState>({
    path: initialPath,
    params: {},
  });

  return routeAsyncLocalStorage.run({ signal: contextSignal }, fn);
}

/**
 * نسخه‌ی sync از runWithRoute برای مواردی که callback sync است.
 *
 * استفاده:
 *   const result = runWithRouteSync('/users/123', () => {
 *     // کد sync
 *   });
 */
export function runWithRouteSync<T>(
  initialPath: string,
  fn: () => T,
): T {
  if (!routeAsyncLocalStorage) {
    const oldPath = browserRouteSignal.get().path;
    browserRouteSignal.set({ path: initialPath, params: {} });
    try {
      return fn();
    } finally {
      browserRouteSignal.set({ path: oldPath, params: {} });
    }
  }

  const contextSignal = signal<RouteState>({
    path: initialPath,
    params: {},
  });

  return routeAsyncLocalStorage.run({ signal: contextSignal }, fn);
}

/**
 * تطبیق یک الگوی مسیر با یک مسیر واقعی.

 * الگو می‌تواند شامل پارامترهای `:name` باشد. مثلا:
 *   matchRoute('/products/:id', '/products/101')  → { id: '101' }
 *   matchRoute('/users/:userId/posts/:postId', '/users/5/posts/12')
 *     → { userId: '5', postId: '12' }
 *   matchRoute('/', '/')  → {}
 *   matchRoute('/', '/about')  → null
 *
 * Wildcard: الگوی `**` با هر مسیری تطبیق می‌شود (برای صفحات 404).
 *   matchRoute('**', '/anything')  → {} (همیشه تطبیق می‌خورد)
 *
 * BUG-RTR-01 (v1.3.0): مسیر قبل از تطبیق نرمالایز می‌شود (double slashes حذف
 * و trailing slash trimmed). قبلاً `filter(Boolean)` فقط empty segments را
 * حذف می‌کرد و `//` در URL باعث تطبیق اشتباه (مثلاً `//users` با `:id` تطبیق
 * می‌خورد در حالی که URL نامعتبر است).
 *
 * @param pattern الگوی مسیر (مثل `/products/:id` یا `**`).
 * @param path    مسیر واقعی (مثل `/products/101`).
 * @returns آبجکت پارامترها در صورت تطبیق، یا `null` در صورت عدم تطبیق.
 */

/**
 * BUG-RTR-01 (v1.3.0): Normalize a URL path by removing double slashes
 * and trimming trailing slashes. This ensures that `/users//profile` is
 * treated as `/users/profile` rather than silently matching a wrong route.
 */
function normalizePath(urlPath: string): string {
  return urlPath.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  // ── Wildcard `**` — با هر مسیری تطبیق می‌خورد ──
  if (pattern === '**') {
    return {};
  }

  // BUG-RTR-01 (v1.3.0): Normalize both pattern and path so double slashes
  // are collapsed before comparison. Without this, `/users//profile` would
  // silently match `/users/:id` (since filter(Boolean) removes empty parts).
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(path);

  const patternParts = normalizedPattern.split('/').filter(Boolean);
  const pathParts = normalizedPath.split('/').filter(Boolean);

  // اگر تعداد بخش‌ها برابر نبود (و الگو wildcard نبود)، تطبیق نمی‌خورد.
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]!;
    const pathPart = pathParts[i]!;

    if (patternPart.startsWith(':')) {
      // پارامتر: مقدار را در params ذخیره کن.
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      // تطبیق دقیق: اگر برابر نبود، null برگردان.
      return null;
    }
  }
  return params;
}

/**
 * پیدا کردن اولین مسیر منطبق از لیست مسیرها.
 *
 * @param routes   لیست مسیرها (با فیلدهای `path` و `src`).
 * @param path     مسیر فعلی.
 * @returns اولین مسیر منطبق همراه با params، یا `null` اگر هیچ‌کدام منطبق نبود.
 */
export function findMatchingRoute<T extends { path: string }>(
  routes: T[],
  path: string,
): { route: T; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchRoute(route.path, path);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}

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
export type NavigationGuard = (to: string, from: string) => boolean | string | Promise<boolean | string>;

const _guards: NavigationGuard[] = [];

/**
 * IMP-RTR-01 (v1.3.0): Register a navigation guard that runs before every
 * navigate() call. Guards are executed in registration order. If any guard
 * returns:
 *   - `true`       → allow navigation to proceed.
 *   - `string`     → redirect to that URL (guard chain stops).
 *   - `false`/falsy → block navigation entirely.
 *
 * @param guard A NavigationGuard function.
 */
export function beforeEach(guard: NavigationGuard): void {
  _guards.push(guard);
}

export interface NavigateOptions {
  /** IMP-RTR-02 (v1.3.0): Use history.replaceState instead of pushState.
   *  This replaces the current history entry rather than pushing a new one.
   *  Useful for redirect-after-login flows where the login page should not
   *  appear in the browser's back-stack. */
  replace?: boolean;
}

export async function navigate(path: string, options?: NavigateOptions): Promise<void> {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    // در محیط غیر مرورگر (SSR یا تست‌های Node): فقط Signal را آپدیت کن.
    // routeSignal proxy به‌طور خودکار به context فعلی (اگر موجود) می‌رود.
    // FIX (v1.2.3): clean path — search و hash را از path ورودی جدا کن.
    const cleanPath = path.split('?')[0]!.split('#')[0]!;
    routeSignal.set({ path: cleanPath, params: {} });
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
    if (result === false) return;                                    // block
    if (typeof result === 'string' && result !== path) {
      return navigate(result, { ...options, replace: true });        // redirect (replace to avoid redirect loop in back-stack)
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
  if (options?.replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  // FIX (v1.2.3): clean path را در routeSignal ذخیره کن (بدون search/hash).
  // outlet و matchRoute فقط با pathname کار می‌کنند و نباید query در آن برود.
  const cleanPath = path.split('?')[0]!.split('#')[0]!;
  routeSignal.set({ path: cleanPath, params: {} });
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
 */
export function registerRouterCleanup(fn: () => void): void {
  _routerCleanups.push(fn);
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
    const full = window.location.pathname + window.location.search + window.location.hash;
    const cleanPath = full.split('?')[0]!.split('#')[0]!;
    routeSignal.set({
      path: cleanPath,
      params: {},
    });
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
export function cleanupRouter(): void {
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
  for (const cleanup of _routerCleanups) {
    try { cleanup(); } catch { /* one bad cleanup must not break the rest */ }
  }
  _routerCleanups.length = 0;

  // reset browser route signal (در SSR، context signals به‌طور خودکار
  // با تمام شدن runWithRoute پاک می‌شوند).
  browserRouteSignal.set({ path: '/', params: {} });
}
