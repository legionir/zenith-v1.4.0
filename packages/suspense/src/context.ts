import { signal } from '@zenith/state';
import { deprecate } from '@zenith/errors';
import { suspenseContextOptions } from './options';
import type { SuspenseContext, SuspenseContextOptions, SuspenseState } from './types';

/** @public */
export function createSuspenseContext(options?: SuspenseContextOptions): SuspenseContext;
/** @public @deprecated Use createSuspenseContext({ timeoutMs, onSettle }) (ZEN-DEPR-065). */
export function createSuspenseContext(
  timeoutMs?: number,
  onSettle?: (settled: boolean) => void,
): SuspenseContext;
export function createSuspenseContext(
  timeoutOrOptions?: number | SuspenseContextOptions,
  legacyOnSettle?: (settled: boolean) => void,
): SuspenseContext {
  // #55: امضای positional در ۲.۰ حذف می‌شود (DEC-026).
  const legacy = typeof timeoutOrOptions === 'number' || (arguments.length > 1 && timeoutOrOptions === undefined);
  if (legacy) {
    deprecate(
      'ZEN-DEPR-065',
      'createSuspenseContext(timeoutMs, onSettle)',
      'createSuspenseContext({ timeoutMs, onSettle })',
    );
  }
  const resolved = legacy ? undefined : suspenseContextOptions.resolve(timeoutOrOptions);
  const timeoutMs = legacy ? (timeoutOrOptions as number | undefined) ?? 0 : resolved?.timeoutMs ?? 0;
  const onSettle = legacy ? legacyOnSettle : resolved?.onSettle;
  const loadingSet = new Set<string>();
  const sig = signal<SuspenseState>({
    loading: false,
    pendingCount: 0,
    timedOut: false,
    error: null,
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  function armTimeout() {
    if (timeoutMs > 0 && timeoutHandle === null) {
      timeoutHandle = setTimeout(() => {
        timeoutHandle = null;
        sig.set({
          loading: false,
          pendingCount: loadingSet.size,
          timedOut: true,
          error: null,
        });
      }, timeoutMs);
    }
  }

  function clearTimeoutHandle() {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  // BUG-SUS-01 FIX: `settled` را برای اطلاع به parent (onSettle) نگه می‌داریم.
  let _prevSettled = true; // حالت اولیه settled است (loading=0).

  function updateState() {
    const pendingCount = loadingSet.size;
    const isLoading = pendingCount > 0;
    const current = sig.get();

    // شروع timeout timer وقتی loading شروع می‌شود.
    if (
      isLoading &&
      !current.timedOut &&
      !current.error &&
      timeoutMs > 0 &&
      timeoutHandle === null
    ) {
      armTimeout();
    }

    // پاک کردن timeout timer وقتی loading تمام می‌شود.
    if (!isLoading && timeoutHandle !== null) {
      clearTimeoutHandle();
    }

    // FIX (v1.2.7): Reset timedOut to false when all children finish
    // loading. Previously once timedOut was true, it would persist even
    // after loading completed, leaving the boundary stuck on the timeout
    // fallback forever. (Recovery path.)
    const effectiveTimedOut = !isLoading ? false : current.timedOut;
    // A boundary is settled when nothing is loading AND there's no error.
    const settled = !isLoading && !current.error && !effectiveTimedOut;

    if (
      current.loading !== isLoading ||
      current.pendingCount !== pendingCount ||
      current.timedOut !== effectiveTimedOut
    ) {
      sig.set({
        loading: isLoading,
        pendingCount,
        timedOut: effectiveTimedOut,
        error: current.error,
      });
    }

    // BUG-SUS-01 FIX: Notify parent synchronously when settled↔loading
    // transitions, so the outer boundary does not wait for the effect
    // microtask boundary (which could cause a race condition where the
    // parent shows content while the inner boundary is still loading).
    if (settled !== _prevSettled) {
      _prevSettled = settled;
      if (onSettle) onSettle(settled);
    }
  }

  return {
    signal: sig,
    startLoading(id: string) {
      const wasEmpty = loadingSet.size === 0;
      loadingSet.add(id);
      // FIX (v1.2.7 + #22): Re-arm timeout and clear stale error when a new
      // loading cycle starts.
      const current = sig.get();
      if (current.timedOut || (wasEmpty && current.error !== null)) {
        sig.set({ ...current, timedOut: false, error: null, loading: true });
        clearTimeoutHandle();
        armTimeout();
      }
      updateState();
    },
    stopLoading(id: string) {
      loadingSet.delete(id);
      updateState();
    },
    reportError(err: string) {
      clearTimeoutHandle();
      // FIX (#22): حفظ وضعیت loading و pendingCount واقعی اگر پرامیس‌های هم‌پوشان
      // دیگری هنوز در loadingSet در حال بارگذاری هستند.
      const pendingCount = loadingSet.size;
      sig.set({
        loading: pendingCount > 0,
        pendingCount,
        timedOut: false,
        error: err,
      });
    },
    reportTimeout() {
      clearTimeoutHandle();
      sig.set({
        loading: false,
        pendingCount: loadingSet.size,
        timedOut: true,
        error: null,
      });
    },
    // FIX (v1.2.7): public reset() method to manually recover from a
    // timeout or error state.
    reset() {
      clearTimeoutHandle();
      loadingSet.clear();
      sig.set({
        loading: false,
        pendingCount: 0,
        timedOut: false,
        error: null,
      });
    },
  };
}
