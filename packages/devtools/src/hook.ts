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
//    flag پیکربندی‌پذیر استفاده می‌کنیم: `Reflect.get(globalThis, '__ZENITH_DEVTOOLS__')`.
//    پیش‌فرض: فعال. برای غیرفعال کردن، `window.__ZENITH_DEVTOOLS__ = false` تنظیم کنید.
//
// 3) Idempotent:
//    اگر `initDevTools` چندبار فراخوانی شود، فقط یکبار Hook نصب می‌شود.
//
// 4) Disabled capture:
//    در حالت غیرفعال مقدارها ثبت نمی‌شوند؛ guardها هنوز اجرا می‌شوند.

import {
  untrack,
  getAllSignals,
  getStateTimeline,
  onStateChange,
  type SignalInfo,
  type StateChange,
} from '@zenith/state';
import { componentRegistry } from '@zenith/components';
import { logger } from '@zenith/logger';
import { deprecate, onGlobalReset } from '@zenith/errors';
// FEATURE (v0.4.0): Dependency Graph Viewer
// گراف وابستگی‌ها (Signal → Effect → Directive → DOM) روی hook expose می‌شود.
import { graph, getDependencyGraph, clearDependencyGraph, type GraphSnapshot, type GraphSignalOptions, type GraphDirectiveOptions } from './graph';
import { canObserveHost } from './observation-policy';

/**
 * نسخه‌ی فریم‌ورک (برای نمایش در DevTools).
 */
/** @public */
export const DEVTOOLS_VERSION = '1.0.0';

/** @public */
export interface StaticForOptions { expr: string; itemCount: number; }
/** @public */
export interface ResourceDestroyOptions { url: string; stack?: string; }

/**
 * ساختار شیء `window.__ZENITH__` که برای افزونه مرورگر expose می‌شود.
 */
/** @public */
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
  /** Native graph options protocol. Older foreign hooks need not advertise it. */
  readonly graphProtocolVersion: 2;
  addSignal(id: string, options: GraphSignalOptions): void;
  /** @deprecated Use addSignal(id, { name, value }) (ZEN-DEPR-101). */
  addSignal(id: string, name: string, value: unknown): void;
  /** ثبت یک Effect در گراف. */
  addEffect(id: string, deps?: string[]): void;
  addDirective(id: string, options: GraphDirectiveOptions): void;
  /** @deprecated Use addDirective(id, { directiveType, elementSelector, expression }) (ZEN-DEPR-102). */
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
  addStaticFor(id: string, options: StaticForOptions): void;
  /** @deprecated Use addStaticFor(id, { expr, itemCount }) (ZEN-DEPR-104). */
  addStaticFor(id: string, expr: string, itemCount: number): void;
  /** FEATURE (v1.0.0): دریافت لیست zen-for های static. */
  getStaticFors(): Array<{ id: string; expr: string; itemCount: number; createdAt: number }>;
  /** FEATURE (v1.0.0): ثبت destroy یک Resource. */
  recordResourceDestroy(name: string, options: ResourceDestroyOptions): void;
  /** @deprecated Use recordResourceDestroy(name, { url, stack }) (ZEN-DEPR-105). */
  recordResourceDestroy(name: string, url: string, stack?: string): void;
  /** FEATURE (v1.0.0): دریافت لیست Resource های destroyed. */
  getDestroyedResources(): Array<{
    name: string;
    url: string;
    destroyedAt: number;
    stack?: string;
  }>;
  /** FEATURE (v1.0.0): ثبت cache hit/miss برای compileExpression. */
  recordCacheHit(expr: string): void;
  recordCacheMiss(expr: string): void;
  /** FEATURE (v1.0.0): دریافت آمار cache. */
  getCacheStats(): {
    hits: number;
    misses: number;
    total: number;
    hitRatio: number;
    size: number;
    uniqueExpressions: number;
  };
  /** FEATURE (v1.0.0): ثبت فعال‌سازی یک AsyncLocalStorage store در SSR. */
  recordSSRStore(requestId: string): void;
  /** FEATURE (v1.0.0): ثبت غیرفعال‌سازی یک store. */
  recordSSRStoreDone(requestId: string): void;
  /** FEATURE (v1.0.0): دریافت لیست SSR stores فعال. */
  getActiveSSRStores(): string[];
}

interface Installation {
  target: Window;
  hook: ZenithDevtoolsHook;
  subscriptions: Set<() => void>;
  cleanups: Set<() => void>;
  closed: boolean;
}
let current: Installation | null = null;
const noop = () => {};
const LIMIT = 1000;
const staticFors: Array<{ id: string; expr: string; itemCount: number; createdAt: number }> = [];
const destroyedResources: Array<{ name: string; url: string; destroyedAt: number; stack?: string }> = [];
const cacheStats = { hits: 0, misses: 0, uniqueExpressions: new Set<string>() };
const activeSSRStores = new Set<string>();

