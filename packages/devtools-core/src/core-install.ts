// packages/devtools-core/src/core-install.ts
//
// نصب هستهٔ DevTools و aliasهای deprecated پنل — استخراج مکانیکی از index.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import type { Cleanup, Disposable } from '@zenith/shared';
import { setSignalObserver, untrack } from '@zenith/state';
import { deprecate } from '@zenith/errors';
import { devtoolsCoreOptions, type DevtoolsCoreOptions } from './core-options';
import {
  assertHookVersion,
  hook,
  nameSignal,
  recordStateChange,
  registerSignal,
} from './core-registry';
import {
  activeInstallations,
  isSSRContext,
  noopCleanup,
  setCurrentConfig,
} from './core-state';


// ── installDevtoolsCore ──

/**
 * نصب هستهٔ DevTools و اتصال به `setSignalObserver` در `@zenith/state`.
 * در SSR به‌طور کامل no-op است.
 */
/** @public */
export function installDevtoolsCore(opts?: DevtoolsCoreOptions): Disposable {
  return untrack(() => installCore(opts));
}
function installCore(opts?: DevtoolsCoreOptions): Disposable {
  if (isSSRContext()) return { dispose: noopCleanup };
  const resolved = devtoolsCoreOptions.resolve(opts);
  const g = globalThis as Record<string, unknown>;
  const defaultEnabled = g.__ZENITH_DEV__ !== false;
  const effectiveEnabled = opts?.enabled !== undefined ? resolved.enabled : defaultEnabled;

  const nextConfig = { ...resolved, enabled: effectiveEnabled, redact: [...resolved.redact] };
  if (!effectiveEnabled) { setCurrentConfig(nextConfig); return { dispose: noopCleanup }; }

  // Read only a proven object capability; a failed installation must not apply
  // its new config to an already-live outside observer.
  const existingHook: unknown = g.__ZENITH_DEVTOOLS_HOOK__;
  if (existingHook !== null && (typeof existingHook === 'object' || typeof existingHook === 'function')) {
    const version: unknown = Reflect.get(existingHook, 'version');
    if (version !== undefined) assertHookVersion(version);
  }
  g.__ZENITH_DEVTOOLS_HOOK__ = hook;
  setCurrentConfig(nextConfig);

  const detachObserver = setSignalObserver({
    onCreate(sig, name) {
      registerSignal(sig, name);
    },
    onChange(sig, oldValue, newValue) {
      recordStateChange(sig, oldValue, newValue);
    },
    onDispose(sig) {
      const id = signalToId.get(sig);
      if (id !== undefined) {
        signalToId.delete(sig); idToInfo.delete(id);
        hook.emit('signal:dispose', { id });
      }
    },
    onName(sig, name) {
      nameSignal(sig, name);
    },
  });

  const installation = {};
  activeInstallations.add(installation);
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      detachObserver();
      activeInstallations.delete(installation);
      untrack(() => {
        try {
          if (activeInstallations.size === 0 && g.__ZENITH_DEVTOOLS_HOOK__ === hook) {
            if (!Reflect.deleteProperty(g, '__ZENITH_DEVTOOLS_HOOK__') && g.__ZENITH_DEVTOOLS_HOOK__ === hook) Reflect.set(g, '__ZENITH_DEVTOOLS_HOOK__', undefined);
          }
        } catch { /* observer/token teardown must survive hostile global accessors */ }
      });
    },
  };
}

/**
 * @deprecated #119 — نام `registerCache` با `@zenith/cache.registerCache`
 * (رجیستری واقعی کش) هم‌نام و مبهم بود؛ این تابع رجیستری **پنل devtools** است.
 * از `registerDevtoolsCache` استفاده کنید (ZEN-DEPR-042؛ حذف در ۲.۰).
 */
/** @public */
export function registerCache(name: string, cache: unknown): Cleanup {
  deprecate('ZEN-DEPR-042', 'registerCache (@zenith/devtools-core)', 'registerDevtoolsCache');
  return registerDevtoolsCache(name, cache);
}

/**
 * @deprecated #119 — نام `registerStore` با `@zenith/store.registerStore`
 * (رجیستری واقعی storeها) هم‌نام و مبهم بود؛ این تابع رجیستری **پنل devtools**
 * است. از `registerDevtoolsStore` استفاده کنید (ZEN-DEPR-043؛ حذف در ۲.۰).
 */
/** @public */
export function registerStore(name: string, store: unknown): Cleanup {
  deprecate('ZEN-DEPR-043', 'registerStore (@zenith/devtools-core)', 'registerDevtoolsStore');
  return registerDevtoolsStore(name, store);
}