// packages/errors/src/core.ts
//
// @zenith/errors — کتابخانه‌ی پیام‌های خطای Zenith (هسته: کلاس + کاتالوگ)
// #115/DEC-031: hub سراسری در ./hub.ts است؛ این فایل هیچ import داخلی‌ای
// (به‌جز برگهٔ بی‌وابستگی‌ی ./print برای مرز چاپ #39) ندارد تا چرخهٔ
// index↔hub ساخته نشود (dependency-cruiser no-circular).
//
// این پکیج یک سیستم ساختاریافته برای خطاها فراهم می‌کند:
//   - کدهای خطای منظم (ZEN-001 تا ZEN-999 + بازه‌های ۴رقمی پکیج‌های جدید، #171)
//   - پیام‌های فارسی قابل‌فهم برای کاربر
//   - پیشنهادها (suggestions) برای رفع خطا
//   - جزئیات (details) برای دیباگ
//   - Stack trace برای ردیابی منشأ خطا
//
// ── ساختار کدها ──
//
// ZEN-001 تا ZEN-099: خطاهای Expression / Validator
// ZEN-100 تا ZEN-199: خطاهای Runtime / Directive
// ZEN-200 تا ZEN-299: خطاهای Resource
// ZEN-300 تا ZEN-399: خطاهای SSR
// ZEN-400 تا ZEN-499: خطاهای Security
// ZEN-500 تا ZEN-599: خطاهای Compiler
// ZEN-600 تا ZEN-699: خطاهای Router
// ZEN-700 تا ZEN-799: خطاهای Form / Validation
// ZEN-800 تا ZEN-899: خطاهای Component
// ZEN-900 تا ZEN-999: خطاهای عمومی / Internal
//
// ZEN-1000 تا ZEN-2599: بازه‌های ۴رقمی پکیج‌های جدید (#171، DEC-020؛ جدول
// ERROR_CODE_RANGES + کاتالوگ RESERVED_ERROR_CODES) — کدهای سه‌رقمی موجود
// هرگز renumber نمی‌شوند.
// ZEN-DEPR-000 تا ZEN-DEPR-999: هشدارهای deprecation (DEC-019؛ رجیستری
// DEPRECATION_CODES؛ حذف در ۲.۰ طبق DEC-026).


// #40: این فایل حالا فقط barrel است؛ پیاده‌سازی در ماژول‌های هم‌نام
// (سطح عمومی عین قبل — index.ts با `export *` همان نام‌ها را می‌دهد).
export * from './error-class';
export * from './error-kinds';
// نیمه‌های کاتالوگ (`_A`/`_B`) جزو سطح عمومی نیستند؛ فقط ادغام‌شده export می‌شود.
export { RESERVED_ERROR_CODES, type ReservedErrorMeta } from './reserved-codes';
export * from './error-messages-en';
export * from './error-locale';
export * from './deprecation-codes';
export * from './error-deprecate';
export * from './error-factories-a';
export * from './error-factories-b';