function clearDataStores(): void {
  staticFors.length = 0; destroyedResources.length = 0;
  cacheStats.hits = 0; cacheStats.misses = 0; cacheStats.uniqueExpressions.clear(); activeSSRStores.clear();
}
function boundedAdd(values: Set<string>, value: string): void {
  values.add(value);
  if (values.size > LIMIT) { const first = values.values().next().value; if (first !== undefined) values.delete(first); }
}
function shouldEnableDevtools(): boolean {
  return untrack(() => {
    if (!canObserveHost()) return false;
    const flag: unknown = Reflect.get(globalThis, '__ZENITH_DEVTOOLS__');
    if (typeof flag === 'boolean') return flag;
    if (typeof window === 'undefined') return false;
    try {
      const flag = new URLSearchParams(window.location.search).get('zenith-devtools');
      if (flag === 'false' || flag === '0') return false;
      if (flag === 'true' || flag === '1') return true;
    } catch { /* unavailable location is not a diagnostic failure */ }
    return true;
  });
}

function live(installation: Installation): boolean {
  return untrack(() => {
    try {
      return !installation.closed && current === installation && shouldEnableDevtools() &&
        Reflect.get(installation.target, '__ZENITH__') === installation.hook;
    } catch { return false; }
  });
}

function clearSubscriptions(installation: Installation): void {
  for (const stop of Array.from(installation.subscriptions)) { try { stop(); } catch {} }
  installation.subscriptions.clear();
}
function release(installation: Installation): void {
  if (installation.closed) return;
  installation.closed = true;
  if (current === installation) { current = null; clearDataStores(); }
  clearSubscriptions(installation);
  for (const stop of Array.from(installation.cleanups)) { try { stop(); } catch {} }
  installation.cleanups.clear();
  try {
    if (Reflect.get(installation.target, '__ZENITH__') === installation.hook && !Reflect.deleteProperty(installation.target, '__ZENITH__') && Reflect.get(installation.target, '__ZENITH__') === installation.hook) Reflect.set(installation.target, '__ZENITH__', undefined);
  } catch { /* an external replacement is not ours to delete */ }
}
// Explicit process reset clears owned diagnostics even when invoked by a host;
// it does not delete an outside hook or another subsystem's event registrations.
onGlobalReset(() => { clearDataStores(); if (current) clearSubscriptions(current); });

function installLifecycle(installation: Installation): void {
  const target = installation.target, document = target.document;
  const pagehide = () => { if (live(installation)) { clearDataStores(); clearSubscriptions(installation); } };
  const visibility = () => { if (live(installation) && document.visibilityState === 'hidden') clearDataStores(); };
  // Own only our exact registrations; never overwrite another subsystem's
  // __zenCleanupHandlers array or resolve ambient window during later cleanup.
  target.addEventListener('pagehide', pagehide);
  installation.cleanups.add(() => target.removeEventListener('pagehide', pagehide));
  document.addEventListener('visibilitychange', visibility);
  installation.cleanups.add(() => document.removeEventListener('visibilitychange', visibility));
  const meta: unknown = import.meta;
  if (meta !== null && typeof meta === 'object') {
    const hot: unknown = Reflect.get(meta, 'hot');
    if (hot !== null && (typeof hot === 'object' || typeof hot === 'function')) {
      const dispose: unknown = Reflect.get(hot, 'dispose');
      if (typeof dispose === 'function') Reflect.apply(dispose, hot, [() => release(installation)]);
    }
  }
}

