// packages/errors/src/index.ts
//
// barrel عمومی @zenith/errors (#115/DEC-031):
//   - ./core  → کلاس ZenithError + کاتالوگ کدها (بدون import داخلی)
//   - ./hub   → مسیر واحد انتشار خطا (onError/emitError/reportError/…)
//
// مصرف‌کننده‌ها فقط از این barrel import می‌کنند.

export * from './core';
export {
  onError,
  emitError,
  reportError,
  getErrorHistory,
  clearErrorHistory,
  clearErrorHandlers,
  errorHubGeneration,
  markErrorRouted,
  isErrorRouted,
  setErrorLogger,
  resetErrorHubForTesting,
  setDevMode,
  isDevMode,
  type ErrorHandler,
  type ErrorLogSink,
  type EmitErrorInput,
} from './hub';
