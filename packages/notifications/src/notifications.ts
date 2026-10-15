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

import { signal, computed } from '@zenith/state';
import type { ReadonlySignal } from '@zenith/state';
import { deprecate, developerError, onGlobalReset } from '@zenith/errors';
import { prefersReducedMotion, type Cleanup } from '@zenith/shared';
import { createDialogFocusTrap, type DialogFocusTrap } from './focus-trap';

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
  /** #132: آیا دکمهٔ بستن داشته باشد (از `DEFAULTS.dismissible`). */
  dismissible: boolean;
  /** #132: تعداد ادغام‌های تکراری (۱ = بدون ادغام). */
  count: number;
  /** #132: کاربر prefers-reduced-motion را درخواست کرده است. */
  reducedMotion: boolean;
}

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

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: NotificationType;
  /** #132: فعال‌سازی focus trap داخل دیالوگ (پیش‌فرض: `true` در مسیر DOM). */
  focusTrap?: boolean;
}

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
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  type: 'info' as const,
  duration: 3_000,
  position: 'top-left' as const,
  dismissible: true,
  maxVisible: 5,
  deduplicate: false,
});

// ============================================================
// Internal State
// ============================================================

const notifications = signal<Notification[]>([]);
const queuedNotifications = signal<Notification[]>([]);
const activeAlerts = signal<Array<{ id: string; options: AlertOptions; resolve: () => void }>>([]);
const activeConfirms = signal<
  Array<{ id: string; options: ConfirmOptions; resolve: (value: boolean) => void }>
>([]);

let nextId = 1;
const generateId = () => `notif_${nextId++}_${Date.now().toString(36)}`;

// Default configuration — از DEFAULTS ساخته می‌شود تا دو منبع حقیقت نداشته باشیم.
let defaultOptions: NotifyOptions = { ...DEFAULTS };

/** وضعیت هر تایمر auto-dismiss (برای pause/resume — #132). */
interface TimerState {
  handle: ReturnType<typeof setTimeout> | null;
  /** میلی‌ثانیهٔ باقی‌ماندهٔ زمان‌بندی‌شده. */
  remaining: number;
  startedAt: number;
  /** #132: تایمر روی hover/focus متوقف شده است. */
  paused: boolean;
}
const dismissTimers = new Map<string, TimerState>();

/**
 * #132: سقف نمایش مؤثرِ آخرین `notify` — هنگام خالی‌شدن یک جایگاه، صف با همین
 * سقف تخلیه می‌شود (پیش‌تر `defaultOptions` خوانده می‌شد و `maxVisible` هر
 * فراخوانی نادیده می‌ماند).
 */
let currentMaxVisible: number = DEFAULTS.maxVisible;

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
export function isAutoDismissPaused(id: string): boolean {
  return dismissTimers.get(id)?.paused === true;
}

/** #132: زمان باقی‌ماندهٔ تایمر بستن خودکار (میلی‌ثانیه؛ `null` اگر تایمری نیست). */
export function autoDismissRemaining(id: string): number | null {
  const state = dismissTimers.get(id);
  if (!state) return null;
  if (state.paused) return state.remaining;
  return Math.max(0, state.remaining - (Date.now() - state.startedAt));
}

/**
 * Show a toast notification
 */
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
  currentMaxVisible = maxVisible;
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
export function clearAllNotifications(): void {
  for (const id of Array.from(dismissTimers.keys())) clearTimer(id);
  queuedNotifications.set([]);
  notifications.set([]);
}

/**
 * #132: دریافت اعلان‌های منتظر در صف.
 */
export function getQueuedNotifications(): Notification[] {
  return queuedNotifications.get();
}

