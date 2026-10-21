// packages/storage/src/attr.ts
//
// #145 — گرامر attributeهای zen-persist (SPEC §۲.۵ + §۰.۳):
//   zen-persist="cart"                ⇒ کلید
//   zen-persist-driver="local"        ⇒ local/session/indexeddb (پیش‌فرض local)
//   zen-persist-ttl="30s" | "never"   ⇒ مدت با گرامر §۰.۲ (shared.parseDuration)
//   zen-persist-version="2"           ⇒ عدد صحیح ≥ ۱
//   zen-persist-debounce="300ms"      ⇒ مدت (ms)
// ورودی نامعتبر ⇒ { invalid: true } (پرتاب خطا وظیفۀ directive/UI است —
// همان قرارداد parseCacheAttr #144).
import { parseDuration } from '@zenith/shared';
import type { DriverName, PersistConfig } from './types';

const DRIVERS = ['local', 'session', 'indexeddb'];

const given = (s: string | null | undefined): s is string =>
  s !== undefined && s !== null && s !== '';

export function parsePersistAttr(
  key: string,
  attrs: {
    driver?: string | null;
    ttl?: string | null;
    version?: string | null;
    debounce?: string | null;
  } = {},
): PersistConfig {
  if (typeof key !== 'string' || key.trim() === '') return { key: '', invalid: true };
  const config: PersistConfig = { key: key.trim() };

  if (given(attrs.driver)) {
    const driver = attrs.driver.trim().toLowerCase();
    if (!DRIVERS.includes(driver)) return { ...config, invalid: true };
    config.driver = driver as DriverName;
  }

  if (given(attrs.ttl)) {
    const ttl = parseDuration(attrs.ttl);
    if (Number.isNaN(ttl)) return { ...config, invalid: true };
    config.ttl = ttl;
  }

  if (given(attrs.version)) {
    const num = Number(attrs.version.trim());
    if (!Number.isInteger(num) || num < 1) return { ...config, invalid: true };
    config.version = num;
  }

  if (given(attrs.debounce)) {
    const d = parseDuration(attrs.debounce);
    if (d === 'never' || Number.isNaN(d)) return { ...config, invalid: true };
    config.debounce = d as number;
  }

  return config;
}
