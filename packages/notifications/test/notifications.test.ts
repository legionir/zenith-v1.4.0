// @vitest-environment jsdom
//
// #132 — اعلان‌ها: نام‌های canonical، صف/ادغام، ARIA، توقف تایمر روی
// hover/focus، prefers-reduced-motion و focus trap دیالوگ تأیید.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { expectAccessible } from '@zenith/testing';
import {
  DEFAULTS,
  notify,
  dismissNotification,
  getVisibleNotifications,
  getQueuedNotifications,
  getNotificationDefaults,
  setNotificationDefaults,
  showAlert,
  showConfirm,
  openDialog,
  alert,
  confirm,
  pauseAutoDismiss,
  resumeAutoDismiss,
  isAutoDismissPaused,
  autoDismissRemaining,
  renderAccessibleToast,
  renderAccessibleDialog,
  createDialogFocusTrap,
  resetNotificationsInternal,
} from '../src/index';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetNotificationsInternal();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.useRealTimers();
});

describe('#132 — نام‌های یکتا: showAlert/showConfirm (#119 هم‌راستا)', () => {
  it('نام‌های canonical موجودند و DEFAULTS منبع یکتای پیش‌فرض‌ها است', () => {
    expect(typeof showAlert).toBe('function');
    expect(typeof showConfirm).toBe('function');
    expect(getNotificationDefaults()).toMatchObject({
      duration: DEFAULTS.duration,
      position: DEFAULTS.position,
      maxVisible: DEFAULTS.maxVisible,
    });
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });

  it('alert/confirm قدیمی هنوز کار می‌کنند و هشدار ZEN-DEPR-052/053 می‌دهند', async () => {
    const alertPromise = alert('پیام');
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('ZEN-DEPR-052');
    // تسویه: دیالوگ را با close شدن Promise آزاد کن (ریست وضعیت)
    resetNotificationsInternal();
    void alertPromise;

    const confirmPromise = confirm('مطمئنی؟');
    expect(warnSpy.mock.calls.flat().join(' ')).toContain('ZEN-DEPR-053');
    resetNotificationsInternal();
    void confirmPromise;
  });

  it('showConfirm → Promise<boolean> است', async () => {
    const p = showConfirm('ادامه؟');
    expect(p).toBeInstanceOf(Promise);
    resetNotificationsInternal();
    void p;
  });
});

describe('#132 — maxVisible + صف', () => {
  it('۱۰۰ اعلان هم‌زمان ⇒ فقط maxVisible دیده می‌شود و بقیه در صف‌اند (معیار پذیرش)', () => {
    for (let i = 0; i < 100; i++) notify(`اعلان ${i}`, { maxVisible: 5 });
    expect(getVisibleNotifications()).toHaveLength(5);
    expect(getQueuedNotifications()).toHaveLength(95);
    expect(getVisibleNotifications()[0]!.message).toBe('اعلان 0');
    expect(getQueuedNotifications()[0]!.message).toBe('اعلان 5');
  });

  it('با بستن یک اعلان، اولین مورد صف جای آن را می‌گیرد', () => {
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push(notify(`m${i}`, { maxVisible: 3, persistent: true }));
    expect(getVisibleNotifications()).toHaveLength(3);
    expect(getQueuedNotifications()).toHaveLength(4);

    dismissNotification(ids[0]!);
    const visible = getVisibleNotifications().map((n) => n.message);
    expect(visible).toEqual(['m1', 'm2', 'm3']);
    expect(getQueuedNotifications().map((n) => n.message)).toEqual(['m4', 'm5', 'm6']);
  });

  it('maxVisible پیش‌فرض از DEFAULTS می‌آید (۵)', () => {
    for (let i = 0; i < 8; i++) notify(`d${i}`);
    expect(getVisibleNotifications()).toHaveLength(DEFAULTS.maxVisible);
  });
});

describe('#132 — ادغام تکراری‌ها', () => {
  it('با deduplicate، هم‌متن/هم‌نوع ادغام می‌شود و count بالا می‌رود', () => {
    const a = notify('ذخیره شد', { type: 'success', deduplicate: true });
    const b = notify('ذخیره شد', { type: 'success', deduplicate: true });
    const c = notify('ذخیره شد', { type: 'success', deduplicate: true });
    expect(new Set([a, b, c]).size).toBe(1);
    expect(getVisibleNotifications()).toHaveLength(1);
    expect(getVisibleNotifications()[0]!.count).toBe(3);

    // نوع متفاوت ⇒ اعلان جدید
    notify('ذخیره شد', { type: 'error', deduplicate: true });
    expect(getVisibleNotifications()).toHaveLength(2);
  });

  it('ادغام در صف هم کار می‌کند', () => {
    notify('a', { maxVisible: 1, persistent: true });
    notify('dup', { deduplicate: true, maxVisible: 1 });
    notify('dup', { deduplicate: true, maxVisible: 1 });
    expect(getQueuedNotifications()).toHaveLength(1);
    expect(getQueuedNotifications()[0]!.count).toBe(2);
  });

  it('بدون deduplicate، دو اعلان یکسان جدا می‌مانند', () => {
    notify('same');
    notify('same');
    expect(getVisibleNotifications()).toHaveLength(2);
  });
});

