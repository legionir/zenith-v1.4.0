import type { Priority } from '@zenith/scheduler';
import type { EffectSubscriber } from './effect-subscriber';
// packages/state/src/context.ts
//
// BUG-05 FIX + IMP-03 (v1.3.0): Context Module — Active Effect & Cleanup Tracking.
//
// هدف: شکستن وابستگی دایره‌ای (Circular Dependency) بین signal.ts و effect.ts.
//
// مشکل قبلی:
//   - signal.ts ← import ← getEffectPriority از effect.ts
//   - effect.ts ← import ← setActiveEffect, setActiveCleanupRegistration از signal.ts
//   این وابستگی دایره‌ای با برخی bundlerها (Webpack 4, Rollup plugins) کار نمی‌کرد
//   و ترتیب exportها اهمیت پیدا می‌کرد.
//
// راه‌حل:
//   تمام توابع context-aware (EffectContext, activeEffect, activeCleanupRegistration)
//   به این ماژول منتقل شده‌اند. هم signal.ts و هم effect.ts فقط از ./context import
//   می‌کنند — دیگر import مستقیم از یکدیگر ندارند.
//
// ── مسئولیت‌ها ──
//   1. تعریف EffectContext و توابع مربوط به activeEffect
//   2. تعریف activeCleanupRegistration و registerCleanup
//   3. مدیریت provider mechanism برای SSR (setEffectContextStore)
//   4. Owner Tree برای lifecycle management

/**
 * Owner interface for lifecycle management.
 *
 * هر Effect یا Computed یک Owner دارد که children و cleanup handlers
 * آن را مدیریت می‌کند. این ساختار tree-based امکان dispose کردن
 * گروهی از Effectها را فراهم می‌کند.
 * @public
 */
export interface Owner {
  id?: string;
  parent?: Owner | null;
  children: Set<Owner>;
  cleanup: Set<() => void>;
  disposed: boolean;
}

/** Host integration context; root export retained as a compatibility bridge. @internal */
export interface EffectContext {
  owner: Owner | null;
  activeEffect: EffectSubscriber | null;
  /** Synchronous priority scope; independent native requests do not inherit it. */
  priority?: Priority;
  /** Suppress realm-global diagnostic observers while retaining scoped records. */
  globalObservation?: boolean;
  /** Host lifetime, not the currently running child effect's lifetime. */
  registerDisposal?: (cleanup: () => void) => void;
  /** Capture the host execution context at registration, not at dispatch. */
  bind?: <Args extends unknown[], T>(callback: (...args: Args) => T) => (...args: Args) => T;
  // #116: register ممکن است یک Cleanup (`() => void`) برای حذف cleanup از
  // صف برگرداند. نوع inline است چون state نمی‌تواند shared را import کند
  // (چرخهٔ DEC-021).
  activeCleanupRegistration: ((cleanup: () => void) => void | (() => void)) | null;
}

/**
 * #75: Global singleton state keyed via Symbol.for so dual ESM/CJS loads
 * of @zenith/state share a single reactive tracking context and owner tree.
 */
const STATE_CONTEXT_SYMBOL = Symbol.for('zenith.state.context.v1');
const STATE_MODULE_TOKEN = {};

interface GlobalStateContextSingleton {
  // Synchronous override only: never held across a returned Promise.
  executionContext?: EffectContext;
  ownerDisposers?: WeakMap<Owner, () => void>;
  effectContextProvider: (() => EffectContext | null) | null;
  moduleLevelContext: EffectContext;
  moduleTokens?: Set<object>;
  warnedDuplicate?: boolean;
  onDuplicateHandler?: (count: number) => void;
}

function getStateContextSingleton(): GlobalStateContextSingleton {
  const g = globalThis as unknown as Record<symbol, GlobalStateContextSingleton | undefined>;
  let instance = g[STATE_CONTEXT_SYMBOL];
  if (!instance) {
    instance = {
      effectContextProvider: null,
      moduleLevelContext: {
        owner: null,
        activeEffect: null,
        activeCleanupRegistration: null,
      },
    };
    g[STATE_CONTEXT_SYMBOL] = instance;
  }
  return instance;
}

