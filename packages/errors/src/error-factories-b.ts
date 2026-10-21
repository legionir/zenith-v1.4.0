// packages/errors/src/error-factories-b.ts
//
// factoryهای خطای expression/کامپایلر/VM/روتر + ابزارهای typo و type-guard —
// استخراج مکانیکی از core.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده،
// اجرا نشده).

import { ZenithError } from './error-class';
import { ErrorCode, errorDocsUrl, type ErrorCategory } from './error-kinds';


/**
 * FEATURE (v1.0.0): خطای syntax برای expression.
 */
/** @public */
export function expressionSyntaxError(
  expr: string,
  position: number,
  unexpectedToken: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.EXPRESSION_SYNTAX_ERROR,
    category: 'Expression',
    message: `خطای syntax در position ${position}: token غیرمنتظره «${unexpectedToken}».`,
    suggestion:
      `Expression: «${expr}»\n` +
      `مثال‌های معتبر:\n` +
      `  $user.name\n` +
      `  $count + 1\n` +
      `  $items.length > 0 ? "بله" : "خیر"\n` +
      `  $user.age > 18 && $user.active`,
    details: { expr, position, unexpectedToken },
    context: { expr, position },
  });
}

/**
 * FEATURE (v1.0.0): خطای zen-for invalid syntax.
 */
/** @public */
export function zenForInvalidSyntaxError(expr: string): ZenithError {
  return new ZenithError({
    code: ErrorCode.RUNTIME_ZEN_FOR_INVALID_SYNTAX,
    category: 'Runtime',
    message: `سینتکس zen-for نامعتبر: «${expr}»`,
    suggestion:
      `سینتکس صحیح:\n` +
      `  zen-for="item in $items"\n` +
      `  zen-for="(item, index) in $items"\n` +
      `  zen-for="item in $items.filter(x => x.active)"`,
    details: { expr },
    context: { expr },
  });
}

// ─────────────────────────────────────────────────────────────
// Additional Factory Functions (BUG-ERR-01)
// ─────────────────────────────────────────────────────────────

/**
 * خطای کامپایلر: syntax error در source.
 * ZEN-503: COMPILE_SYNTAX_ERROR
 */
/** @public */
export function compileSyntaxError(
  source: string,
  line: number,
  column?: number,
  details?: Record<string, unknown>,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.COMPILE_SYNTAX_ERROR,
    category: 'Compiler',
    message: `Syntax error in ${source}:${line}${column ? `:${column}` : ''}`,
    suggestion: 'سینتکس قالب را بررسی کنید. پرانتزها، نقل‌قول‌ها و بلاک‌ها را چک کنید.',
    details: { source, line, column, ...details },
  });
}

/**
 * خطای کامپایلر: import گم‌شده.
 * ZEN-504: COMPILE_MISSING_IMPORT
 */
/** @public */
export function compileMissingImportError(importName: string, available?: string[]): ZenithError {
  const suggestion = available
    ? `importهای موجود: ${available.join(', ')}`
    : 'ماژول را import کنید یا نام آن را بررسی کنید.';
  return new ZenithError({
    code: ErrorCode.COMPILE_MISSING_IMPORT,
    category: 'Compiler',
    message: `ماژول "${importName}" یافت نشد.`,
    suggestion,
    details: { importName, available },
  });
}

/**
 * خطای runtime در evaluation Expression.
 * ZEN-551: JS_VM_RUNTIME_ERROR
 */
/** @public */
export function jsVmRuntimeError(originalError: Error, expression?: string): ZenithError {
  return new ZenithError({
    code: ErrorCode.JS_VM_RUNTIME_ERROR,
    category: 'Runtime',
    message: `Runtime error in expression${expression ? ` "${expression}"` : ''}: ${originalError.message}`,
    cause: originalError,
    details: {
      expression,
      originalName: originalError.name,
      stack: originalError.stack,
    },
  });
}

/**
 * خطای timeout در evaluation Expression.
 * ZEN-552: JS_VM_TIMEOUT
 */
/** @public */
export function jsVmTimeoutError(expression: string, timeoutMs: number): ZenithError {
  return new ZenithError({
    code: ErrorCode.JS_VM_TIMEOUT,
    category: 'Runtime',
    message: `Expression execution timed out after ${timeoutMs}ms: "${expression}"`,
    suggestion: 'حلقه‌های بی‌نهایت یا عملیات سنگین را بررسی کنید.',
    details: { expression, timeoutMs },
  });
}

/**
 * خطای مسیریابی: ناوبری لغو شد.
 * ZEN-603: ROUTER_NAVIGATION_ABORTED
 */
/** @public */
export function routerNavigationAbortedError(
  from: string,
  to: string,
  reason?: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.ROUTER_NAVIGATION_ABORTED,
    category: 'Router',
    message: `Navigation from "${from}" to "${to}" was aborted${reason ? `: ${reason}` : ''}.`,
    suggestion: 'از abort دلیل اطمینان حاصل کنید یا ناوبری را مجدداً امتحان کنید.',
    details: { from, to, reason },
  });
}

