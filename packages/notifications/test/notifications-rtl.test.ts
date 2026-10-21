// @vitest-environment jsdom
//
// #100 — toast rendering is direction-agnostic: identical structure under
// both document directions, mixed bidi messages preserved verbatim.
// Code-first tests, not executed.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderAccessibleToast } from '../src/notification-render';
import type { Notification } from '../src/notification-types';

function note(message: string): Notification {
  return {
    id: 'n1',
    type: 'info',
    message,
    duration: 3000,
    position: 'top-left',
    createdAt: Date.now(),
    role: 'status',
    ariaLive: 'polite',
    ariaAtomic: true,
    dismissible: true,
    count: 1,
    reducedMotion: false,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('dir');
});

describe('notifications toast direction (#100)', () => {
  for (const dir of ['rtl', 'ltr'] as const) {
    it(`renders an identical accessible toast under dir=${dir}`, () => {
      document.documentElement.setAttribute('dir', dir);
      const el = renderAccessibleToast(note('سفارش Order #42 ثبت شد'));
      document.body.appendChild(el);
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-live')).toBe('polite');
      // Mixed bidi content is preserved verbatim (textContent isolation).
      expect(el.querySelector('.zen-toast-message')!.textContent).toBe('سفارش Order #42 ثبت شد');
      expect(el.querySelector('.zen-toast-close')).not.toBeNull();
      // No physical override: the toast inherits the document direction and
      // keeps its configured position class in both directions.
      expect(el.hasAttribute('dir')).toBe(false);
      expect(el.querySelector('.zen-toast-message')!.textContent).toContain('#42');
    });
  }
});
