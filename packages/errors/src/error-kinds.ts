// packages/errors/src/error-kinds.ts
//
// شدت/دسته، کدهای سه‌رقمی، الگو، docsUrl و بازه‌ها — استخراج مکانیکی از
// core.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


// ─────────────────────────────────────────────────────────────
// Error Categories
// ─────────────────────────────────────────────────────────────

/** شدت خطای زمان اجرا (#115). */
/** @public */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/** @public */
export type ErrorCategory =
  | 'Expression'
  | 'Runtime'
  | 'Resource'
  | 'SSR'
  | 'Security'
  | 'Compiler'
  | 'Router'
  | 'Form'
  | 'Component'
  | 'Internal'
  // #171 (DEC-020): دو دستهٔ جدید برای کاتالوگ ۴رقمی — افزودنی و سازگار؛
  // بازطراحی کامل مدل خطا موضوع #115 است.
  | 'Validation'
  | 'Network';

// ─────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────

/** @public */
export const ErrorCode = {
  // Expression / Validator (ZEN-001 to ZEN-099)
  EXPRESSION_VARIABLE_NOT_DEFINED: 'ZEN-001',
  EXPRESSION_SECURITY_FORBIDDEN_PROPERTY: 'ZEN-002',
  EXPRESSION_SECURITY_FORBIDDEN_IDENTIFIER: 'ZEN-003',
  EXPRESSION_SYNTAX_ERROR: 'ZEN-004',
  EXPRESSION_NOT_A_FUNCTION: 'ZEN-005',
  EXPRESSION_UNKNOWN_OPERATOR: 'ZEN-006',
  EXPRESSION_UNKNOWN_NODE_TYPE: 'ZEN-007',

  // Runtime / Directive (ZEN-100 to ZEN-199)
  RUNTIME_ZEN_FOR_NO_ZEN_KEY: 'ZEN-101',
  RUNTIME_ZEN_FOR_INVALID_SYNTAX: 'ZEN-102',
  RUNTIME_ZEN_FOR_NO_PARENT: 'ZEN-103',
  RUNTIME_ZEN_IF_NO_PARENT: 'ZEN-104',
  RUNTIME_DIRECTIVE_EXPRESSION_FAILED: 'ZEN-105',
  RUNTIME_COMPONENT_NOT_FOUND: 'ZEN-106',
  RUNTIME_DISPOSE_FAILED: 'ZEN-107',

  // Resource (ZEN-200 to ZEN-299)
  RESOURCE_DESTROYED: 'ZEN-201',
  RESOURCE_HTTP_ERROR: 'ZEN-202',
  RESOURCE_URL_EVALUATION_FAILED: 'ZEN-203',
  RESOURCE_SIGNAL_NOT_FOUND: 'ZEN-204',
  RESOURCE_MUTATION_FAILED: 'ZEN-205',

  // SSR (ZEN-300 to ZEN-399)
  SSR_JSDOM_REQUIRED: 'ZEN-301',
  SSR_NO_ROOT_ELEMENT: 'ZEN-302',
  SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE: 'ZEN-303',
  SSR_HYDRATION_MISMATCH: 'ZEN-304',

  // Security (ZEN-400 to ZEN-499)
  SECURITY_XSS_BLOCKED: 'ZEN-401',
  SECURITY_SANITIZATION_FAILED: 'ZEN-402',
  // #64: CSPRNG در دسترس نیست — تولید شناسه‌ی امن با Math.random ممنوع است.
  SECURITY_RANDOM_SOURCE_UNAVAILABLE: 'ZEN-403',
  // #62: انتخاب localStorage/cookie برای توکن حساس — در dev هشدار داده می‌شود.
  SECURITY_INSECURE_TOKEN_STORAGE: 'ZEN-404',

  // Compiler (ZEN-500 to ZEN-599)
  COMPILE_UNKNOWN_DIRECTIVE: 'ZEN-501',
  COMPILE_EXPRESSION_ERROR: 'ZEN-502',
  COMPILE_SYNTAX_ERROR: 'ZEN-503',
  COMPILE_MISSING_IMPORT: 'ZEN-504',

  // JS/VM (ZEN-550 to ZEN-559) — runtime evaluation errors
  JS_VM_RUNTIME_ERROR: 'ZEN-551',
  JS_VM_TIMEOUT: 'ZEN-552',
  JS_VM_MEMORY_LIMIT: 'ZEN-553',

  // Router (ZEN-600 to ZEN-699)
  ROUTER_ROUTE_NOT_FOUND: 'ZEN-601',
  ROUTER_LAZY_LOAD_FAILED: 'ZEN-602',
  ROUTER_NAVIGATION_ABORTED: 'ZEN-603',

  // Form (ZEN-700 to ZEN-799)
  FORM_VALIDATION_FAILED: 'ZEN-701',
  FORM_SCHEMA_INVALID: 'ZEN-702',

  // Component (ZEN-800 to ZEN-899)
  COMPONENT_SLOT_NOT_FOUND: 'ZEN-801',
  COMPONENT_PROP_REQUIRED: 'ZEN-802',

  // Internal (ZEN-900 to ZEN-999)
  INTERNAL_UNKNOWN: 'ZEN-901',
  // #115 (DEC-031): کدهای مسیر واحد خطای زمان‌اجرا (hub در ./hub.ts).
  /** خطای runtime directive/effect که از reportError/emitError عبور می‌کند. */
  INTERNAL_RUNTIME_FAILURE: 'ZEN-905',
  /** خطای reactivity (effect) که به hub گزارش شده. */
  INTERNAL_REACTIVITY_FAILURE: 'ZEN-906',
  /** misuse عمومی API (تبدیل throw ساده به ZenithError). */
  INTERNAL_DEVELOPER_ERROR: 'ZEN-907',
  /** ناهم‌خوانی hydration SSR. */
  INTERNAL_HYDRATION_MISMATCH: 'ZEN-908',
} as const;

