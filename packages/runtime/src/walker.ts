import { createContext } from './context';
import { createTreeWalker } from './walk-tree';
import { reportError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { ZenithRootElement } from './host-types';
export { registerCustomDirective, unregisterCustomDirective, clearCustomDirectives, clearCustomDirectivesInternal, getCustomDirective, hasCustomDirective, listCustomDirectives, type CustomDirectiveHandler, type CustomDirectiveOptions } from './custom-directives';
export { clearLazyDirectivesInternal } from './directives/lazy';
const walk = createTreeWalker();

/** Bind a subtree with caller-owned dynamic state and local cleanup. @public */
export function processDOM(root: HTMLElement, state: Record<string, unknown>): () => void {
  const context = createContext(state);
  const disposes: (() => void)[] = [];
  walk(root, context, state, disposes);

  // ذخیره‌ی disposes روی root برای استفاده‌های بعدی
  // (مثلاً HMR در DevTools یا teardown کامل اپ)
  (root as ZenithRootElement).__zenithDisposes = disposes;

  // #116 cleanup protocol: یک Cleanup idempotent برگردانده می‌شود تا
  // فراخوان بدون وابستگی به __zenithDisposes بتواند teardown کند.
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    for (const dispose of disposes) {
      try {
        dispose();
      } catch (err) {
        // #116/DEC-031: خطای یک dispose نباید مانع بقیه شود؛ از hub لاگ می‌گیریم
        // (نه logger.error مستقیم).
        reportError(err, 'processDOM', { phase: 'dispose' });
      }
    }
    disposes.length = 0;
  };
}

/** Bind a subtree with caller-owned dynamic state and local cleanup. @public */
export function walkAndBind(root: HTMLElement, state: Record<string, unknown>): () => void {
  const context = createContext(state);
  const disposes: (() => void)[] = [];
  walk(root, context, state, disposes);

  // FEATURE (v0.4.0): بازگرداندن یک تابع teardown واحد که همه‌ی disposes را
  // فراخوانی می‌کند. این تابع توسط zen-for compiler-generated کد در زمان
  // removal یک آیتم فراخوانی می‌شود تا Effectهای فرزندان clone پاکسازی شوند.
  return () => {
    for (const dispose of disposes) {
      try {
        dispose();
      } catch (err) {
        // FEATURE (v0.4.0): خطای یک dispose نباید مانع dispose بقیه شود.
        logger.error(
          `[Zenith walkAndBind] dispose failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    disposes.length = 0;
  };
}
