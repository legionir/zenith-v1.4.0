import { describe, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { createDisposer } from '@zenith/shared';
import { cloneRequestState } from '../src';

describe('shared SSR/Edge request state snapshots', () => {
  it('preserves aliases/cycles inside a snapshot without retaining source mutability', () => {
    const cleanup = createDisposer();
    const source: Record<string, unknown> = { nested: { value: 1 } }; source.self = source; source.alias = source.nested;
    const result = cloneRequestState(source, { cleanup });
    expect(result).not.toBe(source); expect(result.self).toBe(result); expect(result.alias).toBe(result.nested);
    (result.nested as { value: number }).value = 2; expect((source.nested as { value: number }).value).toBe(1); cleanup.dispose();
  });
  it('copies shared signals once and disposes only the request-owned copies', () => {
    const cleanup = createDisposer(), source = signal({ count: 1 }), sourceDispose = vi.spyOn(source, 'dispose');
    const result = cloneRequestState({ a: source, b: source }, { cleanup });
    const copy = result.a as typeof source; expect(result.b).toBe(copy); expect(copy).not.toBe(source);
    copy.set({ count: 2 }); expect(source.get()).toEqual({ count: 1 });
    const dispose = vi.spyOn(copy, 'dispose'); cleanup.dispose(); cleanup.dispose(); expect(dispose).toHaveBeenCalledTimes(1); expect(sourceDispose).not.toHaveBeenCalled(); source.dispose();
  });
  it('does not invoke input getters and permits an adapter-specific error boundary', () => {
    const getter = vi.fn(() => 'secret'), cleanup = createDisposer();
    const source = Object.defineProperty({}, 'secret', { enumerable: true, get: getter });
    expect(() => cloneRequestState(source, { cleanup })).toThrow(); expect(getter).not.toHaveBeenCalled();
    const invalid = () => new Error('edge-boundary'); expect(() => cloneRequestState(source, { cleanup, invalid })).toThrow('edge-boundary'); cleanup.dispose();
  });
  it('releases already copied signals when a later field is invalid and the owner unwinds', () => {
    const cleanup = createDisposer(), source = signal(1), add = vi.spyOn(cleanup, 'add');
    const input = Object.defineProperty({ okay: source }, 'bad', { enumerable: true, get() { throw new Error('must not execute'); } });
    expect(() => cloneRequestState(input, { cleanup })).toThrow(); expect(add).toHaveBeenCalledTimes(1); const copied = add.mock.calls[0]![0] as { dispose(): void }; const dispose = vi.spyOn(copied, 'dispose'); cleanup.dispose(); expect(dispose).toHaveBeenCalledTimes(1); expect(source.get()).toBe(1); source.dispose();
  });
});

it('does not attach a caller effect to the source signal while taking a request snapshot', async () => {
  const { effect } = await import('@zenith/state'), { flushSync } = await import('@zenith/scheduler'); const cleanup = createDisposer(), source = signal('first'); let runs = 0;
  const stop = effect(() => { runs++; cloneRequestState({ source }, { cleanup }); });
  try { source.set('second'); flushSync(); expect(runs).toBe(1); expect(source.get()).toBe('second'); } finally { stop(); cleanup.dispose(); source.dispose(); }
});
