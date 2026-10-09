// packages/state/src/error.ts
//
// Zenith Error Management System
// Centralized error handling for effects, expressions, directives and runtime

export type ErrorSeverity = 'error' | 'warning' | 'info';
export type ErrorCategory = 'reactivity' | 'expression' | 'directive' | 'runtime' | 'ssr' | 'security';

export interface ZenithError {
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  timestamp: number;
  stack?: string;
  context?: Record<string, any>;
  hint?: string;
}

export type ErrorHandler = (error: ZenithError) => void;

const errorHandlers: Set<ErrorHandler> = new Set();
let lastErrors: ZenithError[] = [];
const MAX_HISTORY = 50;
let devMode = false;

/**
 * Set development mode for more detailed error messages
 */
export function setDevMode(enabled: boolean): void {
  devMode = enabled;
}

/**
 * Check if running in development mode
 */
export function isDevMode(): boolean {
  return devMode;
}

/**
 * Register a global error handler
 * @example
 * onError(err => {
 *   console.error('[Zenith]', err.message);
 *   Sentry.captureException(err);
 * });
 */
export function onError(handler: ErrorHandler): () => void {
  errorHandlers.add(handler);
  return () => errorHandlers.delete(handler);
}

/**
 * Emit an error through the central system
 */
export function emitError(error: Omit<ZenithError, 'timestamp'>): ZenithError {
  const fullError: ZenithError = {
    ...error,
    timestamp: Date.now(),
  };

  // Store in history
  lastErrors.push(fullError);
  if (lastErrors.length > MAX_HISTORY) {
    lastErrors.shift();
  }

  // Notify all handlers
  for (const handler of errorHandlers) {
    try {
      handler(fullError);
    } catch (handlerError) {
      // Prevent infinite loops - just log
      console.error('[Zenith] Error handler itself threw:', handlerError);
    }
  }

  // In dev mode, also log to console with rich info
  if (devMode) {
    const style =
      fullError.severity === 'error'
        ? 'color: #dc2626; font-weight: bold;'
        : fullError.severity === 'warning'
          ? 'color: #d97706; font-weight: bold;'
          : 'color: #2563eb; font-weight: bold;';

    console.groupCollapsed(
      `%c[Zenith ${fullError.severity.toUpperCase()}] ${fullError.category}`,
      style,
    );
    console.log('Message:', fullError.message);
    if (fullError.hint)
      console.log('%cHint:', 'color: #059669; font-weight: bold;', fullError.hint);
    if (fullError.context) console.log('Context:', fullError.context);
    if (fullError.stack) console.log('Stack:', fullError.stack);
    console.log('Recoverable:', fullError.recoverable);
    console.groupEnd();
  } else if (fullError.severity === 'error') {
    console.error(`[Zenith] ${fullError.message}`);
  } else if (fullError.severity === 'warning') {
    console.warn(`[Zenith] ${fullError.message}`);
  }

  return fullError;
}

/**
 * Get recent error history
 */
export function getErrorHistory(): ReadonlyArray<ZenithError> {
  return [...lastErrors];
}

/**
 * Clear error history
 */
export function clearErrorHistory(): void {
  lastErrors = [];
}

/**
 * Wrap a function with error boundary - catches errors and routes them through central system
 */
export function errorBoundary<T extends (...args: any[]) => any>(
  fn: T,
  category: ErrorCategory,
  context?: Record<string, any>,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args);
    } catch (err) {
      emitError({
        message: err instanceof Error ? err.message : String(err),
        category,
        severity: 'error',
        recoverable: true,
        stack: err instanceof Error ? err.stack : undefined,
        context,
      });
      return undefined;
    }
  };
}
