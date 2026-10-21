// packages/notifications/src/notification-types.ts
//
// تایپ‌ها و پیش‌فرض‌های @zenith/notifications — استخراج مکانیکی از
// notifications.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


// ============================================================
// Types & Interfaces
// ============================================================

/** @public */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';
/** @public */
export type NotificationPosition =
  'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

/** @public */
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
  /** #132: آیا دکمهٔ بستن داشته باشد (از `DEFAULTS.dismissible`). */
  dismissible: boolean;
  /** #132: تعداد ادغام‌های تکراری (۱ = بدون ادغام). */
  count: number;
  /** #132: کاربر prefers-reduced-motion را درخواست کرده است. */
  reducedMotion: boolean;
}

/** @public */
export interface NotifyOptions {
  type?: NotificationType;
  title?: string;
  duration?: number;
  position?: NotificationPosition;
  persistent?: boolean;
  dismissible?: boolean;
  actions?: Array<{ label: string; onClick: () => void }>;
  /** #132: حداکثر تعداد اعلان‌های هم‌زمان قابل‌نمایش (بقیه در صف قرار می‌گیرند) */
  maxVisible?: number;
  /** #132: ادغام اعلان‌های تکراری هم‌متن و هم‌نوع (به‌جای اعلان جدید، `count` بالا می‌رود) */
  deduplicate?: boolean;
}

/** @public */
export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: NotificationType;
  /** #132: فعال‌سازی focus trap داخل دیالوگ (پیش‌فرض: `true` در مسیر DOM). */
  focusTrap?: boolean;
}

/** @public */
export interface AlertOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  closeText?: string;
  /** #132: فعال‌سازی focus trap داخل دیالوگ (پیش‌فرض: `true` در مسیر DOM). */
  focusTrap?: boolean;
}

/**
 * #53/#132: پیش‌فرض‌های منجمد — **منبع یکتا** برای `defaultOptions` داخلی.
 *
 * @default { type: 'info', duration: 3000, position: 'top-left', dismissible: true, maxVisible: 5, deduplicate: false }
 * @unit ms (duration)
 * @since 1.4.0
 */
/** @public */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  type: 'info' as const,
  duration: 3_000,
  position: 'top-left' as const,
  dismissible: true,
  maxVisible: 5,
  deduplicate: false,
});