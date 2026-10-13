// packages/error-boundary/src/directive.ts
//
// دایرکتیو zen-error — Error Boundary محلی.
//
// سینتکس:
//   <div zen-error>
//     <!-- محتوای اصلی که ممکن است خطا دهد -->
//     <span zen-text="$user.name"></span>
//     <template zen-fallback>
//       <p style="color: red;">خطا در نمایش محتوا</p>
//     </template>
//   </div>
//
// اگر Expression داخل این boundary خطا دهد:
//   1) خطا به global handler گزارش می‌شود.
//   2) fallback UI (محتوای داخل <template zen-fallback>) نمایش داده می‌دهد.
//   3) محتوای اصلی پنهان می‌شود.
//
// نکته: این دایرکتیو به‌صورت local boundary عمل می‌کند. برای global error
// handling، از onError() و errorSignal استفاده کنید.

import { clearError, onError } from './boundary';

/**
 * #134: گزینه‌های Error Boundary محلی شامل تلاش مجدد خودکار با backoff و fallback قابل‌پیکربندی.
 */
export interface ErrorBoundaryRetryOptions {
  attempts?: number;
  delay?: number;
  factor?: number;
}

export interface ErrorBoundaryOptions {
  retry?: ErrorBoundaryRetryOptions;
  fallback?: string | ((error: unknown) => string);
}

/**
 * پردازش دایرکتیو zen-error.
 *
 * @param el              عنصری که zen-error روی آن است.
 * @param processChildren callback برای walk فرزندان.
 * @param disposes        آرایه‌ی dispose functions (سازگاری با گذشته — #116).
 * @param options         گزینه‌های اختیاری تلاش مجدد و fallback (#134).
 * @returns Cleanup تابعی idempotent که unsubscribe و dispose فرزندان را انجام
 *           می‌دهد (#116: همهٔ `process*` باید `Cleanup` برگردانند).
 */
export function processErrorBoundary(
  el: HTMLElement,
  processChildren: (node: HTMLElement, disposes: (() => void)[]) => void,
  disposes: (() => void)[],
  options: ErrorBoundaryOptions = {},
): () => void {
  // ── ۱. پیدا کردن fallback template یا attribute ──
  const fallbackTemplate = el.querySelector(
    ':scope > template[zen-fallback]',
  ) as HTMLTemplateElement | null;

  let fallbackContent =
    typeof options.fallback === 'string'
      ? options.fallback
      : el.getAttribute('zen-error-fallback') ||
        '<div style="color: red; padding: 8px;">⚠️ خطایی رخ داد</div>';
  if (fallbackTemplate) {
    fallbackContent = fallbackTemplate.innerHTML;
    fallbackTemplate.remove();
  }
  (el as any).__zenithFallback__ = fallbackContent;
  (el as any).__zenithFallbackFn__ =
    typeof options.fallback === 'function' ? options.fallback : null;

  const retryAttr = el.getAttribute('zen-error-retry');
  let retryConfig: Required<ErrorBoundaryRetryOptions> = {
    attempts: options.retry?.attempts ?? 0,
    delay: options.retry?.delay ?? 200,
    factor: options.retry?.factor ?? 2,
  };
  if (retryAttr) {
    const parsedNum = Number(retryAttr);
    if (!Number.isNaN(parsedNum) && parsedNum > 0) {
      retryConfig.attempts = parsedNum;
    } else {
      try {
        const parsedObj = JSON.parse(retryAttr);
        retryConfig = {
          attempts: parsedObj.attempts ?? retryConfig.attempts,
          delay: parsedObj.delay ?? retryConfig.delay,
          factor: parsedObj.factor ?? retryConfig.factor,
        };
      } catch {
        // ignore invalid retry attribute
      }
    }
  }

  (el as any).__zenithOriginalHTML__ = el.innerHTML;
  (el as any).__zenithProcessChildren__ = processChildren;
  (el as any).__zenithRetryCount__ = 0;

  const childDisposes: (() => void)[] = [];
  const retryTimers = new Set<ReturnType<typeof setTimeout>>();

  const mountChildren = () => {
    for (const child of Array.from(el.children)) {
      processChildren(child as HTMLElement, childDisposes);
    }
  };
  mountChildren();

  const unsubscribe = onError((zenithError) => {
    const errEl = zenithError.element as HTMLElement | undefined;
    if (errEl && el.contains(errEl)) {
      for (const d of childDisposes) {
        try {
          d();
        } catch (err) {
          console.error('[Zenith Error Boundary] Error during dispose:', err);
        }
      }
      childDisposes.length = 0;

      const currentAttempt = ((el as any).__zenithRetryCount__ ?? 0) as number;
      if (currentAttempt < retryConfig.attempts) {
        (el as any).__zenithRetryCount__ = currentAttempt + 1;
        const waitMs = retryConfig.delay * Math.pow(retryConfig.factor, currentAttempt);
        const timer = setTimeout(() => {
          retryTimers.delete(timer);
          recoverFromError(el);
        }, waitMs);
        retryTimers.add(timer);
        return;
      }

      const customFn = (el as any).__zenithFallbackFn__ as ((e: unknown) => string) | null;
      const renderedFallback = customFn ? customFn(zenithError) : fallbackContent;
      showFallback(el, renderedFallback);
    }
  });

  const cleanup = (): void => {
    unsubscribe();
    for (const t of retryTimers) clearTimeout(t);
    retryTimers.clear();
    for (const d of childDisposes) {
      try {
        d();
      } catch (err) {
        console.error('[Zenith Error Boundary] Error during dispose:', err);
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

/**
 * نمایش fallback UI در یک element.
 *
 * @param el       عنصر هدف.
 * @param fallback محتوای fallback (HTML).
 */
export function showFallback(el: HTMLElement, fallback: string): void {
  el.innerHTML = fallback;
}

/**
 * بازیابی محتوای اصلی (پنهان کردن fallback).
 */
export function recoverFromError(el: HTMLElement): void {
  clearError();
  const originalHTML = (el as any).__zenithOriginalHTML__;
  if (typeof originalHTML === 'string') {
    el.innerHTML = originalHTML;
  }
  const proc = (el as any).__zenithProcessChildren__ as
    | ((node: HTMLElement, disposes: (() => void)[]) => void)
    | undefined;
  if (typeof proc === 'function') {
    const tempDisposes: (() => void)[] = [];
    for (const child of Array.from(el.children)) {
      proc(child as HTMLElement, tempDisposes);
    }
  }
  if (typeof CustomEvent !== 'undefined') {
    el.dispatchEvent(new CustomEvent('zen-error-recover', { bubbles: true }));
  }
}

/**
 * #134: بازنشانی کامل وضعیت Error Boundary (شمارندهٔ تلاش مجدد و محتوای اصلی).
 */
export function resetErrorBoundary(el: HTMLElement): void {
  (el as any).__zenithRetryCount__ = 0;
  recoverFromError(el);
}
