// packages/logger/src/index.ts
//
// #143 — @zenith/logger: لاگر مرکزی Zenith (SPEC §۲.۳).
//
// قوانین لایه (گیت: test/layering.test.ts):
//   • وابستگی فقط errors + shared (L0). هیچ import از error-boundary (L2):
//     اتصال به مسیر گزارش خطا از طریق globalThis.reportError در زمان اجرا.
//   • import در سطح ماژول به window/document دسترسی ندارد (env-import).
//   • بودجه ≤ ۲KB gzip (size-budget + .size-limit.json).
//   • تنها مصرف‌کنندهٔ console در کل ورک‌اسپیس: sinks.ts (consoleSink).
import { logger } from './default';
import type { LogLevel, LogSink } from './types';
import type { Cleanup } from '@zenith/shared';

export type {
  LogLevel,
  LogRecordLevel,
  LogEntry,
  LogSink,
  LogFormat,
  LoggerOptions,
  Logger,
  FullLogger,
} from './types';
export type { ConsoleSinkOptions, BufferSinkOptions, BufferSink } from './sinks';
export type { OnceOptions } from './deprecate';

export { createLogger } from './logger';
export { consoleSink, bufferSink, beaconSink } from './sinks';
export { deprecate, warnOnce } from './deprecate';

// نمونهٔ پیش‌فرض (scope `zen`) — در ./default ساخته می‌شود (بدون چرخهٔ import).
export { logger };

/** سطح لاگر پیش‌فرض را تنظیم می‌کند (SPEC §۲.۳ — `(level) => void`). */
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}

/** sink به لاگر پیش‌فرض اضافه می‌کند؛ `Cleanup` حذفش می‌کند (SPEC §۰.۱). */
export function addSink(sink: LogSink): Cleanup {
  return logger.addSink(sink);
}
