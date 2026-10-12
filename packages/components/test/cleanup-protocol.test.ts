// @vitest-environment jsdom
//
// #116 — processComponent: باید Cleanup idempotent برگرداند (قبلاً void).
// کامپوننت ثبت‌نشده ⇒ Cleanup no-op. onMount cleanup و dispose فرزندان باید
// با خروجی processComponent آزاد شوند و فقط یک‌بار اجرا شوند.
import { describe, it, expect, beforeEach } from 'vitest';
import { registerComponent, clearComponents } from '../src/index';
import { processComponent, registerLifecycle } from '../src/processor';

function tpl(html: string): HTMLTemplateElement {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t;
}

describe('#116 processComponent cleanup', () => {
  beforeEach(() => {
    clearComponents();
  });

  it('returns no-op Cleanup for unregistered components', () => {
    const cleanup = processComponent(document.createElement('div'), {}, () => {}, []);
    expect(typeof cleanup).toBe('function');
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });

  it('returns an idempotent Cleanup running onMount cleanup exactly once', () => {
    let mounted = 0;
    let mountCleanups = 0;
    registerComponent('x-card', tpl('<div class="body"><slot></slot></div>'));
    // ثبت هم‌زمان lifecycle (defineComponent dynamic-import است و async).
    registerLifecycle('x-card', {
      onMount: () => {
        mounted++;
        return () => {
          mountCleanups++;
        };
      },
    });
    const el = document.createElement('x-card');
    document.body.appendChild(el);
    const disposes: (() => void)[] = [];
    const cleanup = processComponent(
      el,
      {},
      (_n: HTMLElement, _c: Record<string, any>, _d: (() => void)[]) => {},
      disposes,
    );
    expect(typeof cleanup).toBe('function');
    expect(mounted).toBe(1);
    expect(disposes).toHaveLength(1); // سازگاری: walker/parent teardown
    cleanup();
    expect(mountCleanups).toBe(1);
    cleanup(); // idempotent — نه دوباره اجرا شود نه throw
    expect(mountCleanups).toBe(1);
  });

  it('child-dispose array is drained by the returned Cleanup', () => {
    registerComponent('x-plain', tpl('<b>ok</b>'));
    let childDisposed = 0;
    const el = document.createElement('x-plain');
    el.appendChild(document.createElement('span'));
    const cleanup = processComponent(
      el,
      {},
      (_n: HTMLElement, _c: Record<string, any>, d: (() => void)[]) => {
        d.push(() => childDisposed++);
      },
      [],
    );
    expect(childDisposed).toBe(0);
    cleanup();
    expect(childDisposed).toBeGreaterThanOrEqual(1);
    const n = childDisposed;
    cleanup();
    expect(childDisposed).toBe(n); // idempotent
  });
});
