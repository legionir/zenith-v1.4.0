import { afterEach, expect, it, vi } from 'vitest';
import { signal, computed, isWritable, isReadable, createRoot, effect, type EffectSubscriber } from '../src';
import { isDevtoolsEnabled } from '../src/devtools';
import { flushSync } from '@zenith/scheduler';
afterEach(() => vi.unstubAllGlobals());
it('observes only a setter and leaves getter inference to an independent readable check', () => {
  const target = { set(_value: number) {} };
  expect(isWritable(target)).toBe(true); expect(isReadable(target)).toBe(false);
  expect(isWritable({ set: true })).toBe(false); expect(isWritable(null)).toBe(false);
  expect(isWritable(() => {})).toBe(false);
  const count = signal(1); expect(isWritable(count)).toBe(true); expect(isWritable(computed(() => count.get()))).toBe(false);
});
it('retains actual subscriber identity and zero-argument execution through typed capabilities', () => {
  createRoot(dispose => {
    const source = signal(1); const calls: number[] = [];
    const stop = effect(() => { calls.push(source.get()); });
    try { expect(source.subscriberCount).toBe(1); source.set(2); flushSync(); expect(calls).toEqual([1, 2]); stop(); expect(source.subscriberCount).toBe(0); }
    finally { stop(); source.dispose(); dispose(); }
  });
  const subscriber: EffectSubscriber = () => {};
  const source = signal(1); expect(() => source.removeSubscriber(subscriber)).not.toThrow(); source.dispose();
});
it('preserves native development flag precedence with unknown global lookup', () => {
  vi.stubGlobal('__ZENITH_DEVTOOLS__', false); vi.stubGlobal('__ZENITH_DEV__', false); expect(isDevtoolsEnabled()).toBe(false);
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true); expect(isDevtoolsEnabled()).toBe(true);
  vi.stubGlobal('__ZENITH_DEVTOOLS__', false); vi.stubGlobal('__ZENITH_DEV__', undefined); expect(isDevtoolsEnabled()).toBe(true);
});