describe('#132 — ARIA (role/aria-live/aria-atomic)', () => {
  it('error/warning ⇒ role="alert"؛ بقیه ⇒ role="status"', () => {
    notify('خطا', { type: 'error' });
    notify('هشدار', { type: 'warning' });
    notify('موفق', { type: 'success' });
    notify('اطلاع', { type: 'info' });
    const roles = getVisibleNotifications().map((n) => [n.type, n.role, n.ariaLive]);
    expect(roles).toEqual([
      ['error', 'alert', 'assertive'],
      ['warning', 'alert', 'polite'],
      ['success', 'status', 'polite'],
      ['info', 'status', 'polite'],
    ]);
    expect(getVisibleNotifications().every((n) => n.ariaAtomic)).toBe(true);
  });

  it('renderAccessibleToast صفت‌های ARIA و دکمهٔ بستن با برچسب را می‌سازد', () => {
    notify('سلام', { type: 'error' });
    const el = renderAccessibleToast(getVisibleNotifications()[0]!);
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.getAttribute('aria-atomic')).toBe('true');
    const close = el.querySelector('button.zen-toast-close')!;
    expect(close.getAttribute('aria-label')).toBe('بستن اعلان');
  });

  it('خروجی DOM اعلان و دیالوگ در audit دسترس‌پذیری نقض serious ندارد (axe)', () => {
    notify('ذخیره شد', { type: 'success' });
    notify('خطای شبکه', { type: 'error' });
    const host = document.createElement('div');
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'اعلان‌ها');
    host.appendChild(renderAccessibleToast(getVisibleNotifications()[0]!));
    host.appendChild(renderAccessibleToast(getVisibleNotifications()[1]!));
    document.body.appendChild(host);

    const dialog = renderAccessibleDialog({ message: 'حذف شود؟', title: 'تأیید' });
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'تایید';
    dialog.appendChild(confirmBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'انصراف';
    dialog.appendChild(cancelBtn);
    document.body.appendChild(dialog);

    expect(expectAccessible(document.body).violations).toEqual([]);
    host.remove();
    dialog.remove();
  });
});

describe('#132 — prefers-reduced-motion', () => {
  it('با matches=true نشانهٔ data-zen-reduced-motion و transition:none ست می‌شود', () => {
    const original = window.matchMedia;
    // @ts-expect-error — جایگزین تستی API مرورگر
    window.matchMedia = () => ({ matches: true, addEventListener: () => undefined });
    try {
      notify('بی‌حرکت');
      const cfg = getVisibleNotifications()[0]!;
      expect(cfg.reducedMotion).toBe(true);
      const el = renderAccessibleToast(cfg);
      expect(el.getAttribute('data-zen-reduced-motion')).toBe('true');
      expect(el.style.transition).toBe('none');
      expect(el.style.animation).toBe('none');
    } finally {
      window.matchMedia = original;
    }
  });

  it('بدون درخواست کاربر، نشانه ست نمی‌شود', () => {
    notify('عادی');
    const el = renderAccessibleToast(getVisibleNotifications()[0]!);
    expect(el.hasAttribute('data-zen-reduced-motion')).toBe(false);
  });
});

