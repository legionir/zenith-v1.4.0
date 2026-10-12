// @vitest-environment jsdom
//
// #116 — SWController: dispose() یک متد رسمی idempotent است؛ destroy() فقط
// alias با هشدار ZEN-DEPR-024. تست نشت: listenerهای controllerchange پس از
// dispose باید remove شوند.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { registerSW, type SWController } from '../src/index';

function mockNavigatorSW() {
  const added: Array<{ type: string; fn: EventListener }> = [];
  const removed: Array<{ type: string; fn: EventListener }> = [];
  const sw = {
    addEventListener: (type: string, fn: EventListener) => added.push({ type, fn }),
    removeEventListener: (type: string, fn: EventListener) => removed.push({ type, fn }),
    register: () =>
      Promise.resolve({
        waiting: null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    controller: null,
  };
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: sw,
    configurable: true,
  });
  return { added, removed };
}

describe('#116 SWController dispose/destroy', () => {
  let hooks: ReturnType<typeof mockNavigatorSW>;
  beforeEach(() => {
    resetDeprecationWarnings();
    hooks = mockNavigatorSW();
  });
  afterEach(() => {
    resetDeprecationWarnings();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  it('dispose() removes registered listeners and is idempotent', () => {
    const ctl = registerSW('/sw.js') as SWController;
    expect(ctl.supported).toBe(true);
    expect(hooks.added.some((a) => a.type === 'controllerchange')).toBe(true);
    ctl.dispose();
    expect(hooks.removed.some((r) => r.type === 'controllerchange')).toBe(true);
    const removals = hooks.removed.length;
    ctl.dispose(); // دوباره: listener دیگری remove نمی‌شود (idempotent)
    expect(hooks.removed.length).toBe(removals);
  });

  it('destroy() warns once ZEN-DEPR-024 and behaves like dispose', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const ctl = registerSW('/sw.js') as SWController;
      ctl.destroy();
      ctl.destroy();
      const depr = warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR-024'));
      expect(depr).toHaveLength(1);
      expect(hooks.removed.some((r) => r.type === 'controllerchange')).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});
