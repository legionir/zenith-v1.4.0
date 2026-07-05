// packages/errors/src/index.ts
//
// @zenith/errors — کتابخانه‌ی پیام‌های خطای Zenith
//
// این پکیج یک سیستم ساختاریافته برای خطاها فراهم می‌کند:
//   - کدهای خطای منظم (ZEN-001 تا ZEN-999)
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

// ─────────────────────────────────────────────────────────────
// ZenithError Class
// ─────────────────────────────────────────────────────────────

/**
 * کلاس پایه برای تمام خطاهای Zenith.
 *
 * @property code      کد خطا (مثلاً "ZEN-002")
 * @property category  دسته‌ی خطا (مثلاً "Expression")
 * @property message   پیام اصلی خطا
 * @property suggestion پیشنهاد برای رفع خطا (اختیاری)
 * @property details   جزئیات اضافی برای دیباگ (اختیاری)
 * @property context   context در زمان خطا (اختیاری)
 */
export class ZenithError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly suggestion?: string;
  readonly details?: Record<string, unknown>;
  readonly context?: Record<string, unknown>;
  readonly isDevMode: boolean;

  constructor(opts: {
    code: string;
    category: ErrorCategory;
    message: string;
    suggestion?: string;
    details?: Record<string, unknown>;
    context?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = 'ZenithError';
    this.code = opts.code;
    this.category = opts.category;
    this.suggestion = opts.suggestion;
    this.details = opts.details;
    this.context = opts.context;
    this.isDevMode = typeof globalThis !== 'undefined' &&
      (globalThis as any).__ZENITH_DEV__ !== false;

    // Maintain proper stack trace (V8 only).
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ZenithError);
    }
  }

  /**
   * تبدیل خطا به یک فرمت کاربرپسند برای نمایش در console.
   */
  toUserString(): string {
    let out = `❌ [${this.code}] ${this.category}: ${this.message}`;
    if (this.suggestion) {
      out += `\n\n💡 پیشنهاد: ${this.suggestion}`;
    }
    if (this.isDevMode && this.details) {
      out += `\n\n🔍 جزئیات: ${JSON.stringify(this.details, null, 2)}`;
    }
    return out;
  }

  /**
   * تبدیل خطا به JSON برای API responses.
   */
  toJSON(): Record<string, unknown> {
    return {
      error: true,
      code: this.code,
      category: this.category,
      message: this.message,
      suggestion: this.suggestion,
      details: this.isDevMode ? this.details : undefined,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Error Categories
// ─────────────────────────────────────────────────────────────

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
  | 'Internal';

// ─────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────

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
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ─────────────────────────────────────────────────────────────
// Error Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * FEATURE (v1.0.0): خطای «متغیر تعریف‌نشده» با پیشنهاد typo correction.
 *
 * پیام اصلی: `Variable '$x' is not defined in context.`
 * پیام بهبودیافته: لیست متغیرهای available + پیشنهاد typo correction.
 */
export function variableNotDefinedError(
  varName: string,
  availableVars: string[] = [],
): ZenithError {
  // Levenshtein-like typo detection.
  const suggestion = findClosestMatch(varName, availableVars);

  const details: Record<string, unknown> = {};
  if (availableVars.length > 0) {
    details.availableVariables = availableVars;
  }
  if (suggestion) {
    details.suggestedVariable = suggestion;
  }

  return new ZenithError({
    code: ErrorCode.EXPRESSION_VARIABLE_NOT_DEFINED,
    category: 'Expression',
    message: `متغیر «${varName}» در context تعریف نشده است.`,
    suggestion: suggestion
      ? `آیا منظور شما «${suggestion}» بود؟ (اصلاح املا)`
      : availableVars.length > 0
        ? `متغیرهای موجود: ${availableVars.join('، ')}`
        : 'متغیری در context موجود نیست. مطمئن شوید state به‌درستی پاس داده شده.',
    details,
    context: { varName, availableVars },
  });
}

/**
 * FEATURE (v1.0.0): خطای «zen-key وجود ندارد» با مثال.
 */
export function zenForNoZenKeyError(
  expr: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.RUNTIME_ZEN_FOR_NO_ZEN_KEY,
    category: 'Runtime',
    message: `دایرکتیو zen-for روی «${expr}» attribute های zen-key ندارد.`,
    suggestion:
      `برای keyed diffing صحیح، zen-key اضافه کنید:\n` +
      `  <li zen-for="item in $items" zen-key="item.id">\n` +
      `بدون zen-key، reordering باعث destroy و rebuild تمام DOM node ها می‌شود (کندتر).`,
    details: { expr },
    context: { expr },
  });
}

