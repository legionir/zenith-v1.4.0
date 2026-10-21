// packages/errors/src/error-factories-a.ts
//
// factoryهای خطای دامنه (متغیر/zen-key/resource/SSR/امنیت/HTTP) — استخراج
// مکانیکی از core.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { ZenithError } from './error-class';
import { ErrorCode, type ErrorCategory } from './error-kinds';
import { findClosestMatch } from './error-factories-b';


// ─────────────────────────────────────────────────────────────
// Error Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * FEATURE (v1.0.0): خطای «متغیر تعریف‌نشده» با پیشنهاد typo correction.
 *
 * پیام اصلی: `Variable '$x' is not defined in context.`
 * پیام بهبودیافته: لیست متغیرهای available + پیشنهاد typo correction.
 */
/** @public */
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
/** @public */
export function zenForNoZenKeyError(expr: string): ZenithError {
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
/** @public */
export function resourceDestroyedError(
  resourceName: string,
  operation: string,
  destroyStack?: string,
): ZenithError {
  return new ZenithError({
    code: ErrorCode.RESOURCE_DESTROYED,
    category: 'Resource',
    message: `Resource «${resourceName}» قبلاً dispose() شده است و عملیات «${operation}» مجاز نیست.`,
    suggestion:
      `این Resource با dispose() غیرفعال شده. برای ردیابی:\n` +
      `  ۱. در کد جستجو کنید: ${resourceName}.dispose()\n` +
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
/** @public */
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
/** @public */
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
/** @public */
export function resourceHttpError(url: string, status: number, statusText: string): ZenithError {
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