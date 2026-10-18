import { effect } from '@zenith/state';
import { secureId } from '@zenith/security';
import { reportError } from '@zenith/error-boundary';
import { createSuspenseContext } from './context';
import type { SuspenseContext } from './types';
/** Bind the established nested boundary protocol with caller-owned unknown context. @public */
export function processSuspense(
  el: HTMLElement,
  processChildren: (node: HTMLElement, ctx: Record<string, unknown>, disposes: (() => void)[]) => void,
  context: Record<string, unknown>,
  disposes: (() => void)[],
): () => void {
  // SSR-safe guard.
  if (typeof document === 'undefined') return () => {};

  // ── ۱. خواندن timeout از attribute ──
  const timeoutAttr = el.getAttribute('timeout');
  const timeoutMs = timeoutAttr ? parseInt(timeoutAttr, 10) || 0 : 0;

  // ── ۲. پیدا کردن fallback templates ──
  const fallbackTemplate = el.querySelector(
    ':scope > template[zen-fallback]',
  ) as HTMLTemplateElement | null;
  const timeoutTemplate = el.querySelector(
    ':scope > template[zen-timeout]',
  ) as HTMLTemplateElement | null;
  const errorTemplate = el.querySelector(
    ':scope > template[zen-error]',
  ) as HTMLTemplateElement | null;

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
  let innerSettled = true; // حالت اولیه settled
  const suspenseCtx = createSuspenseContext({ timeoutMs, onSettle: (settled) => {
    if (settled !== innerSettled) {
      innerSettled = settled;
      if (settled && outerCtx && innerId) {
        outerCtx.stopLoading(innerId);
      } else if (!settled && outerCtx && innerId) {
        outerCtx.startLoading(innerId);
      }
    }
  } });

  // افزودن $suspense به child context.
  const childContext: Record<string, unknown> = Object.create(context);
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
  const outerCtx = context.__zenith_suspense__ as SuspenseContext | undefined;
  let innerId: string | null = null;
  if (outerCtx) {
    // FIX (#64): شناسه‌ی منحصربه‌فرد با CSPRNG — Math.random قابل‌حدس و
    // مستعد برخورد بود.
    innerId = `zen-suspense-${secureId(4)}`;
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
  // #116 cleanup protocol: Cleanup idempotent برگردانده می‌شود و همزمان
  // به آرایهٔ disposes اضافه می‌شود (سازگاری با گذشته).
  const cleanup = (): void => {
    disposeEffect();
    // FIX (v1.2.7): notify the outer boundary that this inner is gone
    // so it does not keep waiting on a stale id.
    if (outerCtx && innerId) {
      outerCtx.stopLoading(innerId);
    }
    for (const d of childDisposes) {
      try {
        d();
      } catch (e) {
        // FEATURE (v1.0.0): گزارش به error boundary.
        reportError(e as Error, 'directive', { element: el });
      }
    }
    childDisposes.length = 0;
  };
  let cleaned = false;
  const idempotentCleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    cleanup();
  };
  disposes.push(idempotentCleanup);
  return idempotentCleanup;
}