/** @public */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─────────────────────────────────────────────────────────────
// Error-code space & ranges (#171، مصوب DEC-020)
// ─────────────────────────────────────────────────────────────

/**
 * الگوی رسمی کد خطا (دوآهنگ، DEC-020):
 *  - `ZEN-NNN` سه‌رقمی: کدهای کلاسیک موجود — هرگز renumber نمی‌شوند.
 *  - `ZEN-NNNN` چهاررقمی: بازه‌های پکیج‌های جدید (جدول `ERROR_CODE_RANGES`).
 *  - `ZEN-DEPR-NNN`: هشدارهای deprecation (DEC-019/DEC-026؛ حذف در ۲.۰).
 * هیچ regex قالب‌محور سه‌رقمی در مصرف‌کننده‌ها مجاز نیست (تست گیت #171).
 */
/** @public */
export const ERROR_CODE_PATTERN = /^ZEN-(?:\d{3}|\d{4}|DEPR-\d{3})$/;

/** لینک مستندات هر کد (SPEC §۰.۴). */
/** @public */
export function errorDocsUrl(code: string): string {
  return `https://zenith.dev/errors/${code}`;
}

/** @public */
export interface ErrorCodeRange {
  /** دامنه (نام پکیج/حوزه) — با `domain` هر catalog entry یکی باید باشد. */
  domain: string;
  from: number;
  to: number;
}

/** جدول بازههای ۴رقمی — SPEC §۰.۴ (DEC-020) + بازهٔ CLI (#102). */
/** @public */
export const ERROR_CODE_RANGES: readonly ErrorCodeRange[] = [
  { domain: 'schema', from: 1000, to: 1099 },
  { domain: 'storage', from: 1100, to: 1199 },
  { domain: 'cache', from: 1200, to: 1299 },
  { domain: 'i18n', from: 1300, to: 1399 },
  { domain: 'a11y', from: 1400, to: 1499 },
  { domain: 'head', from: 1500, to: 1599 },
  { domain: 'ui', from: 1600, to: 1699 },
  { domain: 'realtime', from: 1700, to: 1799 },
  { domain: 'adapters', from: 1800, to: 1899 },
  { domain: 'analytics', from: 1900, to: 1999 },
  { domain: 'theme', from: 2000, to: 2099 },
  { domain: 'auth-oauth', from: 2100, to: 2199 },
  { domain: 'feature-flags', from: 2200, to: 2299 },
  { domain: 'runtime-core', from: 2300, to: 2399 },
  { domain: 'devtools-core', from: 2400, to: 2499 },
  { domain: 'tooling', from: 2500, to: 2599 },
  // #102: قوانین `zenith check` — جایگزین کدهای قدیمی Z001..Z820 (دور از بازهٔ SPEC).
  { domain: 'cli', from: 9000, to: 9099 },
] as const;

/** @public */
export interface ReservedErrorMeta {
  domain: string;
  category: ErrorCategory;
  message: string;
  suggestion: string;
}