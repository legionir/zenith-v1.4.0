// packages/cache/src/registry.ts
//
// #144 — رجیستری devtools + آداپتور سیگنال (SPEC §۲.۴).
//
// چرا adapter؟ `cache.signal(key)` در SPEC «در صورت وجود state» خواسته شده.
// state لایهٔ بالاتر است و cache L0؛ یال cache→state (حتی type-only) در dist
// می‌ماند و peer-single-instance (#46) را می‌شکند (الگوی #141/DEC-21). لذا
// state در زمان اجرا با setSignalAdapter تزریق می‌شود؛ بدون آن signal throws.
import { invariant, type Cleanup } from '@zenith/shared';
import { onGlobalReset } from '@zenith/errors';
import type { Cache, SignalAdapter } from './types';

const registry = new Map<string, Cache<unknown, string>>();
let signalAdapter: SignalAdapter<unknown, string> | undefined;

/**
 * ثبت یک کش برای devtools (`listCaches`). نام تکراری = خطای برنامه‌نویس ⇒
 * invariant (ZEN-1090)؛ ZEN-1201 مخصوص ttl است (کاتالوگ #171).
 * @returns `Cleanup` حذف‌کننده (idempotent).
 */
export function registerCache(name: string, cache: Cache<unknown, string>): Cleanup {
  invariant(!registry.has(name), `[cache] registerCache: نام «${name}» ثبت شده است`, {
    details: { name },
  });
  registry.set(name, cache);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    // فقط اگر همان entry باشد (تا register پس از re-register گیج نشود)
    if (registry.get(name) === cache) registry.delete(name);
  };
}

/** حذف رکورد رجیستری (خروجی auto-register در dispose). */
export function unregisterCache(name: string): boolean {
  return registry.delete(name);
}

/**
 * دریافت کش ثبت‌شده با نام (قرارداد ۵ متدی #118؛ مکمل `listCaches` برای
 * devtools).
 * @public
 */
export function getCache(name: string): Cache<unknown, string> | undefined {
  return registry.get(name);
}

/**
 * بررسی وجود کش ثبت‌شده با نام (قرارداد ۵ متدی #118).
 * @public
 */
export function hasCache(name: string): boolean {
  return registry.has(name);
}

/** فهرست کش‌های ثبت‌شده با آمار لحظه‌ای (SPEC §۲.۴ listCaches). */
export function listCaches(): Array<{ name: string; stats: ReturnType<Cache['stats']> }> {
  return [...registry.entries()].map(([name, cache]) => ({ name, stats: cache.stats() }));
}

/**
 * آداپتور ساخت `Readable` را تزریق می‌کند (معمولاً از state).
 * @returns `Cleanup` بازگرداندن به حالت قبل (idempotent).
 */
export function setSignalAdapter(adapter: SignalAdapter<unknown, string>): Cleanup {
  const prev = signalAdapter;
  signalAdapter = adapter;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (signalAdapter === adapter) signalAdapter = prev;
  };
}

/** آداپتور فعلی (یا undefined اگر state به cache وصل نشده). */
export function getSignalAdapter<V = unknown, K = string>(): SignalAdapter<V, K> | undefined {
  return signalAdapter as SignalAdapter<V, K> | undefined;
}

// ============================================================
// Global reset (#118) — no cross-test leaks
// ============================================================

/**
 * #118: بازنشانی رجیستری نام‌به‌کش (بدون هشدار) — هوک ریست سراسری.
 * آداپتور سیگنال (تزریق state) دست نمی‌خورد: وضعیت تزریق است نه رجیستری.
 */
/** @internal */
export function resetCachesInternal(): void {
  registry.clear();
}
/* @__PURE__ */ onGlobalReset(resetCachesInternal);
