// packages/notifications/src/notification-toasts.ts
//
// تایمرها، toastها، alert/confirm و API نمایشی — استخراج مکانیکی از
// notifications.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { computed, type ReadonlySignal } from '@zenith/state';
import { deprecate } from '@zenith/errors';
import { prefersReducedMotion } from '@zenith/shared';
import {
  DEFAULTS,
  type AlertOptions,
  type ConfirmOptions,
  type Notification,
  type NotificationPosition,
  type NotifyOptions,
} from './notification-types';
import {
  activeAlerts,
  activeConfirms,
  defaultOptions,
  dismissTimers,
  generateId,
  notifications,
  queuedNotifications,
  setCurrentMaxVisible,
  setNotificationDefaults,
  currentMaxVisible,
  type TimerState,
} from './notification-state';

// ============================================================
// Toast Notifications
// ============================================================

function clearTimer(id: string): void {
  const state = dismissTimers.get(id);
  if (!state) return;
  if (state.handle !== null) clearTimeout(state.handle);
  dismissTimers.delete(id);
}

function startTimer(config: Notification, delay: number): void {
  clearTimer(config.id);
  const state: TimerState = {
    handle: setTimeout(() => {
      dismissTimers.delete(config.id);
      dismissNotification(config.id);
    }, delay),
    remaining: delay,
    startedAt: Date.now(),
    paused: false,
  };
  dismissTimers.set(config.id, state);
}

function scheduleAutoDismiss(config: Notification): void {
  if (config.persistent || config.duration <= 0) return;
  startTimer(config, config.duration);
}

/**
 * #132: توقف موقت تایمر بستن خودکار (hover/focus روی toast).
 * زمان باقی‌مانده ذخیره می‌شود تا در `resumeAutoDismiss` ادامه یابد.
 *
 * @returns `true` اگر اعلانِ قابل‌توقف وجود داشت.
 */
/** @public */
export function pauseAutoDismiss(id: string): boolean {
  const state = dismissTimers.get(id);
  if (!state || state.paused) return false;
  if (state.handle !== null) clearTimeout(state.handle);
  const elapsed = Date.now() - state.startedAt;
  dismissTimers.set(id, {
    handle: null,
    remaining: Math.max(0, state.remaining - elapsed),
    startedAt: Date.now(),
    paused: true,
  });
  return true;
}

/**
 * #132: ادامهٔ تایمر پس از پایان hover/focus.
 *
 * @returns `true` اگر تایمر ادامه یافت.
 */
/** @public */
export function resumeAutoDismiss(id: string): boolean {
  const state = dismissTimers.get(id);
  if (!state || !state.paused) return false;
  if (state.remaining <= 0) {
    dismissTimers.delete(id);
    dismissNotification(id);
    return true;
  }
  const config = notifications.get().find((n) => n.id === id);
  if (!config) {
    dismissTimers.delete(id);
    return false;
  }
  startTimer(config, state.remaining);
  return true;
}

/** #132: تایمر معلق است؟ (برای UI/تست) */
/** @public */
export function isAutoDismissPaused(id: string): boolean {
  return dismissTimers.get(id)?.paused === true;
}

/** #132: زمان باقی‌ماندهٔ تایمر بستن خودکار (میلی‌ثانیه؛ `null` اگر تایمری نیست). */
/** @public */
export function autoDismissRemaining(id: string): number | null {
  const state = dismissTimers.get(id);
  if (!state) return null;
  if (state.paused) return state.remaining;
  return Math.max(0, state.remaining - (Date.now() - state.startedAt));
}

/**
 * Show a toast notification
 */
