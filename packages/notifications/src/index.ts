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
  confirm,
  setNotificationDefaults,
  getNotificationDefaults,
  getNotificationsByPosition,
  notificationsAPI,
  handleNotifyDirective
} from './notifications';
export type {
  Notification,
  NotificationType,
  NotificationPosition,
  NotifyOptions,
  AlertOptions,
  ConfirmOptions
} from './notifications';
