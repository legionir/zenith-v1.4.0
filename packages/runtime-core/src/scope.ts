import { installDiagnosticLogger } from '@zenith/logger';
import { registerRegistryOwnerProvider, type RegistryOwner, type Cleanup, type Disposer } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import { defineDirectiveMeta } from '@zenith/schema';
import type { App, DirectiveDefinition, Plugin } from './types';
import { handleAppError } from './errors';

export interface ScopeFrame {
  app: App;
  disposes: Disposer;
  mountCallbacks: Array<() => void | Cleanup>;
  updateCallbacks: Array<() => void>;
  provides: Map<string | symbol, unknown>;
  parent: ScopeFrame | null;
}

let currentScope: ScopeFrame | null = null;
let currentActiveApp: App | null = null;
export const registryOwners = new WeakMap<App, RegistryOwner>();
let registryOwnerProviderInstalled = false;
export function installRegistryOwnerProvider(): void {
  if (registryOwnerProviderInstalled) return;
  registryOwnerProviderInstalled = true;
  installDiagnosticLogger();
  registerRegistryOwnerProvider(() => {
    const app = currentActiveApp ?? currentScope?.app;
    return app ? registryOwners.get(app) ?? null : null;
  }, { priority: 100 });
}

export function runInScope<T>(frame: ScopeFrame, fn: () => T): T {
  const prevScope = currentScope;
  const prevApp = currentActiveApp;
  currentScope = frame;
  currentActiveApp = frame.app;
  try {
    return fn();
  } finally {
    currentScope = prevScope;
    currentActiveApp = prevApp;
  }
}

export function flushMountCallbacks(frame: ScopeFrame): void {
  const cbs = frame.mountCallbacks.splice(0, frame.mountCallbacks.length);
  for (const cb of cbs) {
    if (frame.disposes.isDisposed?.()) break;
    try {
      const cleanup = runInScope(frame, cb);
      if (typeof cleanup === 'function') {
        const release = () => runInScope(frame, cleanup);
        if (frame.disposes.isDisposed?.()) release(); else frame.disposes.add(release);
      }
    } catch (err) {
      handleAppError(frame.app, err);
    }
  }
}

export function triggerUpdateCallbacks(frame: ScopeFrame): void {
  if (frame.disposes.isDisposed?.()) return;
  for (const cb of [...frame.updateCallbacks]) {
    if (frame.disposes.isDisposed?.()) break;
    try {
      runInScope(frame, cb);
    } catch (err) {
      handleAppError(frame.app, err);
    }
  }
}

// DEC-032: قلاب‌های چرخهٔ عمر (onMount/onUnmount/onUpdate) API «ثبت + لغو ثبت»
// نیستند و Cleanup برنمی‌گردانند؛ teardown آن‌ها به dispose همان دامنه
// (کامپوننت/دایرکتیو) گره خورده است — در scripts/cleanup-hygiene.mjs
// (LIFECYCLE_HOOK_ALLOWLIST) با همین دلیل ثبت شده‌اند.

/**
 * ثبت قلاب چرخهٔ عمر هنگام mount شدن دایرکتیو/کامپوننت.
 * فراخوانی خارج از دامنهٔ فعال ⇒ `ZEN-2301`.
 * @public
 */
export function onMount(fn: () => void | Cleanup): void {
  if (!currentScope) {
    throw createReservedError('ZEN-2301', { details: { hook: 'onMount' } });
  }
  if (!currentScope.disposes.isDisposed?.()) currentScope.mountCallbacks.push(fn);
}

/**
 * ثبت قلاب چرخهٔ عمر هنگام unmount / dispose شدن دایرکتیو/کامپوننت.
 * فراخوانی خارج از دامنهٔ فعال ⇒ `ZEN-2301`.
 * @public
 */
export function onUnmount(fn: () => void): void {
  if (!currentScope) {
    throw createReservedError('ZEN-2301', { details: { hook: 'onUnmount' } });
  }
  const frame = currentScope; const release = () => runInScope(frame, fn);
  if (frame.disposes.isDisposed?.()) release(); else frame.disposes.add(release);
}

/**
 * ثبت قلاب چرخهٔ عمر که پس از هر به‌روزرسانی واکنش‌گرا در دامنهٔ فعلی اجرا می‌شود.
 * فراخوانی خارج از دامنهٔ فعال ⇒ `ZEN-2301`.
 * @public
 */
export function onUpdate(fn: () => void): void {
  if (!currentScope) {
    throw createReservedError('ZEN-2301', { details: { hook: 'onUpdate' } });
  }
  if (!currentScope.disposes.isDisposed?.()) currentScope.updateCallbacks.push(fn);
}

