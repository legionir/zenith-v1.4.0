// packages/devtools/src/hook.ts
//
// DevTools Hook — پل ارتباطی بین فریم‌ورک و افزونه مرورگر (فاز ۱۰).
//
// این ماژول در زمان Development اجرا می‌شود و یک شیء سراسری روی `window`
// قرار می‌دهد (`window.__ZENITH__`) تا افزونه Chrome بتواند:
//   - نسخه‌ی فریم‌ورک را بخواند.
//   - لیست تمام Signal های فعال را بگیرد.
//   - Timeline تغییرات State را ببیند.
//   - لیست کامپوننت‌های ثبت‌شده را ببیند.
//   - روی تغییرات State گوش دهد.
//
// ── نکات طراحی ──
//
// 1) Only in Browser:
//    این ماژول فقط در محیط مرورگر (با `window`) کار می‌کند. در SSR یا
//    تست‌های Node، no-op است.
//
// 2) Dev Mode Detection:
//    به‌جای `import.meta.env?.DEV` (که فقط در Vite کار می‌کند)، از یک
//    flag پیکربندی‌پذیر استفاده می‌کنیم: `(globalThis as any).__ZENITH_DEVTOOLS__`.
//    پیش‌فرض: فعال. برای غیرفعال کردن، `window.__ZENITH_DEVTOOLS__ = false` تنظیم کنید.
//
// 3) Idempotent:
//    اگر `initDevTools` چندبار فراخوانی شود، فقط یکبار Hook نصب می‌شود.
//
// 4) No Overhead in Production:
//    اگر DevTools غیرفعال باشد، تمام توابع no-op می‌شوند.

import {
  getAllSignals,
  getStateTimeline,
  onStateChange,
  type SignalInfo,
  type StateChange,
} from '@zenith/state';
import { componentRegistry } from '@zenith/components';
// FEATURE (v0.4.0): Dependency Graph Viewer
// گراف وابستگی‌ها (Signal → Effect → Directive → DOM) روی hook expose می‌شود.
import {
  graph,
  getDependencyGraph,
  clearDependencyGraph,
  type GraphSnapshot,
} from './graph';

/**
 * نسخه‌ی فریم‌ورک (برای نمایش در DevTools).
 */
export const DEVTOOLS_VERSION = '1.0.0';

/**
 * ساختار شیء `window.__ZENITH__` که برای افزونه مرورگر expose می‌شود.
 */
export interface ZenithDevtoolsHook {
  /** نسخه‌ی فریم‌ورک. */
  version: string;
  /** دریافت لیست تمام Signal های فعال. */
  getSignals(): SignalInfo[];
  /** دریافت Timeline تغییرات State. */
  getTimeline(limit?: number): StateChange[];
  /** گوش دادن به تغییرات State (real-time). */
  onStateChange(callback: (change: StateChange) => void): () => void;
  /** Reference به رجیستری کامپوننت‌ها (Map). */
  components: Map<string, HTMLTemplateElement>;
  /** زمان نصب Hook. */
  installedAt: number;
  // ── FEATURE (v0.4.0): Dependency Graph Viewer ──
  /** دریافت اسنپ‌شات گراف وابستگی‌ها (Signal → Effect → Directive → DOM). */
  getDependencyGraph(): GraphSnapshot;
  /** ثبت یک Signal در گراف (از داخل runtime). */
  addSignal(id: string, name: string, value: any): void;
  /** ثبت یک Effect در گراف. */
  addEffect(id: string, deps?: string[]): void;
  /** ثبت یک Directive در گراف. */
  addDirective(id: string, type: string, elementSelector: string, expression?: string): void;
  /** ثبت یک نود DOM در گراف. */
  addDom(id: string, tag: string): void;
  /** ثبت خواندن Signal توسط Effect (یال read-by). */
  recordRead(signalId: string, effectId: string): void;
  /** ثبت هدایت Directive توسط Effect (یال drives). */
  recordWrite(effectId: string, directiveId: string): void;
  /** ثبت به‌روزرسانی DOM توسط Directive (یال updates). */
  recordDomUpdate(directiveId: string, nodeId: string): void;
  /** پاکسازی گراف. */
  clearDependencyGraph(): void;
  // ── FEATURE (v1.0.0): zen-static, Resource.destroy, compileExpression, SSR ──
  /** FEATURE (v1.0.0): ثبت یک zen-for با zen-static fast path. */
  addStaticFor(id: string, expr: string, itemCount: number): void;
  /** FEATURE (v1.0.0): دریافت لیست zen-for های static. */
  getStaticFors(): Array<{ id: string; expr: string; itemCount: number; createdAt: number }>;
  /** FEATURE (v1.0.0): ثبت destroy یک Resource. */
  recordResourceDestroy(name: string, url: string, stack?: string): void;
  /** FEATURE (v1.0.0): دریافت لیست Resource های destroyed. */
  getDestroyedResources(): Array<{ name: string; url: string; destroyedAt: number; stack?: string }>;
  /** FEATURE (v1.0.0): ثبت cache hit/miss برای compileExpression. */
  recordCacheHit(expr: string): void;
  recordCacheMiss(expr: string): void;
  /** FEATURE (v1.0.0): دریافت آمار cache. */
  getCacheStats(): { hits: number; misses: number; total: number; hitRatio: number; size: number; uniqueExpressions: number };
  /** FEATURE (v1.0.0): ثبت فعال‌سازی یک AsyncLocalStorage store در SSR. */
  recordSSRStore(requestId: string): void;
  /** FEATURE (v1.0.0): ثبت غیرفعال‌سازی یک store. */
  recordSSRStoreDone(requestId: string): void;
  /** FEATURE (v1.0.0): دریافت لیست SSR stores فعال. */
  getActiveSSRStores(): string[];
}

