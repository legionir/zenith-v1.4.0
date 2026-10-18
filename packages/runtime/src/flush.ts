import { flushSync } from '@zenith/scheduler';
import { logger } from '@zenith/logger';
import { isDevMode } from './dev-mode';
/** Preserve the instance-local reentrancy latch. @internal */
export function createFlush(): () => void {
    let isFlushing = false;
    return () => {
      if (isFlushing) {
        if (isDevMode()) {
          logger.warn(
            '[Zen.flushSync] Reentrant call detected, skipping to prevent infinite loop.',
          );
        }
        return;
      }
      isFlushing = true;
      try {
        flushSync();
      } finally {
        isFlushing = false;
      }
    };
}
