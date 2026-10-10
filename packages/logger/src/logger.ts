// packages/logger/src/logger.ts
//
// #143 — هستهٔ createLogger (SPEC §۲.۳).
//
// مسئولیت‌ها:
//   • فیلتر سطح (passesLevel) و ساخت LogEntry (clock, redact, format).
//   • محافظ sink خراب: try/catch دور هر sink؛ sink خطاکار حذف می‌شود و
//     دقیقاً یک‌بار ZEN-1091 از طریق sinkهای سالم *باقی‌مانده* گزارش می‌شود
//     ⇒ برنامه نمی‌شکند و حلقهٔ لاگ ساخته نمی‌شود (معیار پذیرش #143).
//   • logger.error(ZenithError): کد/پیام/suggestion در خود ورودی؛ و اگر
//     globalThis.reportError (نصب‌شده توسط error-boundary) وجود داشته باشد،
//     همان خطا به مسیر گزارش خطا هم می‌رود — بدون import از error-boundary
//     (لایهٔ L0؛ الگوی duck در DEC-021/#141).
//   • warnOnce per-instance (ست محلی) و dispose از createDisposer shared.
import { createDisposer, type Cleanup, type Disposable } from '@zenith/shared';
import { isZenithError, createReservedError } from '@zenith/errors';
import type { LogLevel, Logger, LoggerOptions, LogSink, FullLogger, LogEntry } from './types';
import { defaultLevel, passesLevel } from './levels';
import { consoleSink } from './sinks';
import { redactDetails, DEFAULT_REDACT } from './redact';
import { entryText } from './format';

/** وضعیت مشترک یک لاگر و همهٔ فرزندانش. */
interface Core {
  level: LogLevel;
  sinks: LogSink[];
  redact: readonly string[];
  format: (entry: LogEntry) => string;
  clock: () => number;
  disposed: boolean;
}

/**
 * ورودی گزارش «sink خراب» (SPEC §۲.۳ — ZEN-1091). پیام/سuggestion از
 * catalog errors (#171/DEC-020) می‌آید؛ اینجا فقط سازندهٔ ورودی است و
 * «یک‌بار بودن» را dispatch تضمین می‌کند (sink حذف‌شده دوباره پیدا نمی‌شود).
 */
function brokenSinkEntry(cause: unknown, name: string, t: number): LogEntry {
  const err = createReservedError('ZEN-1091', { cause, context: { sink: name } });
  return {
    level: 'error',
    scope: 'zen:logger',
    message: err.message,
    code: err.code,
    suggestion: err.suggestion,
    details: { sink: name, reason: cause instanceof Error ? cause.message : String(cause) },
    t,
  };
}

/**
 * entry را به sinkها می‌رساند. sink خطاکار (sync throw یا async reject)
 * حذف و — فقط وقتی `report` باشد — یک ZEN-1091 به باقی‌ماندهٔ sinkها می‌رود.
 * گزارش دوم ساخته نمی‌شود (report=false) ⇒ عمق dispatch حداکثر ۲: حلقهٔ
 * لاگ ممکن نیست و throw به برنامه پس نمی‌گردد.
 */
function dispatch(core: Core, entry: LogEntry, report: boolean): void {
  const fail = (sink: LogSink, error: unknown): void => {
    const at = core.sinks.indexOf(sink);
    if (at === -1) return; // قبلاً حذف شده (sync و async یکی را هدف نگیرند)
    core.sinks.splice(at, 1);
    if (!report) return;
    const r = brokenSinkEntry(error, sink.name || `sink#${at}`, core.clock());
    r.text = core.format(r);
    // dispatch دوم با report=false: هرگز گزارش زنجیره‌ای ⇒ بدون حلقه.
    dispatch(core, r, false);
  };
  for (let i = core.sinks.length - 1; i >= 0; i--) {
    const sink = core.sinks[i]!;
    try {
      const maybe: void | Promise<void> = sink(entry);
      if (maybe != null && typeof maybe.catch === 'function') {
        maybe.catch((error: unknown) => fail(sink, error));
      }
    } catch (error) {
      fail(sink, error);
    }
  }
}