describe('#132 — توقف تایمر روی hover/focus', () => {
  it('pauseAutoDismiss/resumeAutoDismiss زمان باقی‌مانده را حفظ می‌کنند', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const id = notify('زمان‌دار', { duration: 1000 });
    expect(isAutoDismissPaused(id)).toBe(false);

    vi.advanceTimersByTime(400);
    expect(autoDismissRemaining(id)).toBe(600);
    expect(pauseAutoDismiss(id)).toBe(true);
    expect(isAutoDismissPaused(id)).toBe(true);

    // در حالت توقف، زمان گذشته چیزی را نمی‌بندد
    vi.advanceTimersByTime(5000);
    expect(getVisibleNotifications().map((n) => n.id)).toContain(id);

    expect(resumeAutoDismiss(id)).toBe(true);
    vi.advanceTimersByTime(599);
    expect(getVisibleNotifications()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getVisibleNotifications()).toHaveLength(0);
  });

  it('mouseenter/mouseleave توست، تایمر را متوقف و ادامه می‌دهد', () => {
    vi.useFakeTimers();
    const id = notify('hover', { duration: 1000 });
    const el = renderAccessibleToast(getVisibleNotifications()[0]!) as HTMLElement & {
      dispose?: () => void;
    };

    el.dispatchEvent(new Event('mouseenter'));
    expect(isAutoDismissPaused(id)).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(getVisibleNotifications()).toHaveLength(1);

    el.dispatchEvent(new Event('mouseleave'));
    expect(isAutoDismissPaused(id)).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(getVisibleNotifications()).toHaveLength(0);
  });

  it('focusin/focusout روی دکمهٔ بستن هم تایمر را نگه می‌دارد', () => {
    vi.useFakeTimers();
    const id = notify('focus', { duration: 500 });
    const el = renderAccessibleToast(getVisibleNotifications()[0]!);
    document.body.appendChild(el);

    el.dispatchEvent(new FocusEvent('focusin', { bubbles: false }));
    expect(isAutoDismissPaused(id)).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(getVisibleNotifications()).toHaveLength(1);

    el.dispatchEvent(new FocusEvent('focusout', { bubbles: false }));
    vi.advanceTimersByTime(500);
    expect(getVisibleNotifications()).toHaveLength(0);
    el.remove();
  });

  it('dispose توست، لسنرها را برمی‌دارد (بدون نشتی)', () => {
    vi.useFakeTimers();
    const id = notify('dispose', { duration: 1000 });
    const el = renderAccessibleToast(getVisibleNotifications()[0]!) as HTMLElement & {
      dispose?: () => void;
    };
    el.dispose?.();
    el.dispatchEvent(new Event('mouseenter'));
    expect(isAutoDismissPaused(id)).toBe(false);
  });
});

describe('#132 — focus trap دیالوگ تأیید', () => {
  it('createDialogFocusTrap: Tab/Shift+Tab بین دکمه‌های دیالوگ می‌چرخد و فوکوس برمی‌گردد', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const container = document.createElement('div');
    const first = document.createElement('button');
    first.textContent = 'تایید';
    const last = document.createElement('button');
    last.textContent = 'انصراف';
    container.append(first, last);
    document.body.appendChild(container);

    const trap = createDialogFocusTrap(container);
    trap.activate();
    expect(document.activeElement).toBe(first);

    last.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(forward);
    expect(document.activeElement).toBe(first);

    first.focus();
    const backward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(backward);
    expect(document.activeElement).toBe(last);

    trap.deactivate();
    expect(document.activeElement).toBe(opener);
    container.remove();
    opener.remove();
  });

  it('openDialog دیالوگ تأیید را با trap باز می‌کند و close آن را می‌بندد', () => {
    const dialog = openDialog({
      message: 'حذف شود؟',
      confirmText: 'حذف',
      cancelText: 'نه',
      kind: 'confirm',
    });
    expect(dialog.trap.isActive()).toBe(true);
    const confirmBtn = dialog.element.querySelector('[data-zen-dialog-confirm]')!;
    const cancelBtn = dialog.element.querySelector('[data-zen-dialog-cancel]')!;
    expect(confirmBtn.textContent).toBe('حذف');
    expect(cancelBtn.textContent).toBe('نه');
    expect(document.body.contains(dialog.element)).toBe(true);
    expect(document.activeElement).toBe(confirmBtn);

    dialog.close();
    expect(document.body.contains(dialog.element)).toBe(false);
    expect(dialog.trap.isActive()).toBe(false);
  });

  it('resetNotificationsInternal دیالوگ‌های باز را می‌بندد (#118 بدون نشت بین تست‌ها)', () => {
    const dialog = openDialog({ message: 'x', kind: 'alert' });
    expect(document.body.contains(dialog.element)).toBe(true);
    resetNotificationsInternal();
    expect(document.body.contains(dialog.element)).toBe(false);
  });

  it('setNotificationDefaults می‌تواند پیش‌فرض‌ها را برگرداند (رفتار قبلی حفظ شد)', () => {
    setNotificationDefaults({ duration: 1234 });
    expect(getNotificationDefaults().duration).toBe(1234);
    resetNotificationsInternal();
    expect(getNotificationDefaults().duration).toBe(DEFAULTS.duration);
  });
});
