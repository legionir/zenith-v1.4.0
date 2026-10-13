// packages/error-boundary/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/error-boundary`.
//
// استفاده در runtime:
//   import { onError, reportError, errorSignal } from '@zenith/error-boundary';
//
// استفاده در دایرکتیو:
//   import { processErrorBoundary } from '@zenith/error-boundary';

export {
  errorSignal,
  onError,
  reportError,
  clearError,
  clearErrorBoundary,
  getErrorHistory,
  addReporter,
  redactPIIValue,
  ZenithError,
  type ZenithErrorInfo,
  type ExternalErrorReport,
  type ExternalErrorReporter,
  type ErrorReporterOptions,
} from './boundary';

export { processErrorBoundary, showFallback, recoverFromError } from './directive';
