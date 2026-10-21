/**
 * @zenith/notifications - Standard notification system
 */

export * from './notifications';
/** @public */
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

/** Test/host reset hook; canonical use is onGlobalReset/resetForTesting. @internal */
export { resetNotificationsInternal } from './notifications';
/** @public */
export { createDialogFocusTrap } from './focus-trap';
/** @public */
export type { DialogFocusTrap, DialogFocusTrapOptions } from './focus-trap';
/** @public */
export type {
  Notification,
  NotificationType,
  NotificationPosition,
  NotifyOptions,
  AlertOptions,
  ConfirmOptions,
  DialogHandle,
} from './notifications';
