// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createDisposer } from '@zenith/shared';
import { processResource } from '../src';
it('releases already-bound children when a later child throws', () => {
  const root = document.createElement('section'); root.innerHTML = '<span></span><span></span>'; const stop = vi.fn(); const owned = createDisposer(); let calls = 0;
  expect(() => processResource(root, { expr: '"/items"', context: {}, disposes: owned, processChildren() { if (++calls === 2) throw new Error('bind'); return stop; } })).toThrow();
  expect(stop).toHaveBeenCalledOnce(); owned.dispose(); expect(stop).toHaveBeenCalledOnce();
});
it('does not acquire resources from a delayed bind after owner teardown', () => {
  const owned = createDisposer(); owned.dispose(); const process = vi.fn(); expect(() => processResource(document.createElement('section'), { expr: 'invalid(', context: {}, disposes: owned, processChildren: process })()).not.toThrow(); expect(process).not.toHaveBeenCalled();
});
it('stops the child walk when a child synchronously closes the owning scope', () => {
  const root = document.createElement('section'); root.innerHTML = '<span></span><span></span><span></span>';
  const owner = createDisposer(); const childCleanup = vi.fn(); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const bind = vi.fn(() => { owner.dispose(); return childCleanup; });
  try {
    const release = processResource(root, { expr: '"/items"', context: {}, disposes: owner, processChildren: bind });
    expect(bind).toHaveBeenCalledOnce(); expect(childCleanup).toHaveBeenCalledOnce(); expect(fetcher).not.toHaveBeenCalled(); release(); expect(childCleanup).toHaveBeenCalledOnce();
  } finally { owner.dispose(); vi.unstubAllGlobals(); }
});
