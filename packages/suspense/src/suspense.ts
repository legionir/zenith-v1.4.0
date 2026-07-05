// packages/suspense/src/suspense.ts
//
// @zenith/suspense — Suspense-like Loading State (v1.0.0 — complete rewrite).
//
// مشابه React Suspense اما HTML-First.
//
// ── سینتکس ──
//
//   <zen-suspense timeout="5000">
//     <!-- محتوای اصلی که ممکن است async باشد -->
//     <div zen-fetch="'/api/data'" zen-state="data">
//       <span zen-text="$data.data.name"></span>
//     </div>
//
//     <!-- Fallback در حال loading -->
//     <template zen-fallback>
//       <div class="spinner">Loading...</div>
//     </template>
//
//     <!-- Fallback در صورت timeout -->
//     <template zen-timeout>
//       <div class="error">Timeout! Please retry.</div>
//     </template>
//
//     <!-- Fallback در صورت خطا -->
//     <template zen-error>
//       <div class="error">Something went wrong.</div>
//     </template>
//   </zen-suspense>
//
// ── نحوه کار ──
//
// 1. Suspense یک SuspenseContext می‌سازد که شامل یک Signal<SuspenseState> است.
// 2. این context به‌صورت $suspense در child context قرار می‌گیرد.
// 3. zen-fetch و zen-resource می‌توانند با $suspense گزارش دهند که loading هستند.
// 4. وقتی تمام فرزندان loading=false شدند، محتوای اصلی نمایش داده می‌شود.
// 5. اگر timeout رخ دهد، fallback timeout نمایش داده می‌شود.
// 6. اگر error رخ دهد، fallback error نمایش داده می‌شود.
// 7. Error boundary integration: خطاهای فرزندان به error-boundary گزارش می‌شوند.

import { signal, effect, type Signal } from '@zenith/state';
import { reportError } from '@zenith/error-boundary';

/**
 * وضعیت Suspense.
 */
export interface SuspenseState {
  /** آیا در حال loading است؟ */
  loading: boolean;
  /** تعداد فرزندان در حال loading. */
  pendingCount: number;
  /** آیا timeout رخ داده؟ */
  timedOut: boolean;
  /** آیا خطا رخ داده؟ */
  error: string | null;
}

/**
 * SuspenseContext — برای ارتباط بین zen-suspense و zen-fetch/zen-resource.
 *
 * zen-fetch و zen-resource می‌توانند با `context.$suspense` به Suspense گزارش دهند.
 */
export interface SuspenseContext {
  /** Signal وضعیت. */
  signal: Signal<SuspenseState>;
  /** ثبت شروع loading یک فرزند. */
  startLoading(id: string): void;
  /** ثبت پایان loading یک فرزند. */
  stopLoading(id: string): void;
  /** ثبت خطا. */
  reportError(err: string): void;
  /** ثبت timeout. */
  reportTimeout(): void;
  /**
   * FIX (v1.2.7): Manually reset the boundary — clears loading, timeout,
   * and error. Useful when the user clicks a "Retry" button inside the
   * timeout/error fallback.
   */
  reset(): void;
}

/**
 * ساخت یک SuspenseContext جدید.
 *
 * @param timeoutMs  مهلت بارگذاری (0 = بدون مهلت).
 * @param onSettle   BUG-SUS-01 FIX: Callback هم‌زمان که وقتی وضعیت loading
 *                   از settled→loading یا loading→settled تغییر می‌کند،
 *                   فراخوانی می‌شود. برای nested suspense استفاده می‌شود
 *                   تا parent context به‌صورت هم‌زمان (بدون gap میکروتسک)
 *                   از وضعیت فرزند مطلع شود.
 */
