import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { clearDevtoolsRegistryInternal, getTimeline, installDevtoolsCore, registerSignal, replay } from '../src';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); clearDevtoolsRegistryInternal(); vi.useRealTimers(); });
function setup() {
  vi.useFakeTimers(); const core = installDevtoolsCore({ enabled: true }); cleanups.push(() => core.dispose());
  const source = signal(0); cleanups.push(() => source.dispose()); source.set(1); source.set(2); return source;
}

it('invalidates sleeping replay on reset and allows new-epoch capture immediately', async () => {
  const source = setup(); const oldId = registerSignal(source);
  const work = replay(0, 1, { speed: 1 }); expect(source.get()).toBe(1);
  clearDevtoolsRegistryInternal(); expect(registerSignal(source)).not.toBe(oldId);
  source.set(3); expect(getTimeline().map(change => change.newValue)).toEqual([3]);
  await vi.runAllTimersAsync(); await work;
  expect(source.get()).toBe(3); expect(getTimeline().map(change => change.newValue)).toEqual([3]);
});

it('does not unmute capture when one replay finishes while another operation is sleeping', async () => {
  const source = setup(); const first = replay(0, 1, { speed: 1 }), second = replay(1, 0, { speed: 0.5 });
  await vi.advanceTimersByTimeAsync(5); await first;
  source.set(9); expect(getTimeline()).toHaveLength(2);
  await vi.runAllTimersAsync(); await second; expect(source.get()).toBe(0);
  source.set(10); expect(getTimeline().map(change => change.newValue)).toEqual([1, 2, 10]);
});
