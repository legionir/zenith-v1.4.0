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
import { logger, installDiagnosticLogger } from './default';
import type { LogLevel, LogSink } from './types';
import type { Cleanup } from '@zenith/shared';

/** @public */
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
/** @public */
export type { ConsoleSinkOptions, BufferSinkOptions, BufferSink } from './sinks';
/** @public */
export type { OnceOptions } from './deprecate';

/** @public */
export { createLogger } from './logger';
/** @public */
export { consoleSink, bufferSink, beaconSink } from './sinks';
/** @public */
export { deprecate, warnDeprecated, warnOnce } from './deprecate';

/** @public */
export { logger, installDiagnosticLogger };

let globalBridgeInstalled = false;
/** @public */
export function setLogLevel(level: LogLevel): void {
  if (!globalBridgeInstalled) { globalBridgeInstalled = true; installDiagnosticLogger(); }
  logger.setLevel(level);
}

/** @public */
export function addSink(sink: LogSink): Cleanup {
  return logger.addSink(sink);
}

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/logger` (`LoggerOptions`).
 * @default { level: 'warn', scope: 'zen', maxBufferSize: 100 }
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  level: 'warn' as const,
  scope: 'zen',
  maxBufferSize: 100,
});
