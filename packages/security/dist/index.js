// packages/security/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/security`.
//
// استفاده در runtime:
//   import { sanitizeHTML } from '@zenith/security';
//
// استفاده در تست‌ها یا کاربران پیشرفته:
//   import { sanitizeHTMLWithOptions, type SanitizeOptions } from '@zenith/security';
//
// FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
//   import { sanitizeHTMLTrusted } from '@zenith/security';
//   (هیچ پاکسازی‌ای انجام نمی‌دهد — فقط یک marker صریح + dev warn است.)
export { sanitizeHTML, sanitizeHTMLWithOptions, sanitizeHTMLTrusted, } from './sanitizer.js';
//# sourceMappingURL=index.js.map