/**
 * FEATURE (v1.0.0): خطای «Resource destroyed» با راهنمای ردیابی.
 */
export function resourceDestroyedError(
  resourceName: string,
  operation: string,
  destroyStack?: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.RESOURCE_DESTROYED,
    category: 'Resource',
    message: `Resource «${resourceName}» قبلاً destroy() شده است و عملیات «${operation}» مجاز نیست.`,
    suggestion:
      `این Resource با destroy() غیرفعال شده. برای ردیابی:\n` +
      `  ۱. در کد جستجو کنید: ${resourceName}.destroy()\n` +
      `  ۲. معمولاً در cleanup hooks (onUnmounted, useEffect cleanup) صدا زده می‌شود.\n` +
      `  ۳. برای revive کردن: ${resourceName}.reset()`,
    details: {
      resourceName,
      operation,
      destroyStack: destroyStack || 'Stack trace هنگام destroy() در دسترس نیست.',
    },
    context: { resourceName, operation },
  });
}

/**
 * FEATURE (v1.0.0): خطای SSR با تشخیص محیط.
 */
export function ssrEnvironmentError(
  issue: 'jsdom-missing' | 'als-unavailable' | 'no-root',
  details?: Record<string, unknown>,
): ZenithError {
  const isBrowser = typeof window !== 'undefined';
  const isNode = typeof process !== 'undefined' && process.versions?.node;

  let env = 'unknown';
  if (isBrowser) env = 'browser';
  else if (isNode) env = `Node.js ${process.versions.node}`;

  switch (issue) {
    case 'jsdom-missing':
      return new ZenithError({
        code: ErrorCode.SSR_JSDOM_REQUIRED,
        category: 'SSR',
        message: 'برای SSR به jsdom نیاز است اما نصب نیست.',
        suggestion:
          `jsdom را نصب کنید:\n` +
          `  npm install jsdom\n` +
          `  یا\n` +
          `  bun add jsdom\n\n` +
          `محیط فعلی: ${env}\n` +
          (isBrowser
            ? '⚠️ SSR در browser قابل اجرا نیست. این کد فقط در سرور (Node.js) کار می‌کند.'
            : ''),
        details: { environment: env, ...details },
        context: { issue, env },
      });

    case 'als-unavailable':
      return new ZenithError({
        code: ErrorCode.SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE,
        category: 'SSR',
        message: 'AsyncLocalStorage در دسترس نیست.',
        suggestion:
          `AsyncLocalStorage یک API داخلی Node.js است (node:async_hooks).\n` +
          `محیط فعلی: ${env}\n` +
          (isBrowser
            ? '⚠️ در browser، SSR پشتیبانی نمی‌شود.\n' +
              'اگر در browser هستید، از Zen.start مستقیم استفاده کنید (نه renderToString).'
            : 'Node.js 16+ لازم است. ورژن Node را بررسی کنید.'),
        details: { environment: env, ...details },
        context: { issue, env },
      });

    case 'no-root':
      return new ZenithError({
        code: ErrorCode.SSR_NO_ROOT_ELEMENT,
        category: 'SSR',
        message: 'عنصر root در HTML یافت نشد.',
        suggestion:
          `مطمئن شوید HTML ورودی یک body با محتوا دارد:\n` +
          `  <body><div id="app">...</div></body>\n` +
          `نه فقط: <body></body>`,
        details: { environment: env, ...details },
        context: { issue, env },
      });

    default:
      return new ZenithError({
        code: ErrorCode.INTERNAL_UNKNOWN,
        category: 'Internal',
        message: `خطای SSR ناشناخته: ${issue}`,
        details: { environment: env, ...details },
      });
  }
}