/** @public */
export function notify(message: string, options: NotifyOptions = {}): string {
  const resolvedType = options.type || defaultOptions.type || 'info';
  const deduplicate = options.deduplicate ?? defaultOptions.deduplicate ?? false;
  const reduced = prefersReducedMotion();

  if (deduplicate) {
    const merge = (list: Notification[]): Notification[] | null => {
      const existing = list.find((n) => n.message === message && n.type === resolvedType);
      if (!existing) return null;
      return list.map((n) => (n.id === existing.id ? { ...n, count: n.count + 1 } : n));
    };
    const visibleMerge = merge(notifications.get());
    if (visibleMerge) {
      notifications.set(visibleMerge);
      return visibleMerge.find((n) => n.message === message && n.type === resolvedType)!.id;
    }
    const queuedMerge = merge(queuedNotifications.get());
    if (queuedMerge) {
      queuedNotifications.set(queuedMerge);
      return queuedMerge.find((n) => n.message === message && n.type === resolvedType)!.id;
    }
  }

  const isUrgent = resolvedType === 'error' || resolvedType === 'warning';
  const config: Notification = {
    id: generateId(),
    message,
    type: resolvedType,
    title: options.title,
    duration: options.duration ?? defaultOptions.duration ?? DEFAULTS.duration,
    position: options.position || defaultOptions.position || DEFAULTS.position,
    persistent: options.persistent || false,
    dismissible: options.dismissible ?? defaultOptions.dismissible ?? DEFAULTS.dismissible,
    actions: options.actions,
    createdAt: Date.now(),
    role: isUrgent ? 'alert' : 'status',
    ariaLive: resolvedType === 'error' ? 'assertive' : 'polite',
    ariaAtomic: true,
    count: 1,
    reducedMotion: reduced,
  };

  const maxVisible = options.maxVisible ?? defaultOptions.maxVisible ?? DEFAULTS.maxVisible;
  setCurrentMaxVisible(maxVisible);
  const currentVisible = notifications.get();
  if (maxVisible > 0 && currentVisible.length >= maxVisible) {
    queuedNotifications.set([...queuedNotifications.get(), config]);
    return config.id;
  }

  notifications.set([...currentVisible, config]);
  scheduleAutoDismiss(config);

  return config.id;
}

/**
 * Dismiss a notification by ID
 */
/** @public */
export function dismissNotification(id: string): void {
  clearTimer(id);
  const nextVisible = notifications.get().filter((n) => n.id !== id);
  const queue = queuedNotifications.get().filter((n) => n.id !== id);
  const maxVisible = currentMaxVisible;
  while ((maxVisible <= 0 || nextVisible.length < maxVisible) && queue.length > 0) {
    const nextItem = queue.shift()!;
    nextVisible.push(nextItem);
    scheduleAutoDismiss(nextItem);
  }
  queuedNotifications.set(queue);
  notifications.set(nextVisible);
}

/**
 * Clear all notifications
 */
/** @public */
export function clearAllNotifications(): void {
  for (const id of Array.from(dismissTimers.keys())) clearTimer(id);
  queuedNotifications.set([]);
  notifications.set([]);
}

/**
 * #132: دریافت اعلان‌های منتظر در صف.
 */
/** @public */
export function getQueuedNotifications(): Notification[] {
  return queuedNotifications.get();
}

/** #132: اعلان‌های در حال نمایش. */
/** @public */
export function getVisibleNotifications(): Notification[] {
  return notifications.get();
}

// Convenience methods for each type
/** @public */
export const toasts = {
  success: (message: string, options?: Omit<NotifyOptions, 'type'>) =>
    notify(message, { ...options, type: 'success' }),

  error: (message: string, options?: Omit<NotifyOptions, 'type'>) =>
    notify(message, { ...options, type: 'error' }),

  warning: (message: string, options?: Omit<NotifyOptions, 'type'>) =>
    notify(message, { ...options, type: 'warning' }),

  info: (message: string, options?: Omit<NotifyOptions, 'type'>) =>
    notify(message, { ...options, type: 'info' }),
};

// ============================================================
// Alert Dialogs
// ============================================================

