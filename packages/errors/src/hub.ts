// ─────────────────────────────────────────────────────────────
// #115 (DEC-031) — hub خطای واحد سراسری.
//
// تنها مسیر «انتشار» خطای زمان اجرا در کل فریمورک همین‌جاست:
//   - `onError(handler)` → Cleanup (تک‌نام عمومی؛ state و error-boundary فقط
//     re-export/wrapper دارند — قاعدهٔ گیت scripts/error-hygiene.mjs).
//   - `emitError(err | partial)` → نرمال‌سازی به `ZenithError` (class همین
//     پکیج)، history حلقوی، log از طریق sink تزریق‌پذیر (بدون دسترسی
//     مستقیم متنی به console در کد پکیج؛ مرز رسمی = ./print)
//     مستقیم در مسیر خطا).
//   - `getErrorHistory` / `clearErrorHistory` / `setDevMode` / `isDevMode`.
//
// چرخهٔ مجاز: `errors` هیچ dependency‌ای ندارد (L0) — scheduler می‌تواند
// به‌صورت dependency مستقیم import کند (قاعدهٔ peer فقط state/scheduler را
// محدود می‌کند؛ DEC-018/DEC-031). state و error-boundary روی همان class
// سوار می‌شوند؛ هیچ interface موازی دیگری وجود ندارد.
//
// types مشترک (ErrorSeverity/ErrorCategory) در ./core تعریف شده‌اند تا
// barrel بدون ambiguity باشد؛ اینجا فقط import می‌شوند.

import {
  ZenithError,
  isZenithError,
  ErrorCode,
  type ErrorCategory,
  type ErrorSeverity,
} from './core';
import { printToHost } from './print';

/** امضای listener سراسری — همان آبجکت `ZenithError` به همه می‌رسد. */
/** @public */
export type ErrorHandler = (error: ZenithError) => void;

/** sink لاگ تزریق‌پذیر (#115: جلوگیری از چاپ مستقیم در error-path). */
/** @public */
export interface ErrorLogSink {
  (severity: ErrorSeverity | 'devgroup', title: string, payload?: Record<string, unknown>): void;
}

const handlers = new Set<ErrorHandler>();
let history: ZenithError[] = [];
const MAX_HISTORY = 50;
let devMode = false;

/**
 * #115: علامت «این خطا قبلاً از hub عبور کرده». effect آن را روی خطای خام
 * می‌گذارد و بعد rethrow می‌کند؛ scheduler همین علامت را می‌بیند و دوباره
 * emit نمی‌کند (وگرنه هر خطای effect دو بار در history ثبت می‌شد).
 */
const ROUTED: unique symbol = Symbol('zenith.error.routed');
/** @internal */
export function markErrorRouted(err: unknown): void {
  if (err && (typeof err === 'object' || typeof err === 'function')) {
    try {
      (err as unknown as Record<symbol, boolean>)[ROUTED] = true;
    } catch {
      /* frozen error — بی‌ضرر */
    }
  }
}
/** @internal */
export function isErrorRouted(err: unknown): boolean {
  return !!(err && typeof err === 'object' && (err as unknown as Record<symbol, boolean>)[ROUTED]);
}

let sink: ErrorLogSink | null = null;

/**
 * ثبت sink برای لاگ خطا (پیش‌فرض: `globalThis.__zenithLog` یا console).
 * تست‌ها و appها می‌توانند کبوترخانهٔ لاگ را عوض کنند؛ هرگز throw نمی‌کند.
 */
/** @public */
export function setErrorLogger(next: ErrorLogSink | null): void {
  sink = next;
}