/**
 * FEATURE (v1.0.0): خطای امنیتی برای دسترسی ممنوعه.
 */
export function securityError(
  code: 'ZEN-002' | 'ZEN-003' | 'ZEN-401',
  property: string,
  isRuntime: boolean = false,
): ZenithError {
  const messages: Record<string, { msg: string; cat: ErrorCategory }> = {
    'ZEN-002': {
      msg: `دسترسی به پراپرتی «${property}» ممنوع است (prototype pollution).`,
      cat: 'Security',
    },
    'ZEN-003': {
      msg: `دسترسی به identifier «${property}» ممنوع است (global خطرناک).`,
      cat: 'Security',
    },
    'ZEN-401': {
      msg: `محتوای XSS مسدود شد: «${property}».`,
      cat: 'Security',
    },
  };
  const info = messages[code] ?? messages['ZEN-002']!;

  return new ZenithError({
    code,
    category: info.cat,
    message: info.msg,
    suggestion: isRuntime
      ? `این دسترسی در runtime توسط guard مسدود شد. ` +
        `اگر فکر می‌کنید این اشتباه است، expression را بررسی کنید.`
      : `این دسترسی در compile time توسط validator مسدود شد. ` +
        `از دسترسی به constructor، __proto__، prototype خودداری کنید.`,
    details: { property, isRuntime },
    context: { property },
  });
}

/**
 * FEATURE (v1.0.0): خطای HTTP برای Resource.
 */
export function resourceHttpError(
  url: string,
  status: number,
  statusText: string,
): ZenithError {
  const suggestion =
    status === 404
      ? `URL «${url}» یافت نشد (404). مسیر endpoint را بررسی کنید.`
      : status === 401 || status === 403
        ? `دسترسی غیرمجاز (${status}). کلید API یا credentials را بررسی کنید.`
        : status >= 500
          ? `خطای سرور (${status}). سرور در دسترس نیست یا خطای داخلی دارد.`
          : status === 0
            ? `درخواست شبکه ناموفق. سرور در حال اجرا است؟ CORS درست تنظیم شده؟`
            : `خطای HTTP ${status}. StatusText: ${statusText}`;

  return new ZenithError({
    code: ErrorCode.RESOURCE_HTTP_ERROR,
    category: 'Resource',
    message: `خطای HTTP ${status}: ${statusText}`,
    suggestion,
    details: { url, status, statusText },
    context: { url, status },
  });
}

/**
 * FEATURE (v1.0.0): خطای syntax برای expression.
 */
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
      `  $items.length > 0 ? \"بله\" : \"خیر\"\n` +
      `  $user.age > 18 && $user.active`,
    details: { expr, position, unexpectedToken },
    context: { expr, position },
  });
}

/**
 * FEATURE (v1.0.0): خطای zen-for invalid syntax.
 */
export function zenForInvalidSyntaxError(
  expr: string,
): ZenithError {
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
export function compileMissingImportError(
  importName: string,
  available?: string[],
): ZenithError {
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
export function jsVmRuntimeError(
  originalError: Error,
  expression?: string,
): ZenithError {
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
export function jsVmTimeoutError(
  expression: string,
  timeoutMs: number,
): ZenithError {
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
  const defaultThreshold = Math.max(
    1,
    Math.floor(normalized.length / 3),
  );
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
    .filter(x => x.distance <= threshold)
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
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1,     // deletion
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
export function isZenithError(err: unknown): err is ZenithError {
  if (err instanceof ZenithError) return true;
  // Duck typing برای cross-realm (iframe, VM context)
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    return typeof e.code === 'string' && (e.code as string).startsWith('ZEN-')
      && typeof e.category === 'string'
      && typeof e.message === 'string';
  }
  return false;
}

/**
 * تبدیل هر خطایی به ZenithError (اگر قبلاً نیست).
 */
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
