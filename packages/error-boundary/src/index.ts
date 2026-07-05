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
  type ZenithError,
} from './boundary';

export {
  processErrorBoundary,
  showFallback,
  recoverFromError,
} from './directive';
