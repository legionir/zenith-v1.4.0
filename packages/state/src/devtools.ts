// packages/state/src/devtools.ts
//
// IMP-05 (v1.3.0): DevTools Helper — بررسی یکپارچه پرچم DevTools.
//
// این ماژول یک تابع واحد برای بررسی فعال بودن DevTools ارائه می‌دهد.
// قبلاً هر ماژول (registry.ts, batch.ts) به‌صورت جداگانه `globalThis as any`
// را چک می‌کرد که منجر به تکرار کد و ناسازگاری می‌شد.
//
// استفاده:
//   import { isDevtoolsEnabled } from './devtools';
//   if (isDevtoolsEnabled()) { ... }

/**
 * بررسی می‌کند که آیا DevTools فعال است یا خیر.
 *
 * دو راه برای فعال‌سازی:
 *   1. `globalThis.__ZENITH_DEVTOOLS__ = true` — فعال‌سازی صریح DevTools
 *   2. `globalThis.__ZENITH_DEV__ !== false` — پیش‌فرض در محیط development
 *
 * @returns true اگر DevTools فعال باشد.
 */
export function isDevtoolsEnabled(): boolean {
  return (
    (globalThis as any).__ZENITH_DEVTOOLS__ === true ||
    (globalThis as any).__ZENITH_DEV__ !== false
  );
}