// ─────────────────────────────────────────────────────────────
// Typo Detection Helper (Levenshtein distance)
// ─────────────────────────────────────────────────────────────

/**
 * یافتن نزدیک‌ترین تطابق با استفاده از Levenshtein distance.
 *
 * @param input نام متغیر ورودی (مثلاً "$usr")
 * @param candidates لیست متغیرهای موجود (مثلاً ["$user", "$data"])
 * @param maxDistance حداکثر فاصله مجاز (پیش‌فرض: ۵۰٪ طول رشته بلندتر، حداقل ۱)
 * @returns نزدیک‌ترین تطابق یا null
 */
/** @public */
export function findClosestMatch(
  input: string,
  candidates: string[],
  maxDistance?: number,
): string | null {
  if (candidates.length === 0) return null;

  // Normalize: remove $ prefix for comparison.
  const normalized = input.replace(/^\$/, '');

  // BUG-ERR-03: آستانه نسبی برای واژه‌های کوتاه
  // برای واژه‌های ۲-۳ حرفی، threshold مطلق ۱ از threshold نسبی بهتر است
  // تا suggestions بی‌ربط ندهد. برای واژه‌های بلندتر، ۵۰٪ طول منطقی است.
  const defaultThreshold = Math.max(1, Math.floor(normalized.length / 3));
  const threshold = maxDistance ?? defaultThreshold;

  const normalizedCandidates = candidates.map((c) => ({
    original: c,
    normalized: c.replace(/^\$/, ''),
  }));

  // مرتب‌سازی بر اساس distance برای بازگشت نزدیک‌ترین‌ها
  const scored = normalizedCandidates
    .map(({ original, normalized: candidate }) => ({
      original,
      distance: levenshtein(normalized, candidate),
    }))
    .filter((x) => x.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);

  return scored.length > 0 ? scored[0]!.original : null;
}

/**
 * محاسبه Levenshtein distance بین دو رشته.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

// ─────────────────────────────────────────────────────────────
// Utility: isZenithError type guard
// ─────────────────────────────────────────────────────────────

/**
 * BUG-ERR-04: بررسی می‌کند که آیا یک مقدار `ZenithError` است یا خیر.
 *
 * از duck typing برای سناریوهای cross-realm (iframe, VM context در تست)
 * استفاده می‌کند. بررسی `code.startsWith('ZEN-')` احتمال false positive
 * را کاهش می‌دهد.
 *
 * @param err مقدار مورد بررسی
 * @returns `true` اگر مقدار ZenithError باشد
 */
/** @public */
export function isZenithError(err: unknown): err is ZenithError {
  if (err instanceof ZenithError) return true;
  // Duck typing برای cross-realm (iframe, VM context)
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return (
      typeof e.code === 'string' &&
      (e.code as string).startsWith('ZEN-') &&
      typeof e.category === 'string' &&
      typeof e.message === 'string'
    );
  }
  return false;
}

/**
 * تبدیل هر خطایی به ZenithError (اگر قبلاً نیست).
 */
/** @public */
export function toZenithError(err: unknown): ZenithError {
  if (isZenithError(err)) return err;
  if (err instanceof Error) {
    return new ZenithError({
      code: ErrorCode.INTERNAL_UNKNOWN,
      category: 'Internal',
      message: err.message,
      cause: err,
    });
  }
  return new ZenithError({
    code: ErrorCode.INTERNAL_UNKNOWN,
    category: 'Internal',
    message: String(err),
  });
}

/**
 * #115 (DEC-031): خطای programmer/misuse — `throw developerError(...)`.
 * با کد مشخص‌شده (پیش‌فرض ZEN-907 = misuse عمومی API) و پیام یکسان
 * `ZEN-NNN: متن`. پیشوند اختصاصی `[Zenith] …` دیگر لازم نیست؛ code و
 * docsUrl خودشان منبع را مشخص می‌کنند.
 *
 * @example
 *   throw developerError('[zen-for] Element must have a parent node.', ErrorCode.RUNTIME_ZEN_IF_NO_PARENT);
 */
/** @public */
export function developerError(
  message: string,
  code: string = 'ZEN-907',
  opts?: {
    category?: ErrorCategory;
    suggestion?: string;
    details?: Record<string, unknown>;
    context?: Record<string, unknown>;
    cause?: unknown;
  },
): ZenithError {
  return new ZenithError({
    code,
    category: opts?.category ?? 'Runtime',
    message: `${code}: ${message}`,
    suggestion: opts?.suggestion,
    details: opts?.details,
    context: opts?.context,
    cause: opts?.cause,
    docsUrl: errorDocsUrl(code),
  });
}