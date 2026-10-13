export {
  processSuspense,
  createSuspense,
  createSuspenseContext,
  trackPromise,
  withTimeout,
  type SuspenseController,
  type SuspenseContext,
  type SuspenseContextOptions,
  type SuspenseOptions,
  type SuspenseState,
  type TrackPromiseOptions,
  type WithTimeoutOptions,
} from './suspense';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/suspense` (`SuspenseOptions`).
 * @default { timeout: 0, minDelay: 0 }
 * @unit ms (timeout, minDelay)
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  timeout: 0,
  minDelay: 0,
});

