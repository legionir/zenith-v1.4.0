// packages/storage/src/storage-helpers.ts
//
// helperهای createStorage (پیش‌فرض‌ها، اعتبارسنجی، sync-bus) — استخراج
// مکانیکی از storage.ts، بدون تغییر رفتار (#40).

import { createReservedError } from '@zenith/errors';
import { defineDefaults, isServer } from '@zenith/shared';
import { driverByName } from './drivers';
import type { DataValidator, DriverName, Serializer, StorageDriver, SyncBus } from './types';


/** پیش‌فرض‌های فریزشده (SPEC §۰.۲). */
export const DEFAULTS = defineDefaults({
  namespace: 'zen',
  version: 1,
  ttl: 'never' as number | 'never',
  sync: true,
  sensitive: false,
  onQuotaExceeded: 'evict-oldest' as const,
  serializer: JSON as Serializer,
  cookie: { path: '/', sameSite: 'Strict' as const, secure: true },
});

export function isQuotaError(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? '';
  return /quota|exceed|full/i.test(name);
}

export function runValidate(validate: DataValidator | undefined, value: unknown): unknown {
  if (!validate) return value;
  return typeof validate === 'function' ? validate(value) : validate.validate(value);
}

// باس پیش‌فرض: رویداد StorageEvent مرورگر (فقط DOM؛ publish no-op).
export function defaultSyncBus(): SyncBus {
  const cbs = new Set<(key: string, removed: boolean, localWrite: boolean) => void>();
  // storage event هرگز در تبِ ناشر fire نمی‌شود ⇒ localWrite=false
  const handler = (event: Event) => {
    const e = event as StorageEvent;
    if (e.key) for (const cb of [...cbs]) cb(e.key, e.newValue === null, false);
  };
  let attached = false;
  return {
    subscribe(cb) {
      cbs.add(cb);
      if (!attached && !isServer()) {
        globalThis.window.addEventListener('storage', handler);
        attached = true;
      }
      return () => void cbs.delete(cb);
    },
    // مرورگر خودش نوشتن‌ها را به تب‌های دیگر می‌رساند؛ اینجا کاری نیست.
    publish() {},
    close() {
      // attached فقط در مرورگر true می‌شود ⇒ شرط اضافه لازم نیست
      if (attached) globalThis.window.removeEventListener('storage', handler);
      attached = false;
      cbs.clear();
    },
  };
}

/** نام درایور قابل‌شناسایی؛ هر چیز ناشناخته مثل «bogus» غیرمجاز است. */
export const KNOWN_DRIVERS = ['local', 'session', 'memory', 'cookie', 'indexeddb'];

export function isStorageAvailable(driver: DriverName | StorageDriver): boolean {
  try {
    if (typeof driver === 'string') {
      if (!KNOWN_DRIVERS.includes(driver)) return false;
      return driverByName(driver).available();
    }
    return driver.available();
  } catch {
    return false;
  }
}

export function validateTtl(ttl: number): number | null {
  if (ttl === 0) return null;
  if (!Number.isFinite(ttl) || ttl < 0) {
    // همان کاتالوگ ttl نامعتبر #171 (cache از ZEN-1201 استفاده می‌کند).
    throw createReservedError('ZEN-1201', { context: { ttl } });
  }
  return ttl;
}