/**
 * #132: نمایش دیالوگ هشدار — نام canonical.
 * Promises resolves when the user acknowledges it.
 */
/** @public */
export function showAlert(options: AlertOptions | string): Promise<void> {
  const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;

  return new Promise<void>((resolve) => {
    const id = generateId();
    activeAlerts.set([
      ...activeAlerts.get(),
      {
        id,
        options: {
          closeText: 'بستن',
          type: 'info',
          ...opts,
        },
        resolve: () => {
          activeAlerts.set(activeAlerts.get().filter((a) => a.id !== id));
          resolve();
        },
      },
    ]);
  });
}

/**
 * @deprecated #132 — نام `alert` با `window.alert` مرورگر اشتباه گرفته می‌شد؛
 * از `showAlert` استفاده کنید (ZEN-DEPR-052؛ حذف در ۲.۰).
 */
/** @public */
export function alert(options: AlertOptions | string): Promise<void> {
  deprecate('ZEN-DEPR-052', 'alert (@zenith/notifications)', 'showAlert');
  return showAlert(options);
}

// ============================================================
// Confirm Dialogs
// ============================================================

/**
 * #132: نمایش دیالوگ تأیید — نام canonical.
 * Resolves to `true`/`false` based on the user's choice.
 */
/** @public */
export function showConfirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;

  return new Promise<boolean>((resolve) => {
    const id = generateId();
    activeConfirms.set([
      ...activeConfirms.get(),
      {
        id,
        options: {
          confirmText: 'تایید',
          cancelText: 'انصراف',
          type: 'warning',
          ...opts,
        },
        resolve: (value: boolean) => {
          activeConfirms.set(activeConfirms.get().filter((c) => c.id !== id));
          resolve(value);
        },
      },
    ]);
  });
}

/**
 * @deprecated #132 — نام `confirm` با `window.confirm` مرورگر اشتباه گرفته
 * می‌شد؛ از `showConfirm` استفاده کنید (ZEN-DEPR-053؛ حذف در ۲.۰).
 */
/** @public */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  deprecate('ZEN-DEPR-053', 'confirm (@zenith/notifications)', 'showConfirm');
  return showConfirm(options);
}

// ============================================================
// Public State Access (for rendering in UI)
// ============================================================

/**
 * Get all active notifications grouped by position
 */
/** @public */
export function getNotificationsByPosition(): ReadonlySignal<
  Record<NotificationPosition, Notification[]>
> {
  return computed(() => {
    const grouped: Record<string, Notification[]> = {
      'top-right': [],
      'top-left': [],
      'top-center': [],
      'bottom-right': [],
      'bottom-left': [],
      'bottom-center': [],
    };

    for (const notif of notifications.get()) {
      grouped[notif.position]?.push(notif);
    }

    return grouped as Record<NotificationPosition, Notification[]>;
  });
}

/**
 * Public API for integration with Zen runtime
 */
/** @public */
export const notificationsAPI = {
  notify,
  dismiss: dismissNotification,
  clearAll: clearAllNotifications,
  toasts,
  showAlert,
  showConfirm,
  /** سازگاری: `alert`/`confirm` قدیمی (هشدار ZEN-DEPR-052/053). */
  alert,
  confirm,
  getNotifications: () => notifications.get(),
  getQueued: () => queuedNotifications.get(),
  getAlerts: () => activeAlerts.get(),
  getConfirms: () => activeConfirms.get(),
  setDefaults: setNotificationDefaults,
};

// ============================================================
// Directive Handler (for zen-notify)
// ============================================================

/**
 * Handler for zen-notify directive
 * Usage: <button zen-notify:success="عملیات موفق بود">ذخیره</button>
 */
/** @public */
export function handleNotifyDirective(
  element: HTMLElement,
  type: NotificationType,
  message: string,
  options?: NotifyOptions,
): void {
  element.addEventListener('click', () => {
    notify(message, { ...options, type });
  });
}
