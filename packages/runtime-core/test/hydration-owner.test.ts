// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { hydrate, useId, createApp } from '../src';
it('owns the internally-created App and its plugins until hydration cleanup', async () => {
  const root = document.createElement('main'); root.innerHTML = '<span zen-text="title"></span>'; const state = document.createElement('script'); state.id = 'zenith-state'; state.type = 'application/json'; state.textContent = '{"title":"server","__proto__":{"polluted":true}}'; document.body.append(state, root); const stop = vi.fn();
  try { const result = await hydrate(root, { plugins: [{ name: 'owner', install() { return stop; } }] }); expect(root.textContent).toBe('server'); result.cleanup(); result.cleanup(); expect(stop).toHaveBeenCalledOnce(); expect(() => result.app.run(() => {})).toThrow(); expect(Object.prototype).not.toHaveProperty('polluted'); }
  finally { state.remove(); root.remove(); }
});
it('keeps synchronous App-run ID scopes independent of the ambient fallback', () => {
  const first = createApp(), second = createApp();
  try { expect(first.run(() => useId('owned'))).toBe('owned-1'); expect(first.run(() => useId('owned'))).toBe('owned-2'); expect(second.run(() => useId('owned'))).toBe('owned-1'); }
  finally { first.dispose(); second.dispose(); }
});
