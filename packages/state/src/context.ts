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
 */
export interface Owner {
  id?: string;
  parent?: Owner | null;
  children: Set<Owner>;
  cleanup: Set<() => void>;
  disposed: boolean;
}

export interface EffectContext {
  owner: Owner | null;
  activeEffect: Function | null;
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
  currentOwner: Owner | null;
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
      currentOwner: null,
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
 */
export function resetStateInstanceTrackingForTesting(): void {
  const instance = getStateContextSingleton();
  instance.moduleTokens = new Set([STATE_MODULE_TOKEN]);
  instance.warnedDuplicate = false;
}

/**
 * Create a new owner.
 */
export function createOwner(parent?: Owner | null): Owner {
  const singleton = getStateContextSingleton();
  const owner: Owner = {
    parent: parent ?? singleton.currentOwner,
    children: new Set(),
    cleanup: new Set(),
    disposed: false,
  };

  if (owner.parent) {
    owner.parent.children.add(owner);
  }

  return owner;
}

/**
 * Dispose an owner and all its children.
 */
export function disposeOwner(owner: Owner): void {
  if (owner.disposed) return;

  owner.disposed = true;

  // Dispose all children first
  for (const child of owner.children) {
    disposeOwner(child);
  }
  owner.children.clear();

  // Run all cleanup handlers
  for (const fn of owner.cleanup) {
    try {
      fn();
    } catch {
      /* ignore cleanup errors */
    }
  }
  owner.cleanup.clear();

  // Remove from parent
  if (owner.parent) {
    owner.parent.children.delete(owner);
  }

  owner.parent = null;
}

/**
 * Register a cleanup function for current owner.
 *
 * #116 cleanup protocol: خروجی یک `Cleanup` idempotent است که fn را از
 * مجموعهٔ cleanup همین owner حذف می‌کند (قبل از اجرا). اگر owner نباشد یا
 * fn بعداً اجرا شده باشد، حذف no-op است.
 */
export function onCleanup(fn: () => void): () => void {
  const singleton = getStateContextSingleton();
  if (singleton.currentOwner) {
    const owner = singleton.currentOwner;
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
 */
export function getOwner(): Owner | null {
  return getStateContextSingleton().currentOwner;
}

/**
 * Set current active owner.
 */
export function setOwner(owner: Owner | null): void {
  getStateContextSingleton().currentOwner = owner;
}

/**
 * تنظیم provider تابع برای EffectContext.
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
  if (singleton.effectContextProvider) {
    const ctx = singleton.effectContextProvider();
    if (ctx) return ctx;
  }
  return singleton.moduleLevelContext;
}

export { _getMutableContext };

/**
 * تنظیم activeEffect فعلی.
 *
 * توسط effect() در start of execution فراخوانی می‌شود تا signalها بدانند
 * چه کسی در حال خواندن آن‌هاست.
 */
export function setActiveEffect(effect: Function | null): void {
  _getMutableContext().activeEffect = effect;
}

/**
 * دریافت activeEffect فعلی.
 *
 * توسط signal.get() برای Dependency Tracking استفاده می‌شود.
 */
export function getActiveEffect(): Function | null {
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
