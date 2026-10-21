// packages/error-boundary/src/boundary.ts
//
// #115 (DEC-031) — error-boundary دیگر سیستم خطای موازی نیست:
// listener/history/devMode همه در hub (`@zenith/errors`) زندگی می‌کنند و
// این فایل فقط دو چیز اضافه می‌کند:
//   1) `errorSignal` — signal سراسری «آخرین خطا» (وابسته به state؛ peer).
//   2) `reportError(error, source, context)` — enrich کردن خطا با
//      source/expression/element و feed کردنش به hub (بدون listener محلی).
//
// `ZenithError` محلی (interface قدیمی) حذف شد؛ نوع INFO = همان کلاس
// `ZenithError` از @zenith/errors با فیلدهای اختیاری source/expression/element
// که reportError ست می‌کند.

import { signal, type Signal } from '@zenith/state';
import {
  ZenithError,
  onError as onErrorFrom,
  reportError as hubReport,
  clearErrorHistory,
  getErrorHistory,
  errorHubGeneration,
} from '@zenith/errors';

/**
 * اطلاعات یک خطای رخ‌داده — مدل واحد (#115): همان کلاس `ZenithError` از
 * `@zenith/errors`. فیلدهای مسیر (source/expression/element) همان‌جا
 * تعریف شده‌اند (element به‌صورت `unknown` تا errors DOM-free بماند؛
 * مصرف‌کننده‌های DOM آن را به HTMLElement نگاشت می‌کنند).
 */
export type ZenithErrorInfo = ZenithError;

// #115: کلاس واحد از @zenith/errors re-export می‌شود (همان آبجکت؛ نه wrapper).
export { ZenithError };

/**
 * Signal سراسری خطای فعلی. اگر null باشد خطایی وجود ندارد.
 * listener داخلی روی hub پرش می‌کند — یعنی هر خطایی (directive، effect،
 * scheduler، emitError مستقیم) errorSignal را آپدیت می‌کند.
 */
export const errorSignal: Signal<ZenithErrorInfo | null> =
  /* @__PURE__ */ signal<ZenithErrorInfo | null>(null);

// فید داخلی: هر خطای hub روی errorSignal منعکس می‌شود. lazy ثبت می‌شود
// (sideEffects:false — بدون effect در زمان import): اولین باری که از مسیر
// boundary (reportError/onError/clearErrorBoundary) عبور می‌کنیم فید ساخته
// می‌شود؛ اگر hub بین تست‌ها بازنشانی شود (clearErrorHandlers/
// resetErrorHubForTesting)، ضمانت نسل (generation) فید را دوباره ثبت می‌کند.
let hubUnsub: (() => void) | null = null;
let feedGeneration = -1;
function ensureSignalFeed(): void {
  const gen = errorHubGeneration();
  if (hubUnsub && feedGeneration === gen) return;
  // hub بازنشانی شده (تست‌ها) یا هنوز فید نگرفته‌ایم — دوباره ثبت می‌کنیم.
  hubUnsub?.();
  feedGeneration = gen;
  hubUnsub = onErrorFrom((err) => {
    errorSignal.set(err);
  });
}

/**
 * ثبت یک callback برای خطاها — wrapper روی hub (`onError` واحد #115) که
 * فید errorSignal را هم (lazy) فعال نگه می‌دارد.
 *
 * @returns تابع unsubscribe (Cleanup) — idempotent.
 */
export function onError(handler: Parameters<typeof onErrorFrom>[0]): () => void {
  ensureSignalFeed();
  return onErrorFrom(handler);
}

/**
 * گزارش یک خطا (unknown) به hub با enrich کردن source/expression/element.
 *
 * #115: دیگر listener موازی ندارد؛ دقیقاً همان مسیری که directive/effect/
 * scheduler می‌روند: hub.reportError → emitError → همهٔ onError listenerها
 * + history + (به‌واسطهٔ فید داخلی) errorSignal. همان instance کلون نمی‌شود.
 */
export function reportError(
  error: unknown,
  source: string,
  context?: { expression?: string; element?: HTMLElement },
): void {
  // بازنشانی فید در صورتی که hub (مثلاً بین تست‌ها) پاک شده باشد.
  ensureSignalFeed();
  hubReport(error, source, context);
}

