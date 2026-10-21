// packages/notifications/src/notification-dialog.ts
//
// دیالوگ DOM با focus trap — استخراج مکانیکی از notifications.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { developerError } from '@zenith/errors';
import { createDialogFocusTrap, type DialogFocusTrap } from './focus-trap';
import { generateId, openDialogs } from './notification-state';
import { renderAccessibleDialog } from './notification-render';
import type { AlertOptions, ConfirmOptions } from './notification-types';


/** دستهٔ نتیجهٔ `openDialog` — دیالوگ + focus trap + بستن. */
/** @public */
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
 * نکته: پیاده‌سازی trap در `./focus-trap` است — نمای نازکی بر `createFocusTrap`
 * از `@zenith/a11y` (پکیج مستقل L2، یال L2→L2 قانونی) که فقط `escapeDeactivates`
 * را `false` قفل می‌کند، چون Esc را خود دیالوگ با `close('esc')` مدیریت می‌کند.
 */
/** @public */
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