/**
 * Flag برای جلوگیری از نصب چندباره‌ی Hook.
 */
let hookInstalled = false;

// ── FEATURE (v1.0.0): Data stores for new tracking features ──

/** لیست zen-for های با zen-static fast path. */
const staticFors: Array<{ id: string; expr: string; itemCount: number; createdAt: number }> = [];

/** لیست Resource های destroy شده. */
const destroyedResources: Array<{ name: string; url: string; destroyedAt: number; stack?: string }> = [];

/** آمار cache برای compileExpression. */
const cacheStats = {
  hits: 0,
  misses: 0,
  uniqueExpressions: new Set<string>(),
};

/** لیست SSR stores فعال (AsyncLocalStorage). */
const activeSSRStores = new Set<string>();

/** نگهداری توابع unsubscribe برای پاکسازی event listener‌ها. */
const stateChangeUnsubscribers: Array<() => void> = [];

/**
 * بررسی اینکه آیا DevTools باید فعال باشد.
 *
 * پیش‌فرض: فعال.
 * برای غیرفعال کردن: `(globalThis as any).__ZENITH_DEVTOOLS__ = false`
 *
 * از چند سیگنال استفاده می‌کند تا تشخیص development mode در محیط‌های مختلف
 * (Vite, Webpack, URL params) سازگار باشد:
 *   1) flag سراسری __ZENITH_DEVTOOLS__
 *   2) URL parameter `zenith-devtools`
 *   3) hostname محلی (localhost, 127.0.0.1)
 */
function shouldEnableDevtools(): boolean {
  if (typeof globalThis === 'undefined') return false;

  // 1) Flag سراسری (اولویت بالا)
  const flag = (globalThis as any).__ZENITH_DEVTOOLS__;
  if (flag === false) return false;
  if (flag === true) return true;

  // 2) URL parameter
  try {
    const params = new URLSearchParams(window.location.search);
    const urlFlag = params.get('zenith-devtools');
    if (urlFlag === 'false' || urlFlag === '0') return false;
    if (urlFlag === 'true' || urlFlag === '1') return true;
  } catch { /* ignore */ }

  // 3) Hostname محلی
  try {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  } catch { /* ignore */ }

  // پیش‌فرض: فعال
  return true;
}

/**
 * پاکسازی تمام data stores (برای HMR و page unload).
 */
function clearDataStores(): void {
  staticFors.length = 0;
  destroyedResources.length = 0;
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.uniqueExpressions.clear();
  activeSSRStores.clear();
}

/**
 * پاکسازی تمام event listener‌های ثبت‌شده از طریق hook.
 */
function cleanupStateSubscribers(): void {
  for (const unsub of stateChangeUnsubscribers) {
    try { unsub(); } catch { /* ignore */ }
  }
  stateChangeUnsubscribers.length = 0;
}

/**
 * HMR cleanup handler — در Vite از import.meta.hot استفاده می‌کند.
 * در سایر bundlerها (Webpack, Turbopack) fallback به pagehide.
 */
function setupHMRCleanup(): void {
  // Vite HMR
  if (typeof (import.meta as any)?.hot?.dispose !== 'undefined') {
    (import.meta as any).hot.dispose(() => {
      clearDataStores();
      cleanupStateSubscribers();
      cleanupHookInstance();
    });
  }

  // Fallback: page unload / visibility
  window.addEventListener('pagehide', () => {
    clearDataStores();
    cleanupStateSubscribers();
  });

  // SPA navigation: cleanup when page becomes hidden
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // فقط stores خالی می‌شوند، hook حذف نمی‌شود چون ممکن است دوباره به صفحه برگردیم
      clearDataStores();
    }
  });
}

function cleanupHookInstance(): void {
  if (typeof window !== 'undefined') {
    delete (window as any).__ZENITH__;
  }
  hookInstalled = false;
}

