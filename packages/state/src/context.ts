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

/**
 * Global state برای Owner فعلی.
 */
let currentOwner: Owner | null = null;

/**
 * Create a new owner.
 */
export function createOwner(parent?: Owner | null): Owner {
  const owner: Owner = {
    parent: parent ?? currentOwner,
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
 */
export function onCleanup(fn: () => void): void {
  if (currentOwner) {
    currentOwner.cleanup.add(fn);
  }
}

/**
 * Get current active owner.
 */
export function getOwner(): Owner | null {
  return currentOwner;
}

/**
 * Set current active owner.
 */
export function setOwner(owner: Owner | null): void {
  currentOwner = owner;
}

/**
 * EffectContext شامل activeEffect و activeCleanupRegistration.
 *
 * BUG-22 FIX (v1.2.2): قبلاً این دو به‌صورت متغیرهای ماژول-level ذخیره می‌شدند
 * که در SSR concurrent بین درخواست‌ها share می‌شدند (race condition). حالا یک
 * provider mechanism وجود دارد: SSR می‌تواند setEffectContextStore() را با یک
 * تابع فراخوانی کند که در هر call، EffectContext مخصوص همان async context
 * (via AsyncLocalStorage) را برمی‌گرداند.
 */
export interface EffectContext {
  owner: Owner | null;
  activeEffect: Function | null;
  activeCleanupRegistration: ((cleanup: () => void) => void) | null;
}

/**
 * Provider function که EffectContext فعلی (مربوط به async context جاری) را
 * برمی‌گرداند. در SSR توسط renderToString به یک تابع تنظیم می‌شود که از
 * domAls.getStore() می‌خواند. در client-side، null باقی می‌ماند.
 */
let effectContextProvider: (() => EffectContext | null) | null = null;

/**
 * تنظیم provider تابع برای EffectContext.
 *
 * SSR باید این تابع را با یک callback فراخوانی کند که در هر call،
 * EffectContext مربوط به async context فعلی (via AsyncLocalStorage) را
 * برمی‌گرداند. این کار از race condition در SSR concurrent جلوگیری می‌کند.
 *
 * @param provider تابعی که EffectContext برمی‌گرداند یا null برای غیرفعال‌سازی.
 */
export function setEffectContextStore(provider: (() => EffectContext | null) | null): void {
  effectContextProvider = provider;
}

/**
 * Fallback ماژول-level برای محیط‌های بدون provider (مثل client-side).
 */
const moduleLevelContext: EffectContext = {
  owner: null,
  activeEffect: null,
  activeCleanupRegistration: null,
};

/**
 * دریافت EffectContext فعلی. اگر provider تنظیم شده باشد و مقدار غیر-null
 * برگرداند، از آن استفاده می‌کنیم. در غیر این صورت، به fallback ماژول-level
 * برمی‌گردیم.
 */
function _getMutableContext(): EffectContext {
  if (effectContextProvider) {
    const ctx = effectContextProvider();
    if (ctx) return ctx;
  }
  return moduleLevelContext;
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
 */
export function registerCleanup(cleanup: CleanupFn): void {
  const reg = _getMutableContext().activeCleanupRegistration;
  if (reg) {
    reg(cleanup);
  }
}

/**
 * تنظیم تابع ثبت Cleanup برای Effect فعلی.
 *
 * توسط effect() در start of execution فراخوانی می‌شود تا یک تابع ثبت
 * Cleanup در اختیار signalها قرار دهد.
 */
export function setActiveCleanupRegistration(
  register: ((cleanup: CleanupFn) => void) | null,
): void {
  _getMutableContext().activeCleanupRegistration = register;
}