function makeLogger(
  core: Core,
  scope: string,
  disposer: Disposable & { add(c: Cleanup): void },
): Logger {
  const warnedOnce = new Set<string>();

  const write = (
    level: Exclude<LogLevel, 'silent'>,
    msgOrError: string | Error,
    details?: Record<string, unknown>,
  ): void => {
    // dispose تمام sinkها را خالی می‌کند ⇒ dispatch بی‌کار می‌شود؛ نیازی به
    // چک جداگانهٔ disposed اینجا نیست (بودجهٔ حجم؛ dispatch روی لیست خالی O(0)).
    if (!passesLevel(core.level, level)) return;
    const entry: LogEntry = {
      level,
      scope,
      message: msgOrError instanceof Error ? msgOrError.message : msgOrError,
      t: core.clock(),
    };
    // ادغام details فقط وقتی هر دو طرف هست؛ در غیر صورت همان مرجع می‌ماند
    // تا spread هویت چرخه را گم نکند و redact درست '[Circular]' بزند.
    const errDetails = isZenithError(msgOrError) ? msgOrError.details : undefined;
    const merged =
      errDetails === undefined
        ? details
        : details === undefined
          ? errDetails
          : { ...errDetails, ...details };
    if (merged !== undefined) entry.details = redactDetails(merged, core.redact);
    if (isZenithError(msgOrError)) {
      entry.code = msgOrError.code;
      entry.suggestion = msgOrError.suggestion;
      const reporter = (globalThis as { reportError?: unknown }).reportError;
      if (typeof reporter === 'function') {
        try {
          (reporter as (err: unknown) => void)(msgOrError);
        } catch {
          /* best-effort — مسیر گزارش نباید لاگر را بشکند */
        }
      }
    }
    entry.text = core.format(entry);
    dispatch(core, entry, true);
  };

  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
    child: (sub) => makeLogger(core, `${scope}:${sub}`, disposer),
    isEnabled: (level) => level !== 'silent' && passesLevel(core.level, level),
    addSink: (sink) => {
      if (core.disposed) return () => {};
      core.sinks.push(sink);
      const remove = (): void => {
        const i = core.sinks.indexOf(sink);
        if (i !== -1) core.sinks.splice(i, 1);
      };
      disposer.add(remove);
      return remove;
    },
    warnOnce: (key, msg) => {
      if (warnedOnce.has(key)) return;
      warnedOnce.add(key);
      write('warn', msg);
    },
  };
}

/**
 * لاگر ساخت‌یافتهٔ Zenith (SPEC §۲.۳). خروجی `Logger & Disposable`:
 * `dispose()` sinkها را آزاد می‌کند (sinkهای دارای `dispose` — مثل
 * beaconSink — flush می‌شوند) و لاگر بعد از آن بی‌صدا هیچ کاری نمی‌کند.
 * `setLevel` فراتر از جدول SPEC است (پل `setLogLevel` لاگر پیش‌فرض و تست).
 */
export function createLogger(opts?: LoggerOptions): FullLogger {
  const core: Core = {
    level: opts?.level ?? defaultLevel(),
    sinks: opts?.sinks ? [...opts.sinks] : [consoleSink()],
    redact: opts?.redact ?? DEFAULT_REDACT,
    format: opts?.format ?? entryText,
    clock: opts?.clock ?? Date.now,
    disposed: false,
  };
  const disposer = createDisposer();
  const logger = makeLogger(core, opts?.scope ?? 'zen', disposer);
  return Object.assign(logger, {
    setLevel: (level: LogLevel): void => {
      core.level = level;
    },
    dispose: () => {
      if (core.disposed) return;
      core.disposed = true;
      const sinks = [...core.sinks];
      core.sinks.length = 0;
      for (const sink of sinks) {
        try {
          sink.dispose?.();
        } catch {
          /* best-effort — آزادسازی نباید throw کند */
        }
      }
      disposer.run();
    },
  });
}