/** #132: اعلان‌های در حال نمایش. */
export function getVisibleNotifications(): Notification[] {
  return notifications.get();
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
 * #132: نمایش دیالوگ هشدار — نام canonical.
 * Promises resolves when the user acknowledges it.
 */
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

// ============================================================
// Accessible DOM rendering (#98 / #132)
// ============================================================

/**
 * #98 (WCAG 2.2 AA 4.1.3): ساخت عنصر DOM دسترس‌پذیر برای Toast با `role`،
 * `aria-live` و `aria-atomic`.
 *
 * #132: تایمر بستن خودکار روی hover/focus متوقف و پس از آن ادامه می‌یابد؛
 * در `prefers-reduced-motion` نشانهٔ `data-zen-reduced-motion="true"` ست می‌شود
 * (هیچ transition/animation داخلی وجود ندارد؛ این نشانه به CSS مصرف‌کننده هم
 * اجازهٔ خاموش‌کردن حرکت را می‌دهد) و دکمهٔ بستن با برچسب دسترس‌پذیر ساخته
 * می‌شود. لسنرها با `disposeElement()` آزاد می‌شوند.
 *
 * @returns عنصر toast (با متد `dispose` روی خودِ عنصر برای جمع‌آوری لسنرها).
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
  el.setAttribute('data-zen-notification-id', notification.id);
  if (notification.reducedMotion) {
    el.setAttribute('data-zen-reduced-motion', 'true');
    el.style.transition = 'none';
    el.style.animation = 'none';
  }

  if (notification.title) {
    const titleEl = doc.createElement('strong');
    titleEl.className = 'zen-toast-title';
    titleEl.textContent = notification.title;
    el.appendChild(titleEl);
  }
  const msgEl = doc.createElement('span');
  msgEl.className = 'zen-toast-message';
  // #132: تعداد ادغام‌شده‌ها به متن اضافه می‌شود تا کاربر بداند چند بار رخ داده.
  msgEl.textContent =
    notification.count > 1
      ? `${notification.message} (×${notification.count})`
      : notification.message;
  el.appendChild(msgEl);

  const disposers: Cleanup[] = [];
  const pause = () => {
    pauseAutoDismiss(notification.id);
  };
  const resume = () => {
    resumeAutoDismiss(notification.id);
  };
  for (const [event, handler] of [
    ['mouseenter', pause],
    ['mouseleave', resume],
    ['focusin', pause],
    ['focusout', resume],
  ] as const) {
    el.addEventListener(event, handler);
    disposers.push(() => el.removeEventListener(event, handler));
  }

  if (notification.dismissible) {
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'zen-toast-close';
    closeBtn.setAttribute('aria-label', 'بستن اعلان');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      dismissNotification(notification.id);
    });
    el.appendChild(closeBtn);
  }

  for (const action of notification.actions ?? []) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'zen-toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
    });
    el.appendChild(btn);
  }

  (el as HTMLElement & { dispose?: Cleanup }).dispose = () => {
    for (const d of disposers) d();
    disposers.length = 0;
  };

  return el;
}

/**
 * #98 (WCAG 2.2 AA): ساخت عنصر DOM دسترس‌پذیر برای دیالوگ Alert/Confirm با
 * `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` و
 * `aria-describedby`.
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

/** دستهٔ نتیجهٔ `openDialog` — دیالوگ + focus trap + بستن. */
export interface DialogHandle {
  /** شناسهٔ دیالوگ. */
  id: string;
  element: HTMLElement;
  trap: DialogFocusTrap;
  /** بستن دیالوگ و برگرداندن فوکوس به عنصر قبلی. */
  close(): void;
  /** آزادسازی کامل (idempotent). */
  dispose(): void;
}

/**
 * #132: ساخت و باز کردن دیالوگ DOM با **focus trap** — مسیر پیشنهادی برای
 * `showConfirm`/`showAlert` وقتی UI در اختیار پکیج است:
 *
 * ```ts
 * const dialog = openDialog({ message: 'حذف شود؟' }, { kind: 'confirm' });
 * dialog.element.querySelector('[data-zen-dialog-confirm]')!.addEventListener('click', () => {
 *   dialog.close();
 * });
 * ```
 *
 * نکته: پیاده‌سازی trap در `./focus-trap` است (معادل `@zenith/a11y` که هنوز
 * پکیج مستقل نیست؛ ورود از `@zenith/runtime-core` برای L2 یک وابستگی رو به
 * بالا و ممنوع است — DEC-022/جداول لایه‌ها).
 */
export function openDialog(
  options: (AlertOptions | ConfirmOptions) & { kind?: 'alert' | 'confirm' },
  opts: { doc?: Document; idPrefix?: string; container?: HTMLElement; focusTrap?: boolean } = {},
): DialogHandle {
  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!doc) {
    // #115: بدون `throw new Error` — مسیر خطای واحد (error-hygiene).
    throw developerError(
      'openDialog: document در دسترس نیست (SSR) — از showAlert/showConfirm استفاده کنید.',
      'ZEN-907',
      { category: 'Runtime', suggestion: 'openDialog فقط در محیط DOM قابل استفاده است.' },
    );
  }
  const id = generateId();
  const idPrefix = opts.idPrefix ?? `zen_dialog_${id}`;
  const element = renderAccessibleDialog(options, idPrefix, doc);
  element.setAttribute('data-zen-dialog-id', id);

  const isConfirm = options.kind === 'confirm';
  const confirmBtn = doc.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.setAttribute('data-zen-dialog-confirm', '');
  confirmBtn.textContent =
    (isConfirm ? (options as ConfirmOptions).confirmText : (options as AlertOptions).closeText) ??
    (isConfirm ? 'تایید' : 'بستن');
  element.appendChild(confirmBtn);

  if (isConfirm) {
    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.setAttribute('data-zen-dialog-cancel', '');
    cancelBtn.textContent = (options as ConfirmOptions).cancelText ?? 'انصراف';
    element.appendChild(cancelBtn);
  }

  (opts.container ?? doc.body).appendChild(element);

  const enabled = opts.focusTrap ?? options.focusTrap ?? true;
  const trap = createDialogFocusTrap(element, { doc, returnFocus: true });
  if (enabled) trap.activate();

  let closed = false;
  const dispose = () => {
    if (closed) return;
    closed = true;
    openDialogs.delete(handle);
    trap.dispose();
    element.remove();
  };

  const handle: DialogHandle = {
    id,
    element,
    trap,
    close: () => {
      trap.deactivate();
      dispose();
    },
    dispose,
  };
  openDialogs.add(handle);
  return handle;
}

// ============================================================
// Global reset (#118) — no cross-test leaks
// ============================================================

/** #132: دیالوگ‌های DOMِ باز (برای آزادسازی در ریست سراسری). */
const openDialogs = new Set<{ dispose(): void }>();

/** #118/#132: بازنشانی کامل وضعیت ماژول (بدون هشدار) — هوک ریست سراسری. */
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
  defaultOptions = { ...DEFAULTS };
  currentMaxVisible = DEFAULTS.maxVisible;
  nextId = 1;
}

/* @__PURE__ */ onGlobalReset(resetNotificationsInternal);
