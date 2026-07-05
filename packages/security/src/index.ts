// packages/security/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/security`.
//
// استفاده در runtime:
//   import { sanitizeHTML } from '@zenith/security';
//
// استفاده در تست‌ها یا کاربران پیشرفته:
//   import { sanitizeHTMLWithOptions, type SanitizeOptions } from '@zenith/security';

export {
  sanitizeHTML,
  sanitizeHTMLWithOptions,
  // FIX (v1.2.3): sanitizeHTMLTrusted قبلاً فقط در dist/index.js export می‌شد
  // ولی در src/index.ts فراموش شده بود. حالا برای هماهنگی src و dist، از source
  // هم export می‌شود. این تابع یک Identity Function است (ورودی را دست‌نخورده
  // برمی‌گرداند) و به‌عنوان marker صریح برای محتوای Trusted استفاده می‌شود.
  sanitizeHTMLTrusted,
  type SanitizeOptions,
} from './sanitizer';

// IMP-SEC-01: CSS Sanitizer
export { sanitizeCSS } from './sanitizer';

// IMP-SEC-02: CSP Helper
export { generateCSP, type CSPOptions } from './sanitizer';

// IMP-SEC-03: Trusted Types Integration
export { createTrustedTypesPolicy } from './sanitizer';
