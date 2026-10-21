// packages/ssr/src/render-await.ts
//
// مهلت‌زمانی و نصب یک‌باره storeها — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).

import { ZenithError, deprecate } from '@zenith/errors';
import { domAls, bindSSRCallback } from './dom-context';
import { registerRegistryOwnerProvider } from '@zenith/shared';
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
import { setComponentRegistryStore, setActionRegistryStore, ActionRegistry } from '@zenith/runtime';


function createSSRTimeoutError(timeoutMs: number): ZenithError {
  return new ZenithError({
    code: 'ZEN-1801',
    category: 'SSR',
    message: `SSR render timed out after ${timeoutMs}ms.`,
    suggestion:
      'renderTimeoutMs / timeout را افزایش دهید یا داده‌های کندِ مسیر را به بافر/کش منتقل کنید.',
    context: { timeoutMs },
  });
}

/** @public */
export interface RaceWithTimeoutOptions {
  /**
   * مهلت به میلی‌ثانیه. `undefined`، غیرمتناهی یا نامثبت ⇒ بدون timeout
   * (همان رفتار قدیمی `timeoutMs` اختیاری).
   */
  timeoutMs?: number;
}

/** @public */
export async function raceWithTimeout<T>(promise: Promise<T>, options?: RaceWithTimeoutOptions): Promise<T>;
/** @public @deprecated #55 — امضای positional؛ از `raceWithTimeout(promise, { timeoutMs })` استفاده کنید (ZEN-DEPR-068، حذف در ۲.۰). */
export async function raceWithTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T>;
export async function raceWithTimeout<T>(promise: Promise<T>, timeoutMsOrOptions?: number | RaceWithTimeoutOptions): Promise<T> {
  if (typeof timeoutMsOrOptions === 'number') {
    deprecate('ZEN-DEPR-068', 'raceWithTimeout(promise, timeoutMs)', 'raceWithTimeout(promise, { timeoutMs })');
  }
  const timeoutMs = typeof timeoutMsOrOptions === 'number' ? timeoutMsOrOptions : timeoutMsOrOptions?.timeoutMs;
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(createSSRTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

let _effectContextStoreInstalled = false;
export function setEffectContextStoreOnce(): void {
  if (_effectContextStoreInstalled) return;
  _effectContextStoreInstalled = true;
  registerRegistryOwnerProvider(() => domAls.getStore()?.registryOwner ?? null);
  setEffectContextStore((): EffectContext | null => {
    const store = domAls.getStore();
    if (!store) return null;
    if (!store.effectContext) {
      store.effectContext = {
        owner: null,
        activeEffect: null,
        activeCleanupRegistration: null,
        bind: bindSSRCallback, globalObservation: false,
      };
    }
    return store.effectContext ?? null;
  });
  setComponentRegistryStore(() => {
    const store = domAls.getStore();
    if (!store) return null;
    if (!store.componentRegistry) {
      store.componentRegistry = new Map();
    }
    return store.componentRegistry;
  });
  setActionRegistryStore(() => {
    const store = domAls.getStore();
    if (!store) return null;
    if (!store.actionRegistry) {
      store.actionRegistry = new ActionRegistry();
    }
    return store.actionRegistry;
  });
}
