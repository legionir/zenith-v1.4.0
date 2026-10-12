// packages/shared/src/id.ts
//
// #141 — دو سازندهٔ شناسه با مرز امنیتی روشن (SECURITY/OWASP: هیچ Math.random
// برای شناسهٔ امن؛ هیچ مقدار قابل‌حدس‌زدنی در SSR برای idهای غیرامنیتی):
//   • createId: شناسهٔ DOM/ARIA (id dialog، key for) — شمارندهٔ قطعی.
//     در SSR باید برای هر درخواست `resetIdCounter()` صدا زده شود تا خروجی
//     سرور و hydration مرورگر یکسان باشد (SPEC §۲.۱ «SSR» و §۰.۵).
//   • secureId: شناسهٔ امنیتی (توکن/nonce) — فقط crypto.getRandomValues
//     (قاعدهٔ #64؛ بدون fallback غیرامن، خطای ZEN-403).

import { ZenithError } from '@zenith/errors';

const DEFAULT_ID_PREFIX = 'zen';
const DEFAULT_BYTES = 16;

let counter = 0;

/**
 * شناسهٔ ترتیبی قطعی: `zen-1`، `zen-2` … (یا با prefix سفارشی).
 * امنیتی **نیست** — برای id/label/ARIA به کار می‌رود.
 */
export function createId(prefix: string = DEFAULT_ID_PREFIX): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/**
 * شمارندهٔ `createId` را صفر می‌کند. هدف: شروع deterministic هر درخواست SSR
 * (و تست). بین دو reset، خروجی همیشه یکسان است → hydration mismatch ندارد.
 */
export function resetIdCounter(): void {
  counter = 0;
}

/**
 * شناسهٔ امن hex با `bytes` بایت آنتروپی از `crypto.getRandomValues` (#64).
 *
 * @param bytes تعداد بایت (پیش‌فرض ۱۶ = ۱۲۸ بیت)، صحیح ۱..۱۰۲۴.
 * @returns hex کوچک با طول `bytes * 2`.
 * @throws {ZenithError} ZEN-403 برای طول نامعتبر یا نبود crypto (fallback غیرامن نداریم).
 */
export function secureId(bytes: number = DEFAULT_BYTES): string {
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > 1024) {
    throw new ZenithError({
      code: 'ZEN-403',
      category: 'Security',
      message: `secureId: طول بایت نامعتبر است (${String(bytes)}). باید عدد صحیح ۱ تا ۱۰۲۴ باشد.`,
      suggestion: 'secureId(16) پیش‌فرض برای شناسه‌های امن مناسب است.',
      details: { bytes },
    });
  }
  const webcrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (!webcrypto || typeof webcrypto.getRandomValues !== 'function') {
    throw new ZenithError({
      code: 'ZEN-403',
      category: 'Security',
      message:
        'secureId: crypto.getRandomValues در این محیط در دسترس نیست؛ تولید شناسه‌ی امن با Math.random ممنوع است.',
      suggestion:
        'روی Node ≥19.0 یا مرورگر مدرن crypto به‌صورت global وجود دارد؛ در Node 18 با globalThis.crypto از node:crypto استفاده کنید (require crypto.webcrypto).',
      details: { environment: typeof globalThis },
    });
  }
  const buffer = new Uint8Array(bytes);
  webcrypto.getRandomValues(buffer);
  let hex = '';
  for (const byte of buffer) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