/**
 * #125: کلید تایپ‌شده برای Dependency Injection (`provide` / `inject`).
 * @public
 */
export type InjectionKey<T> = symbol & { readonly __zenithInjectionType?: T };

/**
 * #125: ساخت یک `InjectionKey<T>` تایپ‌شده بر پایهٔ `Symbol(description)`.
 * @public
 */
export function createInjectionKey<T>(description?: string): InjectionKey<T> {
  return Symbol(description) as InjectionKey<T>;
}

/**
 * ثبت مقدار در درخت Dependency Injection دامنهٔ فعلی (یا اپ فعال).
 * @public
 */
export function provide<T>(key: InjectionKey<T> | string | symbol, value: T): void {
  if (currentScope) {
    currentScope.provides.set(key, value);
    return;
  }
  if (currentActiveApp) {
    currentActiveApp.provide(key, value);
    return;
  }
  throw createReservedError('ZEN-2301', { details: { hook: 'provide', key: String(key) } });
}

/**
 * خواندن مقدار از نزدیک‌ترین دامنهٔ والد در درخت (یا سطح App).
 * @public
 */
export function inject<T>(key: InjectionKey<T> | string | symbol): T | undefined;
/** @public */
export function inject<T>(key: InjectionKey<T> | string | symbol, defaultValue: T): T;
/** @public */
export function inject<T>(key: InjectionKey<T> | string | symbol, defaultValue?: T): T | undefined {
  let frame = currentScope;
  while (frame) {
    if (frame.provides.has(key)) {
      return frame.provides.get(key) as T;
    }
    frame = frame.parent;
  }
  const app = currentActiveApp ?? currentScope?.app;
  if (app) {
    return app.inject(key, defaultValue);
  }
  throw createReservedError('ZEN-2301', { details: { hook: 'inject', key: String(key) } });
}

/**
 * دریافت نمونهٔ App فعال در دامنهٔ جاری.
 * @public
 */
export function useApp(): App {
  const app = currentActiveApp ?? currentScope?.app;
  if (!app) {
    throw createReservedError('ZEN-2301', { details: { hook: 'useApp' } });
  }
  return app;
}

/**
 * یاور تعریف دایرکتیو با حفظ نوع و ثبت متادیتا در `@zenith/schema`.
 * @public
 */
export function defineDirective(def: DirectiveDefinition): DirectiveDefinition {
  if (def.meta) {
    defineDirectiveMeta(def.meta);
  }
  return def;
}

/**
 * یاور تعریف پلاگین با حفظ نوع.
 * @public
 */
export function definePlugin<O = unknown>(plugin: Plugin<O>): Plugin<O> {
  return plugin;
}

/** @public */
export const ZENITH_RUNTIME_CORE_VERSION = '1.5.0';

/**
 * بررسی سازگاری lockstep نسخه‌های پکیج‌های `@zenith/*` (SPEC §۲.۸؛ خطای `ZEN-2320`).
 * @public
 */
export function assertCompatible(versions: Record<string, string> = {}): void {
  const entries = Object.entries(versions);
  if (entries.length <= 1) return;
  const parseMajorMinor = (v: string): string | null => {
    const m = /^v?(\d+)\.(\d+)\.\d+/.exec(v.trim());
    return m ? `${m[1]}.${m[2]}` : null;
  };
  const firstVer = entries[0]![1];
  const baseMM = parseMajorMinor(firstVer);
  if (!baseMM) {
    throw createReservedError('ZEN-2320', { details: { versions } });
  }
  for (const [, ver] of entries) {
    const mm = parseMajorMinor(ver);
    if (!mm || mm !== baseMM) {
      throw createReservedError('ZEN-2320', {
        details: { expectedMajorMinor: baseMM, versions },
      });
    }
  }
}


/** @internal */
export function getCurrentScope(): ScopeFrame | null { return currentScope; }
/** @internal Synchronous only; never retain an ambient scope across await. */
export function runWithApp<T>(app: App, callback: () => T): T {
  const previous = currentActiveApp; const previousScope = currentScope; currentActiveApp = app;
  if (currentScope?.app !== app) currentScope = null;
  try { return callback(); } finally { currentActiveApp = previous; currentScope = previousScope; }
}

/** @internal Own resources created by helpers that create (not borrow) an App. */
export function ownAppCleanup(app: App, cleanup: Cleanup): void { registryOwners.get(app)?.addCleanup(cleanup); }

/** @internal Includes App.run without requiring an element frame. */
export function getCurrentApp(): App | undefined { return currentActiveApp ?? currentScope?.app; }
