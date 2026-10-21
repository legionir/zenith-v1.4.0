// packages/errors/src/error-locale.ts
//
// زبان پیام‌ها، نقشهٔ legacy انگلیسی، getErrorMessage و createReservedError —
// استخراج مکانیکی از core.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده،
// اجرا نشده).

import { ZenithError } from './error-class';
import { errorDocsUrl } from './error-kinds';
import { RESERVED_ERROR_CODES } from './reserved-codes';
import { ERROR_MESSAGES_EN } from './error-messages-en';

/**
 * خطای ZenithError از کاتالوگ رزروشده (۴رقمی) — پیام/suggestion/docsUrl خودکار.
 * @throws اگر code در catalog نباشد (جلوگیری از مصرف کد ثبت‌نشده).
 */
// ─────────────────────────────────────────────────────────────
// Locale لایهٔ ترجمهٔ پیام‌ها (#102)
// ─────────────────────────────────────────────────────────────

/** زبان پیام‌های خطا (fa پیش‌فرض کانونیک؛ en ترجمهٔ کاتالوگ). */
/** @public */
export type ErrorLocale = 'fa' | 'en';

let currentLocale: ErrorLocale = 'fa';

/** #102: انتخاب زبان پیام‌های کاتالوگ (اثر global؛ به‌کارگیری در ابزارها/CLI). */
/** @public */
export function setErrorLocale(locale: ErrorLocale): void {
  currentLocale = locale;
}

/** #102: زبان جاری پیام‌های خطا. */
/** @public */
export function getErrorLocale(): ErrorLocale {
  return currentLocale;
}

/**
 * توضیح استاتیک انگلیسی کدهای سه‌رقمی قدیمی (#102).
 * پیام runtime این کدها template/پارامتری است (مثل نام متغیر) و همچنان فارسی
 * ساخته می‌شود؛ این نقشه برای مستندات و layout ترجمهٔ سطح کد است.
 */
/** @public */
export const LEGACY_ERROR_MESSAGES_EN: Readonly<Record<string, string>> = {
  'ZEN-001': 'Variable is not defined in the context.',
  'ZEN-002': 'Access to a forbidden property in the expression (security).',
  'ZEN-003': 'Forbidden identifier in the expression (security).',
  'ZEN-004': 'Expression syntax error.',
  'ZEN-005': 'The expression is not a function.',
  'ZEN-006': 'Unknown operator in the expression.',
  'ZEN-007': 'Unknown node type in the expression AST.',
  'ZEN-101': 'zen-for requires zen-key.',
  'ZEN-102': 'Invalid zen-for syntax.',
  'ZEN-103': 'zen-for element has no parent.',
  'ZEN-104': 'zen-if element has no parent.',
  'ZEN-105': 'Directive expression evaluation failed.',
  'ZEN-106': 'Component not found in the registry.',
  'ZEN-107': 'Component dispose failed.',
  'ZEN-201': 'Resource has been destroyed.',
  'ZEN-202': 'HTTP error while fetching the resource.',
  'ZEN-203': 'Resource URL evaluation failed.',
  'ZEN-204': 'Resource signal not found.',
  'ZEN-205': 'Resource mutation failed.',
  'ZEN-301': 'SSR requires a DOM implementation (JSDOM-compatible).',
  'ZEN-302': 'Root element not found for SSR.',
  'ZEN-303': 'AsyncLocalStorage unavailable for SSR isolation.',
  'ZEN-304': 'Hydration mismatch between server and client markup.',
  'ZEN-401': 'XSS blocked: untrusted markup neutralized.',
  'ZEN-402': 'Sanitization failed: input rejected.',
  'ZEN-403': 'Secure random source unavailable.',
  'ZEN-404': 'Insecure token storage detected.',
  'ZEN-501': 'Unknown directive at compile time.',
  'ZEN-502': 'Compile-time expression error.',
  'ZEN-503': 'Compile-time syntax error.',
  'ZEN-504': 'Missing import at compile time.',
  'ZEN-551': 'Sandbox (VM) runtime error.',
  'ZEN-552': 'Sandbox timeout.',
  'ZEN-553': 'Sandbox memory limit exceeded.',
  'ZEN-601': 'Route not found.',
  'ZEN-602': 'Lazy route loading failed.',
  'ZEN-603': 'Navigation aborted by a guard.',
  'ZEN-701': 'Form validation failed.',
  'ZEN-702': 'Form schema invalid.',
  'ZEN-801': 'Slot not found.',
  'ZEN-802': 'Required prop missing.',
  'ZEN-901': 'Unknown internal error.',
  'ZEN-905': 'Internal runtime failure.',
  'ZEN-906': 'Internal reactivity failure.',
  'ZEN-907': 'Developer precondition violated (assert).',
  'ZEN-908': 'Internal hydration mismatch.',
};

/**
 * #102: message/suggestion یک کد رزورشده بر اساس زبان.
 * اگر `locale` حذف شود از زبان جاری (setErrorLocale) استفاده می‌کند. کدهای
 * ناشناخته undefined برمی‌گردانند.
 */
/** @public */
export function getErrorMessage(
  code: string,
  opts?: { locale?: ErrorLocale },
): { message: string; suggestion: string } | undefined {
  const locale = opts?.locale ?? currentLocale;
  const meta = RESERVED_ERROR_CODES[code];
  if (!meta) return undefined;
  if (locale === 'en')
    return ERROR_MESSAGES_EN[code] ?? { message: meta.message, suggestion: meta.suggestion };
  return { message: meta.message, suggestion: meta.suggestion };
}

/** @public */
export function createReservedError(
  code: keyof typeof RESERVED_ERROR_CODES | string,
  opts?: { details?: Record<string, unknown>; context?: Record<string, unknown>; cause?: unknown },
): ZenithError {
  const meta = RESERVED_ERROR_CODES[code];
  if (!meta) {
    throw new Error(
      `[errors] کد «${String(code)}» در catalog رزورشده (#171) ثبت نشده؛ ` +
        `ابتدا آن را با بازهٔ درست اضافه کنید (DEC-020).`,
    );
  }
  // #102: با setErrorLocale('en') پیام‌های کاتالوگ انگلیسی تولید می‌شوند.
  const localized = getErrorMessage(code) ?? { message: meta.message, suggestion: meta.suggestion };
  return new ZenithError({
    code,
    category: meta.category,
    // دستورالعمل §۱۰: پیام‌ها `[CODE] prefix` دارند تا assert/regex روی message
    // کار کند (#112 لینک docs را اضافه می‌کند؛ #171 کاتالوگ).
    message: `[${code}] ${localized.message}`,
    suggestion: localized.suggestion,
    docsUrl: errorDocsUrl(code),
    details: opts?.details,
    context: opts?.context,
    cause: opts?.cause,
  });
}