function defaultLog(
  severity: ErrorSeverity | 'devgroup',
  title: string,
  payload?: Record<string, unknown>,
): void {
  // sink تزریق‌شده (setErrorLogger) اولویت دارد؛ وگرنه globalThis.__zenithLog؛
  // پشتیبانی (globalThis.__zenithLog)؛ وگرنه مرز رسمی ./print.
  // هیچ‌کدام در error-path throw نمی‌کند.
  if (sink) {
    try {
      sink(severity, title, payload);
    } catch {
      /* sink خراب نباید انتشار را متوقف کند */
    }
    return;
  }
  const g = globalThis as {
    console?: Partial<Console>;
    __zenithLog?: ErrorLogSink | null;
  };
  if (typeof g.__zenithLog === 'function') {
    try {
      g.__zenithLog(severity, title, payload);
    } catch {
      /* ignore */
    }
    return;
  }
  // #39: مرز چاپ به print.ts سپرده شد تا core.ts هم بتواند بدون ساخت
  // چرخه‌ی core↔hub از همان choke-point استفاده کند.
  printToHost(severity, title, payload);
}

function logError(err: ZenithError): void {
  const severity = err.severity ?? 'error';
  if (devMode) {
    defaultLog(severity, `[Zenith ${severity.toUpperCase()}] ${err.category}: ${err.code}`, {
      message: err.message,
      hint: err.hint ?? err.suggestion,
      context: err.context,
      details: err.details,
      docsUrl: err.docsUrl,
    });
    return;
  }
  if (severity === 'error' || severity === 'warning') {
    defaultLog(severity, err.message);
  }
}

/**
 * ثبت listener سراسری خطا. تنها `onError` عمومی اکوسیستم (#115).
 *
 * @returns تابع حذف (Cleanup) — idempotent.
 */
