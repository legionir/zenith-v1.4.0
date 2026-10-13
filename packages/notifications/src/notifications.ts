/**
 * @zenith/notifications - Standard notification system for Zenith
 *
 * Features:
 *   - Toast notifications (success, error, warning, info)
 *   - Alert & confirm dialogs
 *   - Auto-dismiss with configurable duration
 *   - Multiple positions on screen
 *   - Programmatic API + HTML directive
 */

import { signal, computed } from '@zenith/state';
import type { ReadonlySignal } from '@zenith/state';

// ============================================================
// Types & Interfaces
// ============================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationPosition =
  'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration: number;
  position: NotificationPosition;
  createdAt: number;
  /** If true, notification won't auto-dismiss */
  persistent?: boolean;
  /** Custom action buttons */
  actions?: Array<{ label: string; onClick: () => void }>;
  /** #98 (WCAG 2.2 AA 4.1.3): نقش ARIA برای صفحه‌خوان‌ها */
  role: 'alert' | 'status';
  /** #98 (WCAG 2.2 AA 4.1.3): سطح aria-live */
  ariaLive: 'assertive' | 'polite';
  /** #98: خوانش یکپارچهٔ پیام */
  ariaAtomic: boolean;
}

export interface NotifyOptions {
  type?: NotificationType;
  title?: string;
  duration?: number;
  position?: NotificationPosition;
  persistent?: boolean;
  actions?: Array<{ label: string; onClick: () => void }>;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: NotificationType;
}

export interface AlertOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  closeText?: string;
}

// ============================================================
// Internal State
// ============================================================

const notifications = signal<Notification[]>([]);
const activeAlerts = signal<Array<{ id: string; options: AlertOptions; resolve: () => void }>>([]);
const activeConfirms = signal<
  Array<{ id: string; options: ConfirmOptions; resolve: (value: boolean) => void }>
>([]);

let nextId = 1;
const generateId = () => `notif_${nextId++}_${Date.now().toString(36)}`;

// Default configuration
let defaultOptions: NotifyOptions = {
  type: 'info',
  duration: 4000,
  position: 'top-right',
};

// ============================================================
// Configuration
// ============================================================

/**
 * Set default options for all notifications
 */
export function setNotificationDefaults(options: Partial<NotifyOptions>): void {
  defaultOptions = { ...defaultOptions, ...options };
}

/**
 * Get current default notification options
 */
export function getNotificationDefaults(): NotifyOptions {
  return { ...defaultOptions };
}

// ============================================================
// Toast Notifications
// ============================================================

/**
 * Show a toast notification
 */
export function notify(message: string, options: NotifyOptions = {}): string {
  const resolvedType = options.type || defaultOptions.type || 'info';
  const isUrgent = resolvedType === 'error' || resolvedType === 'warning';
  const config: Notification = {
    id: generateId(),
    message,
    type: resolvedType,
    title: options.title,
    duration: options.duration ?? defaultOptions.duration ?? 4000,
    position: options.position || defaultOptions.position || 'top-right',
    persistent: options.persistent || false,
    actions: options.actions,
    createdAt: Date.now(),
    role: isUrgent ? 'alert' : 'status',
    ariaLive: resolvedType === 'error' ? 'assertive' : 'polite',
    ariaAtomic: true,
  };

  notifications.set([...notifications.get(), config]);

  // Auto-dismiss
  if (!config.persistent && config.duration > 0) {
    setTimeout(() => {
      dismissNotification(config.id);
    }, config.duration);
  }

  return config.id;
}

/**
 * Dismiss a notification by ID
 */
export function dismissNotification(id: string): void {
  notifications.set(notifications.get().filter((n) => n.id !== id));
}

/**
 * Clear all notifications
 */
export function clearAllNotifications(): void {
  notifications.set([]);
}

// Convenience methods for each type
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
 * Show an alert dialog that the user must acknowledge
 * Returns a promise that resolves when user closes it
 */
export function alert(options: AlertOptions | string): Promise<void> {
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

// ============================================================
// Confirm Dialogs
// ============================================================

/**
 * Show a confirm dialog with Yes/No options
 * Returns a promise that resolves to true/false based on user choice
 */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
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

// ============================================================
// Public State Access (for rendering in UI)
// ============================================================

/**
 * Get all active notifications grouped by position
 */
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
export const notificationsAPI = {
  notify,
  dismiss: dismissNotification,
  clearAll: clearAllNotifications,
  toasts,
  alert,
  confirm,
  getNotifications: () => notifications.get(),
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

/**
 * #98 (WCAG 2.2 AA 4.1.3): ساخت عنصر DOM دسترس‌پذیر برای Toast با `role`، `aria-live` و `aria-atomic`.
 */
export function renderAccessibleToast(
  notification: Notification,
  doc: Document = document,
): HTMLElement {
  const el = doc.createElement('div');
  el.id = notification.id;
  el.className = `zen-toast zen-toast-${notification.type}`;
  el.setAttribute('role', notification.role);
  el.setAttribute('aria-live', notification.ariaLive);
  el.setAttribute('aria-atomic', String(notification.ariaAtomic));
  if (notification.title) {
    const titleEl = doc.createElement('strong');
    titleEl.className = 'zen-toast-title';
    titleEl.textContent = notification.title;
    el.appendChild(titleEl);
  }
  const msgEl = doc.createElement('span');
  msgEl.className = 'zen-toast-message';
  msgEl.textContent = notification.message;
  el.appendChild(msgEl);
  return el;
}

/**
 * #98 (WCAG 2.2 AA): ساخت عنصر DOM دسترس‌پذیر برای دیالوگ Alert/Confirm با `role="alertdialog"`,
 * `aria-modal="true"`, `aria-labelledby` و `aria-describedby`.
 */
export function renderAccessibleDialog(
  options: AlertOptions | ConfirmOptions,
  idPrefix = 'zen_dialog',
  doc: Document = document,
): HTMLElement {
  const dialog = doc.createElement('div');
  const titleId = `${idPrefix}_title`;
  const descId = `${idPrefix}_desc`;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-describedby', descId);

  if (options.title) {
    dialog.setAttribute('aria-labelledby', titleId);
    const h2 = doc.createElement('h2');
    h2.id = titleId;
    h2.textContent = options.title;
    dialog.appendChild(h2);
  } else {
    dialog.setAttribute('aria-label', options.message);
  }

  const p = doc.createElement('p');
  p.id = descId;
  p.textContent = options.message;
  dialog.appendChild(p);
  return dialog;
}
