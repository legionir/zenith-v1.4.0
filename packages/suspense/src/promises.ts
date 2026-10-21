import { deprecate } from '@zenith/errors';
import { trackPromiseOptions, withTimeoutOptions } from './options';
import { secureId } from '@zenith/security';
import type { TrackPromiseOptions, WithTimeoutOptions, SuspenseContext, SuspenseController } from './types';

function isTrackPromiseOptions(val: unknown): val is TrackPromiseOptions {
  if (typeof val !== 'object' || val === null) return false;
  return !('startLoading' in val) && !('track' in val);
}

/**
 * Track a promise inside a Suspense boundary (#55: options-object signature).
 */
/** @public */
export function trackPromise<T>(promise: Promise<T>, options?: TrackPromiseOptions): Promise<T>;
/** @deprecated Use `trackPromise(promise, { suspense, key, timeout })` (#55, ZEN-DEPR-037). */
/** @public */
export function trackPromise<T>(
  promise: Promise<T>,
  suspense?: SuspenseContext | SuspenseController,
  key?: string,
  timeout?: number,
): Promise<T>;
/** @public */
export function trackPromise<T>(
  promise: Promise<T>,
  optionsOrSuspense?: TrackPromiseOptions | SuspenseContext | SuspenseController,
  legacyKey?: string,
  legacyTimeout?: number,
): Promise<T> {
  let opts: TrackPromiseOptions;
  if (
    legacyKey !== undefined ||
    legacyTimeout !== undefined ||
    (optionsOrSuspense !== undefined && !isTrackPromiseOptions(optionsOrSuspense))
  ) {
    deprecate(
      'ZEN-DEPR-037',
      'trackPromise(promise, suspense, key, timeout)',
      'trackPromise(promise, { suspense, key, timeout })',
    );
    opts = {
      suspense: optionsOrSuspense as SuspenseContext | SuspenseController | undefined,
      key: legacyKey,
      timeout: legacyTimeout,
    };
  } else {
    opts = trackPromiseOptions.resolve(optionsOrSuspense);
  }

  const trackKey = opts.key ?? `zen-promise-${secureId(4)}`;
  const tracked =
    opts.timeout && opts.timeout > 0 ? withTimeout(promise, { ms: opts.timeout }) : promise;

  if (!opts.suspense) return tracked;

  if ('track' in opts.suspense) {
    opts.suspense.track(tracked);
    return tracked;
  }

  const targetCtx: SuspenseContext = opts.suspense;
  targetCtx.startLoading(trackKey);
  return tracked.then(
    (value) => {
      targetCtx.stopLoading(trackKey);
      return value;
    },
    (err) => {
      targetCtx.reportError(err instanceof Error ? err.message : String(err));
      throw err;
    },
  );
}

/**
 * Wrap a promise with a timeout (#55: options-object signature).
 */
/** @public */
export function withTimeout<T>(promise: Promise<T>, options: WithTimeoutOptions): Promise<T>;
/** @deprecated Use `withTimeout(promise, { ms, message })` (#55, ZEN-DEPR-038). */
/** @public */
export function withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T>;
/** @public */
export function withTimeout<T>(
  promise: Promise<T>,
  msOrOptions: number | WithTimeoutOptions,
  legacyMessage?: string,
): Promise<T> {
  let ms: number;
  let message: string;
  if (typeof msOrOptions === 'number') {
    deprecate(
      'ZEN-DEPR-038',
      'withTimeout(promise, ms, message)',
      'withTimeout(promise, { ms, message })',
    );
    ms = msOrOptions;
    message = legacyMessage ?? `Operation timed out after ${ms}ms`;
  } else {
    const resolved = withTimeoutOptions.resolve(msOrOptions);
    ms = resolved.ms;
    message = resolved.message ?? `Operation timed out after ${ms}ms`;
  }

  if (ms <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