/** @public */
export function onError(handler: ErrorHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * ورودی `emitError`: یا یک `ZenithError` کامل، یا آبجکت partial هم‌نام
 * (سازگاری با فراخوانی‌های سبک قدیمی state/error-boundary).
 */
/** @public */
export type EmitErrorInput =
  | ZenithError
  | {
      message: string;
      code?: string;
      /**
       * مدل واحد: ErrorCategory (PascalCase). رشته‌های سبک قدیمی state
       * ('reactivity'|'expression'|'directive'|'runtime'|'ssr'|'security')
       * هم پذیرفته و نگاشت می‌شوند (#115 سازگاری؛ تایپ شل فقط برای partial).
       */
      category?:
        ErrorCategory | 'reactivity' | 'expression' | 'directive' | 'runtime' | 'ssr' | 'security';
      severity?: ErrorSeverity;
      hint?: string;
      suggestion?: string;
      details?: Record<string, unknown>;
      context?: Record<string, unknown>;
      stack?: string;
      cause?: unknown;
      /**
       * @deprecated #115: فیلد `recoverable` مدل جدید نیست؛ برای سازگاری با
       * فراخوانی‌های قدیمی state پذیرفته و نادیده گرفته می‌شود.
       */
      recoverable?: boolean;
    };

function normalize(input: EmitErrorInput): ZenithError {
  if (isZenithError(input)) return input;
  // backward-compat (#115): category‌های رشته‌ای سبک قدیمی state
  // ('reactivity' | 'expression' | …) به مدل واحد نگاشت می‌شوند تا
  // فراخوانی‌های partial قدیمی بدون شکست کار کنند.
  const CATEGORY_MAP: Record<string, ErrorCategory> = {
    expression: 'Expression',
    runtime: 'Runtime',
    reactivity: 'Runtime',
    directive: 'Runtime',
    ssr: 'SSR',
    security: 'Security',
    resource: 'Resource',
    router: 'Router',
    form: 'Form',
    compiler: 'Compiler',
  };
  const rawCategory = (input as { category?: string }).category;
  const mappedCategory: ErrorCategory =
    rawCategory && CATEGORY_MAP[rawCategory] !== undefined
      ? CATEGORY_MAP[rawCategory]
      : ((rawCategory as ErrorCategory | undefined) ?? 'Runtime');
  const err = new ZenithError({
    code: input.code ?? 'ZEN-905',
    category: mappedCategory,
    message: input.message,
    suggestion: input.suggestion ?? input.hint,
    details: input.details,
    context: input.context,
    cause: input.cause,
  });
  err.severity = input.severity ?? 'error';
  err.hint = input.hint;
  if (input.stack) err.stack = input.stack;
  return err;
}

/**
 * انتشار یک خطا در hub: history + listenerها + log (devMode یا severity).
 * خطای listener حلقهٔ لاگ نمی‌سازد و بقیه listenerها را نمی‌شکند.
 */
/** @public */
export function emitError<T extends ZenithError = ZenithError>(input: EmitErrorInput): T {
  const err = normalize(input) as T;

  history.push(err);
  if (history.length > MAX_HISTORY) history.shift();

  for (const handler of [...handlers]) {
    try {
      handler(err);
    } catch (handlerErr) {
      // یک listener خراب نباید بقیه را متوقف کند — فقط یک بار log (بدون بازپخش hub).
      defaultLog('error', '[Zenith] Error handler itself threw:', {
        handlerError: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
        original: err.message,
      });
    }
  }

  logError(err);
  return err;
}

/**
 * گزارش یک خطای خام (unknown) از یک source مشخص (#115 — تنها پیاده‌سازی
 * reportError؛ error-boundary به همین delegate می‌کند).
 *
 * اگر خودِ خطا از قبل `ZenithError` باشد، همان instance غنی‌سازی و منتشر
 * می‌شود (directiveهایی مثل zen-error به هویت آبجکت وابسته‌اند — کلون نکردن
 * الزامی است). `expression`/`element` روی فیلدهای مخصوص ست می‌شوند.
 */
/** @public */
export function reportError(
  error: unknown,
  source: string,
  context?: { expression?: string; element?: unknown; [key: string]: unknown },
): ZenithError {
  const base =
    error instanceof ZenithError
      ? error
      : new ZenithError({
          code: ErrorCode.INTERNAL_RUNTIME_FAILURE,
          category: categoryFromSource(source),
          message: error instanceof Error ? error.message : String(error),
          cause: error,
        });
  base.severity = base.severity ?? 'error';
  base.source = source;
  if (context?.expression !== undefined) base.expression = context.expression;
  if (context?.element !== undefined) base.element = context.element;
  return emitError(base);
}

/** نگاشت source (رشتهٔ مسیر) به category مدل واحد. */
function categoryFromSource(source: string): ErrorCategory {
  switch (source) {
    case 'expression':
    case 'directive':
    case 'effect':
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
      return 'Runtime';
  }
}

/** تاریخچهٔ حلقوی آخرین ۵۰ خطا. */
/** @public */
export function getErrorHistory(): ReadonlyArray<ZenithError> {
  return [...history];
}

/** پاکسازی تاریخچه (تست/resetForTesting). */
/** @public */
export function clearErrorHistory(): void {
  history = [];
}

/**
 * شمارهٔ «نسل» hub — هر clearErrorHandlers/resetErrorHubForTesting آن را
 * زیاد می‌کند. ماژول‌هایی که فید داخلی دارند (error-boundary) با تغییرش
 * می‌فهمند listenerشان پاک شده و دوباره ثبت می‌کنند (#115).
 */
let generation = 0;
/** @internal */
export function errorHubGeneration(): number {
  return generation;
}

/** حذف تمام listenerها — فقط برای ایزوله‌سازی تست. */
/** @public */
export function clearErrorHandlers(): void {
  handlers.clear();
  generation++;
}

/** حالت توسعه: پیام‌های غنی‌تر در sink. */
/** @public */
export function setDevMode(enabled: boolean): void {
  devMode = enabled;
}

/** @public */
export function isDevMode(): boolean {
  return devMode;
}

/** بازنشانی کامل hub (تست) — تاریخچه + listener؛ devMode و sink دست نمی‌خورد. */
/** @internal */
export function resetErrorHubForTesting(): void {
  clearErrorHistory();
  clearErrorHandlers();
}