/**
 * پاکسازی خطای فعلی (signal). تاریخچهٔ hub دست‌نخورده می‌ماند
 * (رفتار قبلی هم همین بود — `clearError` فقط signal را null می‌کرد).
 */
export function clearError(): void {
  errorSignal.set(null);
}

/**
 * پاکسازی کامل Error Boundary (برای تست‌ها): history + listenerهای hub
 * + signal. مصرف‌کنندهٔ production نباید صدا بزند.
 */
export function clearErrorBoundary(): void {
  if (hubUnsub) {
    hubUnsub();
    hubUnsub = null;
    feedGeneration = -1;
  }
  clearErrorHistory();
  errorSignal.set(null);
  ensureSignalFeed();
}

// دسترسی‌های کمکی برای تست/ادیباگ (#115 شواهد).
export { getErrorHistory };

// ── #93: External Error Reporters (Sentry, OpenTelemetry, etc.) with PII Redaction ──

export interface ExternalErrorReport {
  code: string;
  category: string;
  message: string;
  source?: string;
  expression?: string;
  context: Record<string, unknown>;
  timestamp: number;
  error: ZenithError;
}

export type ExternalErrorReporter = (report: ExternalErrorReport) => void | Promise<void>;

export interface ErrorReporterOptions {
  /** Redact PII fields and patterns by default (`true`). */
  redactPII?: boolean;
  /** Additional sensitive key names to redact. */
  redactKeys?: string[];
  /** Static or dynamic context enrichment (`route`, `userId`, `release`, etc.). */
  enrichContext?: Record<string, unknown> | (() => Record<string, unknown>);
}

const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'secret',
  'clientsecret',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'ssn',
  'creditcard',
  'cardnumber',
]);

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

export function redactPIIValue(
  value: unknown,
  extraKeys?: ReadonlySet<string>,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof value === 'string') {
    return value
      .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
      .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactPIIValue(item, extraKeys, seen));
  }
  // Skip DOM nodes
  if (typeof (value as { nodeType?: unknown }).nodeType === 'number') {
    return `[DOMElement:${(value as { tagName?: string }).tagName ?? 'Node'}]`;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = k.toLowerCase().replace(/[-_]/g, '');
    if (DEFAULT_SENSITIVE_KEYS.has(normalizedKey) || extraKeys?.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactPIIValue(v, extraKeys, seen);
    }
  }
  return out;
}

/**
 * #93: Register an external error reporter (e.g. Sentry, OpenTelemetry) with
 * automatic PII redaction, structured context enrichment, and fault isolation.
 *
 * @returns Idempotent `Cleanup` function (`() => void`).
 */
export function addReporter(
  reporter: ExternalErrorReporter,
  options: ErrorReporterOptions = {},
): () => void {
  const shouldRedact = options.redactPII !== false;
  const extraKeys = options.redactKeys
    ? new Set(options.redactKeys.map((k) => k.toLowerCase()))
    : undefined;

  const unsubscribe = onError((err: ZenithError) => {
    try {
      const extraCtx =
        typeof options.enrichContext === 'function'
          ? options.enrichContext()
          : (options.enrichContext ?? {});
      const mergedContext: Record<string, unknown> = {
        ...(err.context ?? {}),
        ...(err.details ?? {}),
        ...extraCtx,
        ...(err.source ? { source: err.source } : {}),
        ...(err.expression ? { expression: err.expression } : {}),
      };

      const safeContext = shouldRedact
        ? (redactPIIValue(mergedContext, extraKeys) as Record<string, unknown>)
        : mergedContext;
      const safeMessage = shouldRedact
        ? (redactPIIValue(err.message, extraKeys) as string)
        : err.message;

      const report: ExternalErrorReport = {
        code: err.code,
        category: err.category,
        message: safeMessage,
        source: err.source ?? (mergedContext.source as string | undefined),
        expression: err.expression ?? (mergedContext.expression as string | undefined),
        context: safeContext,
        timestamp: err.timestamp ?? Date.now(),
        error: err,
      };

      const maybePromise = reporter(report);
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        (maybePromise as Promise<void>).catch(() => {
          /* fault-isolated: broken async reporter must never crash the app */
        });
      }
    } catch {
      /* fault-isolated: broken sync reporter must never crash the app */
    }
  });

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
  };
}
