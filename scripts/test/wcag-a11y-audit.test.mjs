// @vitest-environment jsdom
/* global document, window */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  notify,
  clearAllNotifications,
  notificationsAPI,
  renderAccessibleToast,
  renderAccessibleDialog,
} from '../../packages/notifications/src/index.ts';
import { zenAnimate, prefersReducedMotion } from '../../packages/transition/src/index.ts';
import { announceRouteChange, syncActiveRouteLinks } from '../../packages/router/src/index.ts';

describe('WCAG 2.2 AA accessibility audit & compliance (#98)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearAllNotifications();
  });

  it('assigns WCAG 4.1.3 role and aria-live metadata to notifications and renders accessible toast/dialog DOM', () => {
    const infoId = notify('ذخیره شد', { type: 'info', duration: 0 });
    const errId = notify('خطای شبکه', { type: 'error', title: 'خطا', duration: 0 });

    const all = notificationsAPI.getNotifications();
    const infoNotif = all.find((n) => n.id === infoId);
    const errNotif = all.find((n) => n.id === errId);

    expect(infoNotif.role).toBe('status');
    expect(infoNotif.ariaLive).toBe('polite');
    expect(infoNotif.ariaAtomic).toBe(true);

    expect(errNotif.role).toBe('alert');
    expect(errNotif.ariaLive).toBe('assertive');
    expect(errNotif.ariaAtomic).toBe(true);

    const toastEl = renderAccessibleToast(errNotif);
    expect(toastEl.getAttribute('role')).toBe('alert');
    expect(toastEl.getAttribute('aria-live')).toBe('assertive');
    expect(toastEl.getAttribute('aria-atomic')).toBe('true');

    const dialogEl = renderAccessibleDialog({
      title: 'حذف آیتم',
      message: 'آیا مطمئن هستید؟',
    });
    expect(dialogEl.getAttribute('role')).toBe('alertdialog');
    expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    expect(dialogEl.getAttribute('aria-labelledby')).toBe('zen_dialog_title');
    expect(dialogEl.getAttribute('aria-describedby')).toBe('zen_dialog_desc');
  });

  it('respects prefers-reduced-motion: reduce in @zenith/transition zenAnimate (WCAG 2.3.3)', async () => {
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
    }));

    try {
      expect(prefersReducedMotion()).toBe(true);
      const el = document.createElement('div');
      let capturedOptions = null;
      el.animate = vi.fn().mockImplementation((_kf, opts) => {
        capturedOptions = opts;
        const anim = {
          commitStyles: vi.fn(),
          cancel: vi.fn(),
          onfinish: null,
        };
        queueMicrotask(() => {
          if (typeof anim.onfinish === 'function') anim.onfinish();
        });
        return anim;
      });

      await zenAnimate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
      expect(capturedOptions.duration).toBe(0);
      expect(el.style.opacity).toBe('1');
    } finally {
      window.matchMedia = origMatchMedia;
    }
  });

  it('announces SPA route changes in an aria-live polite region and sets aria-current="page" on active links', () => {
    document.body.innerHTML = `
      <nav>
        <a href="/home" id="link-home">خانه</a>
        <a href="/settings" id="link-settings">تنظیمات</a>
      </nav>
    `;

    syncActiveRouteLinks('/settings');
    expect(document.getElementById('link-settings')?.getAttribute('aria-current')).toBe('page');
    expect(document.getElementById('link-home')?.getAttribute('aria-current')).toBeNull();

    const region = announceRouteChange('صفحه تنظیمات');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.textContent).toBe('صفحه تنظیمات');

    const auditDoc = join(process.cwd(), 'docs/A11Y-AUDIT.md');
    expect(existsSync(auditDoc)).toBe(true);
    expect(readFileSync(auditDoc, 'utf8')).toContain('WCAG 2.2');
  });
});
