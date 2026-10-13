/**
 * @zenith/notifications - Standard notification system
 */

export * from './notifications';
export {
  notify,
  dismissNotification,
  clearAllNotifications,
  toasts,
  alert,
  alert as showAlert,
  confirm,
  confirm as showConfirm,
  setNotificationDefaults,
  getNotificationDefaults,
  getNotificationsByPosition,
  notificationsAPI,
  handleNotifyDirective,
  renderAccessibleToast,
  renderAccessibleDialog,
} from './notifications';
export type {
  Notification,
  NotificationType,
  NotificationPosition,
  NotifyOptions,
  AlertOptions,
  ConfirmOptions,
} from './notifications';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/notifications` (`NotifyOptions`).
 * @default { type: 'info', duration: 3000, position: 'top-left', dismissible: true }
 * @unit ms (duration)
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  type: 'info' as const,
  duration: 3_000,
  position: 'top-left' as const,
  dismissible: true,
});

