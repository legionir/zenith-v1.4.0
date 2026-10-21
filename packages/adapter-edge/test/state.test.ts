// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { createDisposer } from '@zenith/shared';
import { cloneRequestState } from '../src/state';
it('preserves collection kinds, aliasing and sparse arrays without borrowing their ownership', () => {
  const cleanup = createDisposer(); const shared = new Date(0); const sparse = new Array<unknown>(3); sparse[2] = 'last';
  const source = { a: shared, b: shared, sparse, map: new Map([['key', { value: 1 }]]), set: new Set([1]), counter: signal(2) };
  try { const copy = cloneRequestState(source, cleanup); expect(copy.a).not.toBe(shared); expect(copy.a).toBe(copy.b); expect(copy.sparse).toHaveLength(3); expect(copy.map).toBeInstanceOf(Map); expect(copy.set).toBeInstanceOf(Set); expect(copy.counter).not.toBe(source.counter); }
  finally { cleanup.dispose(); expect(source.counter.get()).toBe(2); source.counter.dispose(); }
});
it('rejects accessor state without invoking getters or silently sharing custom instances', () => {
  const cleanup = createDisposer(); const read = vi.fn(); const source: Record<string, unknown> = {}; Object.defineProperty(source, 'get', { enumerable: true, get: read });
  try { expect(() => cloneRequestState(source, cleanup)).toThrow(); expect(read).not.toHaveBeenCalled(); expect(() => cloneRequestState({ instance: new (class PrivateState {})() }, cleanup)).toThrow(); }
  finally { cleanup.dispose(); }
});
it('does not mistake a root action named get for a readable state container', () => {
  const cleanup = createDisposer(); const get = vi.fn(); try { const copy = cloneRequestState({ get, name: 'data' }, cleanup); expect(copy.get).toBe(get); expect(copy.name).toBe('data'); expect(get).not.toHaveBeenCalled(); } finally { cleanup.dispose(); }
});
