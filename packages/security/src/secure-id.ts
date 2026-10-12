// packages/security/src/secure-id.ts
//
// #64 — تولید شناسه‌ی امن.
//
// هر شناسه/توکن/nonce با اهمیت امنیتی (نشست، CSRF، کلید کش تصادفی، id
// ردیابی) باید از CSPRNG بیاید: `crypto.getRandomValues`. هیچ fallback با
// `Math.random` وجود ندارد — نبود crypto یعنی خطای صریح ZenithError، چون
// هویت‌های قابل‌حدس‌زدن آسیب‌پذیری‌اند (OWASP: Session Fixation /
// Predictable Value Range).

import { ZenithError } from '@zenith/errors';

/** طول پیش‌فرض شناسه به بایت (۱۶ بایت = ۱۲۸ بیت آنتروپی). */
const DEFAULT_BYTES = 16;

/**
 * یک شناسه‌ی تصادفیHex با `bytes` بایت آنتروپی از `crypto.getRandomValues`.
 *
 * @param bytes تعداد بایت‌های تصادفی (پیش‌فرض ۱۶).
 * @returns رشته‌ی hex به طول `bytes * 2` حروف کوچک.
 * @throws {ZenithError} ZEN-403 اگر `crypto.getRandomValues` در دسترس نباشد.
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
    // بدون fallback غیرامن: هویت قابل‌حدس‌زدن بدتر از نبود هویت است.
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
