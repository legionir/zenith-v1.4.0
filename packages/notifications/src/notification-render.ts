// packages/notifications/src/notification-render.ts
//
// رندر DOM دسترس‌پذیر toast/دیالوگ — استخراج مکانیکی از notifications.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import type { Cleanup } from '@zenith/shared';
import type {
  AlertOptions,
  ConfirmOptions,
  Notification,
} from './notification-types';
import {
  dismissNotification,
  pauseAutoDismiss,
  resumeAutoDismiss,
} from './notification-toasts';


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
/** @public */
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
/** @public */
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