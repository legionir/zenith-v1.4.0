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

export {
  processErrorBoundary,
  showFallback,
  recoverFromError,
  resetErrorBoundary,
  type ErrorBoundaryOptions,
  type ErrorBoundaryRetryOptions,
} from './directive';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/error-boundary` (`ErrorReporterOptions`).
 * @default { redactPII: true }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  redactPII: true,
});
