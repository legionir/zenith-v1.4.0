// packages/logger/src/types.ts
//
// #143 — @zenith/logger (SPEC §۲.۳): قرارداد نوع لاگر.
import type { Cleanup, Disposable } from '@zenith/shared';

/** سطوح لاگ. `silent` فقط برای فیلتر است (خود لاگ نمی‌شود). */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** سطوح واقعی یک ورودی (بدون silent). */
export type LogRecordLevel = Exclude<LogLevel, 'silent'>;

/**
 * ورودی لاگ که به sinkها داده می‌شود. `text` خروجی تابع `format` لاگر است؛
 * sinkهای متنی (console در مرورگر) از آن استفاده می‌کنند. فیلدهای خام همیشه
 * می‌مانند تا sinkهای ساخت‌یافته (JSON/beacon) خودشان رندر کنند.
 */
export interface LogEntry {
  level: LogRecordLevel;
  /** مسیر scope با «:» — ریشه `'zen'`، مثال `'zen:form:email'`. */
  scope: string;
  message: string;
  /** timestamp از `clock` (پیش‌فرض `Date.now`). */
  t: number;
  /** کد خطا (مثلاً `ZEN-1091`/`ZEN-DEPR-001`) فقط وقتی ورودی از ZenithError است. */
  code?: string;
  suggestion?: string;
  /** details پس از اعمال redact. */
  details?: Record<string, unknown>;
  /** متن رندرشده با `format` لاگر (`entryText` پیش‌فرض). */
  text?: string;
}

/**
 * sink: تابعی که یک ورودی را می‌نویسد. `dispose` اختیاری است تا توابع ساده
 * (تست/استفادهٔ سریع) هم sink معتبر باشند؛ لاگر هنگام آزادسازی آن را صدا
 * می‌زند (SPEC §۰.۱ — پاک‌سازی زنجیره‌ای).
 */
export interface LogSink {
  (entry: LogEntry): void | Promise<void>;
  dispose?(): void;
}

/** امضای تابع فرمت؛ خروجی در `entry.text` و در consoleSink (مرورگر) مصرف می‌شود. */
export type LogFormat = (entry: LogEntry) => string;

/** گزینه‌های `createLogger` (SPEC §۲.۳ جدول گزینه‌ها). */
export interface LoggerOptions {
  /** پیشوند scope؛ پیش‌فرض `'zen'`. */
  scope?: string;
  /**
   * سطح فیلتر. پیش‌فرض: dev (`__ZENITH_DEV__ !== false`) ⇒ `'debug'`،
   * prod ⇒ `'warn'`.
   */
  level?: LogLevel;
  /** sinkهای اولیه؛ پیش‌فرض `[consoleSink()]`. */
  sinks?: LogSink[];
  /**
   * کلیدهایی که در `details` پوشیده می‌شوند (مطابقت نام حساس‌به‌_case).
   * پیش‌فرض: `['token','password','authorization','secret','cookie']`.
   */
  redact?: readonly string[];
  /** فرمت متن پیش‌فرض: `[zen:scope] CODE: message` (`entryText`). */
  format?: LogFormat;
  /** ساعت قابل‌جایگزینی (تست/سرور). */
  clock?: () => number;
}

/** رابط عمومی لاگر (SPEC §۲.۳). نمونهٔ برگشتی `createLogger` یک `Disposable` هم هست. */
export interface Logger {
  debug(msgOrError: string | Error, details?: Record<string, unknown>): void;
  info(msgOrError: string | Error, details?: Record<string, unknown>): void;
  warn(msgOrError: string | Error, details?: Record<string, unknown>): void;
  error(msgOrError: string | Error, details?: Record<string, unknown>): void;
  /** لاگر فرزند با scope به‌هم‌پیوسته: `parent.child('form')` ⇒ `[zen:form]`. */
  child(scope: string): Logger;
  isEnabled(level: LogLevel): boolean;
  /** sink اضافه می‌کند؛ `Cleanup` حذفش می‌کند (SPEC §۰.۱). */
  addSink(sink: LogSink): Cleanup;
  /** هشدار یک‌باره به‌ازای `key` در همین نمونه («یک‌بار در هر نمونه» SPEC §۲.۳). */
  warnOnce(key: string, msg: string): void;
}

/** لاگر کامل: `Logger & Disposable` (قرارداد §۰.۱ برای همهٔ createXها) + setLevel. */
export type FullLogger = Logger &
  Disposable & {
    /**
     * تغییر سطح. خارج از جدول API SPEC §۲.۳ است (آنجا setLogLevel فقط برای
     * لاگر پیش‌فرض آمده) و برای لاگرهای سفارشی/تست اضافه شده است.
     */
    setLevel(level: LogLevel): void;
  };