/**
 * #34: Register a module instance of @zenith/state and emit a one-time ZEN-0301
 * warning if more than one module copy is loaded in the same process.
 */
export function registerStateContextToken(
  token: object = STATE_MODULE_TOKEN,
  onDuplicate?: (count: number) => void,
): number {
  const instance = getStateContextSingleton();
  instance.moduleTokens ??= new Set([STATE_MODULE_TOKEN]);
  if (onDuplicate) {
    instance.onDuplicateHandler = onDuplicate;
  }
  instance.moduleTokens.add(token);
  const count = instance.moduleTokens.size;
  if (count > 1 && !instance.warnedDuplicate) {
    instance.warnedDuplicate = true;
    (onDuplicate ?? instance.onDuplicateHandler)?.(count);
  }
  return count;
}

/**
 * #34: Reset duplicate-instance tracking (testing utility).
 * @internal
 */
export function resetStateInstanceTrackingForTesting(): void {
  const instance = getStateContextSingleton();
  instance.moduleTokens = new Set([STATE_MODULE_TOKEN]);
  instance.warnedDuplicate = false;
}

/**
 * Create a new owner.
 * @public
 */
export function createOwner(parent?: Owner | null): Owner {
  const context = _getMutableContext();
  const owner: Owner = {
    parent: parent === undefined ? context.owner : parent,
    children: new Set(),
    cleanup: new Set(),
    disposed: false,
  };
  if (owner.parent?.disposed) {
    owner.parent = null;
    owner.disposed = true;
    return owner;
  }
  // Binding can fail or dispose the parent: never attach a half-live child.
  let boundDispose: () => void;
  try { boundDispose = _bindToEffectContext(context, () => disposeOwnerInContext(owner, context)); }
  catch (error) { owner.disposed = true; owner.parent = null; throw error; }
  if (owner.parent?.disposed) { owner.parent = null; owner.disposed = true; }
  if (!owner.disposed) {
    const singleton = getStateContextSingleton();
    singleton.ownerDisposers ??= new WeakMap();
    singleton.ownerDisposers.set(owner, boundDispose);
    owner.parent?.children.add(owner);
  }
  return owner;
}

/** Dispose an owner and all its children in their creation contexts. @public */
export function disposeOwner(owner: Owner): void {
  if (owner.disposed) return;
  const dispose = getStateContextSingleton().ownerDisposers?.get(owner);
  if (dispose) dispose();
  else disposeOwnerInContext(owner, _getMutableContext());
}

function disposeOwnerInContext(owner: Owner, context: EffectContext): void {
  if (owner.disposed) return;
  const previousOwner = context.owner;
  const previousEffect = context.activeEffect;
  const previousRegistration = context.activeCleanupRegistration;
  owner.disposed = true;
  getStateContextSingleton().ownerDisposers?.delete(owner);
  context.owner = owner;
  context.activeEffect = null;
  context.activeCleanupRegistration = null;
  try {
    for (const child of Array.from(owner.children)) disposeOwner(child);
    owner.children.clear();
    for (const fn of Array.from(owner.cleanup)) {
      try { fn(); } catch { /* teardown remains best-effort */ }
    }
    owner.cleanup.clear();
    owner.parent?.children.delete(owner);
    owner.parent = null;
  } finally {
    context.activeEffect = previousEffect;
    context.activeCleanupRegistration = previousRegistration;
    context.owner = previousOwner;
  }
}

/**
 * Register a cleanup function for current owner.
 *
 * #116 cleanup protocol: خروجی یک `Cleanup` idempotent است که fn را از
 * مجموعهٔ cleanup همین owner حذف می‌کند (قبل از اجرا). اگر owner نباشد یا
 * fn بعداً اجرا شده باشد، حذف no-op است.
 * @public
 */
export function onCleanup(fn: () => void): () => void {
  const owner = getOwner();
  if (owner) {
    if (owner.disposed) { fn(); return () => {}; }
    owner.cleanup.add(fn);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      owner.cleanup.delete(fn);
    };
  }
  return () => {};
}

