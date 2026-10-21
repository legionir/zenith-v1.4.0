/**
 * @zenith/notifications - Standard notification system for Zenith
 *
 * Features:
 *   - Toast notifications (success, error, warning, info)
 *   - Alert & confirm dialogs (`showAlert` / `showConfirm`)
 *   - Auto-dismiss with configurable duration, paused on hover/focus (#132)
 *   - Visible-queue with `maxVisible` and duplicate merging (#132)
 *   - Accessible markup: `role`, `aria-live`, `aria-atomic`, focus trap (#98/#132)
 *   - `prefers-reduced-motion` awareness (#132)
 *   - Programmatic API + HTML directive
 */

export * from './notification-types';
/** @public */
export { setNotificationDefaults, getNotificationDefaults } from './notification-state';
export * from './notification-toasts';
export * from './notification-render';
export * from './notification-dialog';

import { onGlobalReset } from '@zenith/errors';
import { DEFAULTS } from './notification-types';
import {
  activeAlerts,
  activeConfirms,
  openDialogs,
  replaceDefaultOptions,
  resetToastId,
  setCurrentMaxVisible,
} from './notification-state';
import { clearAllNotifications } from './notification-toasts';

// ============================================================
// Global reset (#118) — no cross-test leaks
// ============================================================

/** #118/#132: بازنشانی کامل وضعیت ماژول (بدون هشدار) — هوک ریست سراسری. */
/** @internal */
export function resetNotificationsInternal(): void {
  for (const dialog of Array.from(openDialogs)) {
    try {
      dialog.dispose();
    } catch {
      // پاک‌سازی نباید خطا بدهد
    }
  }
  openDialogs.clear();
  clearAllNotifications();
  activeAlerts.set([]);
  activeConfirms.set([]);
  replaceDefaultOptions({ ...DEFAULTS });
  setCurrentMaxVisible(DEFAULTS.maxVisible);
  resetToastId();
}
/* @__PURE__ */ onGlobalReset(resetNotificationsInternal);
