import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';
import { logger } from '@zenith/logger';

// 1. تعریف State
const state = {
  count: signal(0),
};

// 2. ثبت Action ها
Zen.action('increment', ({ state }) => {
  state.count.set(state.count.get() + 1);
});

Zen.action('decrement', ({ state }) => {
  state.count.set(Math.max(0, state.count.get() - 1));
});

// 3. شروع فریم‌ورک
Zen.start(document.getElementById('app')!, state);

// BUG-CLI-01 FIX: اعتبارسنجی runtime برای Action‌های تعریف‌نشده
// اگر دکمه‌ای در HTML دارای zen-action باشد اما handler آن ثبت نشده باشد،
// یک warning در کنسول چاپ می‌شود.
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement | null;
  const actionName = target?.getAttribute?.('zen-action');
  if (actionName && typeof actionName === 'string') {
    if (!Zen.action.has(actionName)) {
      logger.warn(`[Zenith] Action "${actionName}" is not registered. ` +
        `Define it with: Zen.action('${actionName}', handler)`);
    }
  }
}, true);

logger.debug('🚀 App started. Try Zen DevTools: window.__ZENITH__');