/**
 * Get current active owner.
 * @public
 */
export function getOwner(): Owner | null {
  return _getMutableContext().owner;
}

/**
 * Set current active owner.
 * @public
 */
export function setOwner(owner: Owner | null): void {
  _getMutableContext().owner = owner;
}

/**
 * تنظیم provider تابع برای EffectContext.
 * @internal
 */
export function setEffectContextStore(provider: (() => EffectContext | null) | null): void {
  getStateContextSingleton().effectContextProvider = provider;
}

/**
 * دریافت EffectContext فعلی. اگر provider تنظیم شده باشد و مقدار غیر-null
 * برگرداند، از آن استفاده می‌کنیم. در غیر این صورت، به fallback ماژول-level
 * برمی‌گردیم.
 */
function _getMutableContext(): EffectContext {
  const singleton = getStateContextSingleton();
  const execution = singleton.executionContext;
  // A native binder already restores its creation store. Honor an explicit
  // nested host run() rather than pinning the outer request over the new one.
  if (execution && !execution.bind) return execution;
  const provided = singleton.effectContextProvider?.();
  if (provided) return provided;
  return execution ?? singleton.moduleLevelContext;
}

export { _getMutableContext };

/** Internal synchronous scope; host async propagation belongs to context.bind. */
export function _runInEffectContext<T>(context: EffectContext, fn: () => T): T {
  const singleton = getStateContextSingleton();
  const previous = singleton.executionContext;
  singleton.executionContext = context;
  try { return fn(); }
  finally { singleton.executionContext = previous; }
}

/**
 * تنظیم activeEffect فعلی.
 *
 * توسط effect() در start of execution فراخوانی می‌شود تا signalها بدانند
 * چه کسی در حال خواندن آن‌هاست.
 */
export function setActiveEffect(effect: EffectSubscriber | null): void {
  _getMutableContext().activeEffect = effect;
}

/**
 * دریافت activeEffect فعلی.
 *
 * توسط signal.get() برای Dependency Tracking استفاده می‌شود.
 */
export function getActiveEffect(): EffectSubscriber | null {
  return _getMutableContext().activeEffect;
}

/**
 * نوع تابع پاکسازی.
 */
export type CleanupFn = () => void;

/**
 * ثبت یک تابع پاکسازی در Effect فعلی.
 *
 * هر Signal در get() از این مکانیزم استفاده می‌کند تا وقتی Effect
 * دوباره اجرا شد یا dispose شد، خودش را از subscribers حذف کند.
 *
 * @param cleanup تابع پاکسازی.
 * @returns #116 cleanup protocol: یک `Cleanup` که fn را از صف cleanup جاری
 *           حذف می‌کند (تا پیش از اجرا). اگر خارج از Effect ثبت شود، no-op.
 */
export function registerCleanup(cleanup: CleanupFn): () => void {
  const reg = _getMutableContext().activeCleanupRegistration;
  if (reg) {
    return reg(cleanup) ?? (() => {});
  }
  return () => {};
}

/**
 * تنظیم تابع ثبت Cleanup برای Effect فعلی.
 *
 * توسط effect() در start of execution فراخوانی می‌شود تا یک تابع ثبت
 * Cleanup در اختیار signalها قرار دهد.
 */
export function setActiveCleanupRegistration(
  register: ((cleanup: CleanupFn) => void | (() => void)) | null,
): void {
  _getMutableContext().activeCleanupRegistration = register;
}

/** Preserve actual callback results and the creation context without a second implementation. */
export function _bindToEffectContext<Args extends unknown[], T>(
  context: EffectContext, callback: (...args: Args) => T,
): (...args: Args) => T {
  const scoped = (...args: Args) => _runInEffectContext(context, () => callback(...args));
  const bound = context.bind ? context.bind(scoped) : scoped;
  if (typeof bound !== 'function') throw new TypeError('EffectContext.bind must return a callback');
  return bound;
}

/** Host policy for realm-global diagnostics; not a claim about Signal writability. @internal */
export function isGlobalObservationEnabled(): boolean {
  return _getMutableContext().globalObservation !== false;
}