/**
 * نصب DevTools Hook روی `window.__ZENITH__`.
 *
 * این تابع:
 *   1) بررسی می‌کند که در محیط مرورگر هستیم.
 *   2) بررسی می‌کند که DevTools فعال است.
 *   3) یک شیء `ZenithDevtoolsHook` روی `window.__ZENITH__` قرار می‌دهد.
 *   4) یک پیام در console چاپ می‌کند (با استایل).
 *
 * این تابع idempotent است — چندبار فراخوانی آن مشکلی ایجاد نمی‌کند.
 */
export function initDevTools(): void {
  // فقط در محیط مرورگر.
  if (typeof window === 'undefined') return;

  // اگر DevTools غیرفعال است، کاری نکن.
  if (!shouldEnableDevtools()) return;

  // اگر قبلاً نصب شده، کاری نکن.
  if (hookInstalled) return;
  if ((window as any).__ZENITH__) return;

  const hook: ZenithDevtoolsHook = {
    version: DEVTOOLS_VERSION,
    getSignals: () => getAllSignals(),
    getTimeline: (limit?: number) => getStateTimeline(limit),
    onStateChange: (callback: (change: StateChange) => void) => {
      const unsub = onStateChange(callback);
      stateChangeUnsubscribers.push(unsub);
      return unsub;
    },
    components: componentRegistry,
    installedAt: Date.now(),
    // ── FEATURE (v0.4.0): Dependency Graph Viewer ──
    getDependencyGraph: () => getDependencyGraph(),
    addSignal: (id, name, value) => graph.addSignal(id, name, value),
    addEffect: (id, deps) => graph.addEffect(id, deps || []),
    addDirective: (id, type, sel, expr) => graph.addDirective(id, type, sel, expr),
    addDom: (id, tag) => graph.addDom(id, tag),
    recordRead: (s, e) => graph.recordRead(s, e),
    recordWrite: (e, d) => graph.recordWrite(e, d),
    recordDomUpdate: (d, n) => graph.recordDomUpdate(d, n),
    clearDependencyGraph: () => clearDependencyGraph(),
    // ── FEATURE (v1.0.0): zen-static, Resource.destroy, compileExpression, SSR ──
    addStaticFor: (id, expr, itemCount) => {
      const existing = staticFors.findIndex(s => s.id === id);
      if (existing >= 0) {
        staticFors[existing]!.itemCount = itemCount;
      } else {
        staticFors.push({ id, expr, itemCount, createdAt: Date.now() });
      }
    },
    getStaticFors: () => staticFors.slice(),
    recordResourceDestroy: (name, url, stack) => {
      destroyedResources.push({ name, url, destroyedAt: Date.now(), stack });
    },
    getDestroyedResources: () => destroyedResources.slice(),
    recordCacheHit: (expr) => {
      cacheStats.hits++;
      cacheStats.uniqueExpressions.add(expr);
    },
    recordCacheMiss: (expr) => {
      cacheStats.misses++;
      cacheStats.uniqueExpressions.add(expr);
    },
    getCacheStats: () => {
      const total = cacheStats.hits + cacheStats.misses;
      return {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        total,
        hitRatio: total > 0 ? cacheStats.hits / total : 0,
        size: cacheStats.uniqueExpressions.size,
        uniqueExpressions: cacheStats.uniqueExpressions.size,
      };
    },
    recordSSRStore: (requestId) => {
      activeSSRStores.add(requestId);
    },
    recordSSRStoreDone: (requestId) => {
      activeSSRStores.delete(requestId);
    },
    getActiveSSRStores: () => Array.from(activeSSRStores),
  };

  (window as any).__ZENITH__ = hook;
  hookInstalled = true;

  // BUG-DEV-01: راه‌اندازی HMR و page unload cleanup (بعد از نصب hook)
  setupHMRCleanup();

  // پیام خوش‌آمدگویی با استایل.
  console.log(
    '%c[Zenith DevTools] Hook installed. 🛠️',
    'color: #bada55; font-weight: bold; font-size: 12px;',
  );
  console.log(
    '%cAccess via window.__ZENITH__',
    'color: #888; font-size: 11px;',
  );
}

/**
 * دریافت نسخه‌ی DevTools.
 */
export function getDevtoolsVersion(): string {
  return DEVTOOLS_VERSION;
}

/**
 * بررسی اینکه آیا Hook نصب شده است.
 */
export function isDevtoolsHookInstalled(): boolean {
  return hookInstalled && typeof window !== 'undefined' && !!(window as any).__ZENITH__;
}

/**
 * پاکسازی Hook (برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید.
 */
/**
 * پاکسازی DevTools Hook.
 *
 * ⚠️ در Production استفاده نکنید.
 *
 * BUG-DEV-03/BUG-DEV-08: همچنین تمام event listener‌ها و unsubscriberها
 * پاکسازی می‌شوند تا از memory leak جلوگیری شود.
 */
export function cleanupDevtools(): void {
  cleanupStateSubscribers();
  clearDataStores();
  cleanupHookInstance();
}
