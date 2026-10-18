import { signal, type Signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

/** @public */
export interface MockRouterController {
  currentPath: Signal<string>;
  history: string[];
  navigate: (to: string, options?: { replace?: boolean }) => void;
  reset: () => void;
  dispose: () => void;
}

/**
 * #137: مسیریاب آزمایشی در حافظه برای تست کامپوننت‌ها و گاردهای مسیر بدون وابستگی به تاریخچهٔ مرورگر.
 * @public
 */
export function mockRouter(initialPath = '/'): MockRouterController {
  const currentPath = signal(initialPath);
  const history: string[] = [initialPath];

  const navigate = (to: string, options?: { replace?: boolean }): void => {
    if (options?.replace && history.length > 0) {
      history[history.length - 1] = to;
    } else {
      history.push(to);
    }
    currentPath.set(to);
    flushSync();
  };

  const reset = (): void => {
    history.length = 0;
    history.push(initialPath);
    currentPath.set(initialPath);
    flushSync();
  };

  return {
    currentPath,
    history,
    navigate,
    reset,
    dispose: reset,
  };
}
