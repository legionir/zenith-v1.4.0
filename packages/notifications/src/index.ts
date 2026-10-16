/**
 * @zenith/notifications - Standard notification system
 */

export * from './notifications';
export {
  DEFAULTS,
  // #132: نام‌های canonical دیالوگ‌ها
  showAlert,
  showConfirm,
  openDialog,
  // #132: کنترل تایمر بستن خودکار
  pauseAutoDismiss,
  resumeAutoDismiss,
  isAutoDismissPaused,
  autoDismissRemaining,
  getVisibleNotifications,
  resetNotificationsInternal,
  // سازگاری: aliasهای deprecated (هشدار ZEN-DEPR-052/053)
  alert,
  confirm,
  notify,
  dismissNotification,
  clearAllNotifications,
  getQueuedNotifications,
  toasts,
  setNotificationDefaults,
  getNotificationDefaults,
  getNotificationsByPosition,
  notificationsAPI,
  handleNotifyDirective,
  renderAccessibleToast,
  renderAccessibleDialog,
} from './notifications';
export { createDialogFocusTrap } from './focus-trap';
export type { DialogFocusTrap, DialogFocusTrapOptions } from './focus-trap';
export type {
  Notification,
  NotificationType,
  NotificationPosition,
  NotifyOptions,
  AlertOptions,
  ConfirmOptions,
  DialogHandle,
} from './notifications';