/** Install a browser-only, ownership-scoped compatibility hook. @public */
export function initDevTools(): void {
  try {
    if (!shouldEnableDevtools() || typeof window === 'undefined') return;
    const target = window;
    if (current && live(current)) return;
    if (current) release(current);
    if (Reflect.get(target, '__ZENITH__')) return;
    const usable = () => live(installation);
    function addSignal(id: string, options: GraphSignalOptions): void;
    /** @deprecated Use the options form. */
    function addSignal(id: string, name: string, value: unknown): void;
    function addSignal(id: string, input: GraphSignalOptions | string, value?: unknown): void {
      if (!usable()) return;
      if (typeof input === 'string') graph.addSignal(id, input, value); else graph.addSignal(id, input);
    }
    function addDirective(id: string, options: GraphDirectiveOptions): void;
    /** @deprecated Use the options form. */
    function addDirective(id: string, type: string, selector: string, expression?: string): void;
    function addDirective(id: string, input: GraphDirectiveOptions | string, selector?: string, expression?: string): void {
      if (!usable()) return;
      if (typeof input === 'string') graph.addDirective(id, input, selector ?? '', expression); else graph.addDirective(id, input);
    }
    function addStaticFor(id: string, options: StaticForOptions): void;
    /** @deprecated Use the options form. */
    function addStaticFor(id: string, expr: string, itemCount: number): void;
    function addStaticFor(id: string, input: StaticForOptions | string, legacyCount?: number): void {
      if (!usable()) return;
      const options = untrack(() => {
        if (typeof input === 'string') {
          deprecate('ZEN-DEPR-104', 'addStaticFor(id, expr, itemCount)', 'addStaticFor(id, { expr, itemCount })');
          return { expr: input, itemCount: legacyCount ?? 0 };
        }
        return { expr: input.expr, itemCount: input.itemCount };
      });
      if (!usable()) return;
      const existing = staticFors.find(item => item.id === id);
      if (existing) { existing.expr = options.expr; existing.itemCount = options.itemCount; }
      else { staticFors.push({ id, ...options, createdAt: Date.now() }); if (staticFors.length > LIMIT) staticFors.shift(); }
    }
    function recordResourceDestroy(name: string, options: ResourceDestroyOptions): void;
    /** @deprecated Use the options form. */
    function recordResourceDestroy(name: string, url: string, stack?: string): void;
    function recordResourceDestroy(name: string, input: ResourceDestroyOptions | string, legacyStack?: string): void {
      if (!usable()) return;
      const options = untrack(() => {
        if (typeof input === 'string') {
          deprecate('ZEN-DEPR-105', 'recordResourceDestroy(name, url, stack)', 'recordResourceDestroy(name, { url, stack })');
          return { url: input, stack: legacyStack };
        }
        return { url: input.url, stack: input.stack };
      });
      if (!usable()) return;
      destroyedResources.push({ name, ...options, destroyedAt: Date.now() });
      if (destroyedResources.length > LIMIT) destroyedResources.shift();
    }
    const hook: ZenithDevtoolsHook = {
      version: DEVTOOLS_VERSION, graphProtocolVersion: 2, installedAt: Date.now(),
      getSignals: () => usable() ? getAllSignals() : [],
      getTimeline: limit => usable() ? getStateTimeline(limit) : [],
      onStateChange: callback => {
        if (!usable()) return noop;
        let actual: ((change: StateChange) => void) | null = callback;
        let native: (() => void) | null = onStateChange(change => { if (usable()) actual?.(change); });
        const stop = () => { const owned = native; actual = null; native = null; installation.subscriptions.delete(stop); owned?.(); };
        installation.subscriptions.add(stop); return stop;
      },
      get components() { return usable() ? componentRegistry : new Map<string, HTMLTemplateElement>(); },
      getDependencyGraph: () => usable() ? getDependencyGraph() : { nodes: [], edges: [], generatedAt: Date.now(), counts: { signals: 0, effects: 0, directives: 0, dom: 0, edges: 0 } },
      addSignal, addDirective,
      addEffect: (id, deps) => { if (usable()) graph.addEffect(id, deps); },
      addDom: (id, tag) => { if (usable()) graph.addDom(id, tag); },
      recordRead: (from, to) => { if (usable()) graph.recordRead(from, to); },
      recordWrite: (from, to) => { if (usable()) graph.recordWrite(from, to); },
      recordDomUpdate: (from, to) => { if (usable()) graph.recordDomUpdate(from, to); },
      clearDependencyGraph: () => { if (usable()) clearDependencyGraph(); },
      addStaticFor, recordResourceDestroy,
      getStaticFors: () => usable() ? staticFors.map(item => ({ ...item })) : [],
      getDestroyedResources: () => usable() ? destroyedResources.map(item => ({ ...item })) : [],
      recordCacheHit: expr => { if (usable()) { cacheStats.hits++; boundedAdd(cacheStats.uniqueExpressions, expr); } },
      recordCacheMiss: expr => { if (usable()) { cacheStats.misses++; boundedAdd(cacheStats.uniqueExpressions, expr); } },
      getCacheStats: () => {
        const allowed = usable(), hits = allowed ? cacheStats.hits : 0, misses = allowed ? cacheStats.misses : 0, total = hits + misses;
        const size = allowed ? cacheStats.uniqueExpressions.size : 0;
        return { hits, misses, total, hitRatio: total > 0 ? hits / total : 0, size, uniqueExpressions: size };
      },
      recordSSRStore: id => { if (usable()) boundedAdd(activeSSRStores, id); },
      recordSSRStoreDone: id => { if (usable()) activeSSRStores.delete(id); },
      getActiveSSRStores: () => usable() ? Array.from(activeSSRStores) : [],
    };
    const installation: Installation = { target, hook, subscriptions: new Set(), cleanups: new Set(), closed: false };
    if (!Reflect.set(target, '__ZENITH__', hook)) return;
    current = installation;
    try { installLifecycle(installation); }
    catch { release(installation); return; }
    try { logger.info('[Zenith DevTools] Hook installed.'); logger.debug('Access via window.__ZENITH__'); } catch {}
  } catch { /* development tools must not interrupt application bootstrap */ }
}

/** @public */
export function getDevtoolsVersion(): string { return DEVTOOLS_VERSION; }
/** @public */
export function isDevtoolsHookInstalled(): boolean { return current !== null && live(current); }
/** Dispose only owned browser resources; request code cannot reset outside tools. @public */
export function cleanupDevtools(): void {
  if (!canObserveHost()) return;
  if (current) release(current);
}