export function createSuspenseContext(timeoutMs: number = 0, onSettle?: (settled: boolean) => void): SuspenseContext {
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
  let _prevSettled = true;  // حالت اولیه settled است (loading=0).

  function updateState() {
    const pendingCount = loadingSet.size;
    const isLoading = pendingCount > 0;
    const current = sig.get();

    // شروع timeout timer وقتی loading شروع می‌شود.
    if (isLoading && !current.timedOut && !current.error && timeoutMs > 0 && timeoutHandle === null) {
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
      loadingSet.add(id);
      // FIX (v1.2.7): Re-arm timeout when new loading starts after a
      // timeout. Previously the `!current.timedOut` guard in updateState
      // prevented re-arming, so once timed out, the boundary was stuck.
      const current = sig.get();
      if (current.timedOut) {
        sig.set({ ...current, timedOut: false, loading: true });
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
      sig.set({
        loading: false,
        pendingCount: 0,
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

/**
 * پردازش دایرکتیو zen-suspense.
 *
 * @param el              عنصر <zen-suspense>.
 * @param processChildren callback برای walk فرزندان.
 * @param context         Context والد.
 * @param disposes        آرایه‌ی dispose functions.
 */
export function processSuspense(
  el: HTMLElement,
  processChildren: (node: HTMLElement, ctx: Record<string, any>, disposes: (() => void)[]) => void,
  context: Record<string, any>,
  disposes: (() => void)[],
): void {
  // SSR-safe guard.
  if (typeof document === 'undefined') return;

  // ── ۱. خواندن timeout از attribute ──
  const timeoutAttr = el.getAttribute('timeout');
  const timeoutMs = timeoutAttr ? parseInt(timeoutAttr, 10) || 0 : 0;

  // ── ۲. پیدا کردن fallback templates ──
  const fallbackTemplate = el.querySelector(':scope > template[zen-fallback]') as HTMLTemplateElement | null;
  const timeoutTemplate = el.querySelector(':scope > template[zen-timeout]') as HTMLTemplateElement | null;
  const errorTemplate = el.querySelector(':scope > template[zen-error]') as HTMLTemplateElement | null;

  // ── ۳. ساخت fallback elements ──
  let fallbackEl: HTMLElement | null = null;
  let timeoutEl: HTMLElement | null = null;
  let errorEl: HTMLElement | null = null;

  if (fallbackTemplate) {
    fallbackEl = document.createElement('div');
    fallbackEl.className = 'zen-suspense-fallback';
    fallbackEl.style.display = 'none';
    fallbackEl.innerHTML = fallbackTemplate.innerHTML;
    el.appendChild(fallbackEl);
    fallbackTemplate.remove();
  }

  if (timeoutTemplate) {
    timeoutEl = document.createElement('div');
    timeoutEl.className = 'zen-suspense-timeout';
    timeoutEl.style.display = 'none';
    timeoutEl.innerHTML = timeoutTemplate.innerHTML;
    el.appendChild(timeoutEl);
    timeoutTemplate.remove();
  }

  if (errorTemplate) {
    errorEl = document.createElement('div');
    errorEl.className = 'zen-suspense-error';
    errorEl.style.display = 'none';
    errorEl.innerHTML = errorTemplate.innerHTML;
    el.appendChild(errorEl);
    errorTemplate.remove();
  }

  // ── ۴. ساخت content wrapper ──
  const contentEl = document.createElement('div');
  contentEl.className = 'zen-suspense-content';

  // انتقال همه‌ی فرزندان (غیر fallback) به content wrapper.
  const childrenToMove: HTMLElement[] = [];
  for (const child of Array.from(el.children)) {
    if (child !== fallbackEl && child !== timeoutEl && child !== errorEl) {
      childrenToMove.push(child as HTMLElement);
    }
  }
  for (const child of childrenToMove) {
    contentEl.appendChild(child);
  }
  el.appendChild(contentEl);

  // ── ۵. ساخت SuspenseContext ──
  // BUG-SUS-01 FIX: به‌جای effect برای tracking nested state، از onSettle
  // callback هم‌زمان استفاده می‌کنیم که parent را بدون gap میکروتسک مطلع کند.
  let innerSettled = true;   // حالت اولیه settled
  const suspenseCtx = createSuspenseContext(timeoutMs, (settled) => {
    if (settled !== innerSettled) {
      innerSettled = settled;
      if (settled && outerCtx && innerId) {
        outerCtx.stopLoading(innerId);
      } else if (!settled && outerCtx && innerId) {
        outerCtx.startLoading(innerId);
      }
    }
  });

  // افزودن $suspense به child context.
  const childContext: Record<string, any> = Object.create(context);
  Object.defineProperty(childContext, '$suspense', {
    get: () => suspenseCtx.signal.get(),
    enumerable: true,
    configurable: true,
  });
  // FEATURE (v1.0.0): افزودن SuspenseContext برای zen-fetch/zen-resource.
  Object.defineProperty(childContext, '__zenith_suspense__', {
    value: suspenseCtx,
    enumerable: false,
    configurable: true,
    writable: false,
  });

  // FIX (v1.2.7): Nested zen-suspense propagation — register this inner
  // boundary with the outer SuspenseContext (if any) so the outer boundary
  // also knows it is waiting on the inner one. Without this, the outer
  // could finish loading (its direct children are processed) and dispose
  // the inner boundary before the inner's fetches complete.
  const outerCtx = (context as any).__zenith_suspense__ as SuspenseContext | undefined;
  let innerId: string | null = null;
  if (outerCtx) {
    innerId = `zen-suspense-${Math.random().toString(36).slice(2, 10)}`;
    outerCtx.startLoading(innerId);
  }

  // ── ۶. Process children ──
  // BUG-SUS-01 FIX: دیگر نیازی به innerWatchDispose نیست — onSettle
  // callback (در خط ۳۱۰) parent را هم‌زمان مطلع می‌کند.
  const childDisposes: (() => void)[] = [];
  for (const child of Array.from(contentEl.children)) {
    processChildren(child as HTMLElement, childContext, childDisposes);
  }

  // ── ۷. Effect: watch suspense state و toggle visibility ──
  const disposeEffect = effect(() => {
    const state = suspenseCtx.signal.get();

    // پنهان کردن همه‌ی fallback ها اول.
    if (fallbackEl) fallbackEl.style.display = 'none';
    if (timeoutEl) timeoutEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    if (state.error) {
      // ── حالت Error ──
      contentEl.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = '';
      } else if (fallbackEl) {
        fallbackEl.style.display = '';
        fallbackEl.textContent = `Error: ${state.error}`;
      }
    } else if (state.timedOut) {
      // ── حالت Timeout ──
      contentEl.style.display = 'none';
      if (timeoutEl) {
        timeoutEl.style.display = '';
      } else if (fallbackEl) {
        fallbackEl.style.display = '';
        fallbackEl.textContent = 'Timeout: operation took too long.';
      }
    } else if (state.loading) {
      // ── حالت Loading ──
      contentEl.style.display = 'none';
      if (fallbackEl) fallbackEl.style.display = '';
    } else {
      // ── حالت Success ──
      contentEl.style.display = '';
    }
  });

  // ── ۸. Dispose ──
  // BUG-SUS-01 FIX: innerWatchDispose حذف شده (onSettle جایگزین آن شده).
  disposes.push(() => {
    disposeEffect();
    // FIX (v1.2.7): notify the outer boundary that this inner is gone
    // so it does not keep waiting on a stale id.
    if (outerCtx && innerId) {
      outerCtx.stopLoading(innerId);
    }
    for (const d of childDisposes) {
      try { d(); } catch (e) {
        // FEATURE (v1.0.0): گزارش به error boundary.
        reportError(e as Error, 'directive', { element: el });
      }
    }
    childDisposes.length = 0;
  });
}
