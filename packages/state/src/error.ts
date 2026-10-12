// packages/state/src/error.ts
//
// #115 (DEC-031) — سازگاری backwards: مدل خطای واحد در @zenith/errors است
// (کلاس `ZenithError` + hub `onError/emitError/reportError`). این فایل تنها
// re-export و یک wrapper کوچک برای `errorBoundary` است؛ هیچ state محلی
// (handler set / history / devMode) دیگر اینجا وجود ندارد.
//
// - `ZenithError` (type) حالا به کلاس errors alias شده است. فیلدهای
//   `severity/hint` روی همان کلاس اضافه شدند (اختیاری، سازگار).
// - `errorBoundary` (helper) بی‌نام‌تغییر ماند تا مصرف‌کننده‌های داخلی/خارجی
//   نشکنند؛ category رشته‌ای قدیمی به category کلاس نگاشت می‌شود.

import {
  ZenithError as ZenithErrorClass,
  emitError as hubEmit,
  ErrorCode,
  type ErrorCategory,
} from '@zenith/errors';

// ── re-export API واحد (#115) ──
export {
  onError,
  emitError,
  getErrorHistory,
  clearErrorHistory,
  setErrorLogger,
  resetErrorHubForTesting,
} from '@zenith/errors';
export {
  setDevMode,
  isDevMode,
  type ErrorHandler,
  type ErrorSeverity,
  type ErrorCategory,
} from '@zenith/errors';

/**
 * @deprecated #115: interface محلی state حذف شد؛ مدل واحد، کلاس
 * `ZenithError` از `@zenith/errors` است. این alias فقط برای سازگاری نام
 * type باقی مانده و در ۲.۰ حذف می‌شود (DEC-026).
 */
export type ZenithError = ZenithErrorClass;

// ── نگاشت category‌های رشته‌ای قدیمی state → مدل واحد ──
// (state قدیمی `category: 'reactivity' | 'expression' | … lowercase` داشت؛
//  مدل واحد category‌های PascalCase دارد. تبدیل بی‌صدا نمی‌خواهیم — map
//  صریح + fallback Internal.)
function mapCategory(c: string | undefined): ErrorCategory {
  switch (c) {
    case 'expression':
      return 'Expression';
    case 'runtime':
    case 'reactivity':
    case 'directive':
      return 'Runtime';
    case 'ssr':
      return 'SSR';
    case 'security':
      return 'Security';
    case 'resource':
      return 'Resource';
    case 'router':
      return 'Router';
    case 'form':
      return 'Form';
    case 'compiler':
      return 'Compiler';
    default:
      return 'Internal';
  }
}

/**
 * Wrap a function with a local error boundary — catch + report به hub.
 *
 * @deprecated #115: نام helper قدیمی state؛ semantic معادل `try/catch` +
 * `emitError` است و بعداً به `@zenith/errors` منتقل می‌شود (یا در #134
 * error-boundary retry بازنویسی می‌شود). موقتاً رفتار قبلی حفظ شده.
 */
export function errorBoundary<T extends (...args: never[]) => unknown>(
  fn: T,
  category: string,
  context?: Record<string, unknown>,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args) as ReturnType<T>;
    } catch (err) {
      const z =
        err instanceof ZenithErrorClass
          ? err
          : new ZenithErrorClass({
              code: ErrorCode.INTERNAL_RUNTIME_FAILURE,
              category: mapCategory(category),
              message: err instanceof Error ? err.message : String(err),
              context,
              cause: err,
            });
      z.severity = z.severity ?? 'error';
      z.stack = err instanceof Error ? err.stack : z.stack;
      hubEmit(z);
      return undefined;
    }
  };
}
