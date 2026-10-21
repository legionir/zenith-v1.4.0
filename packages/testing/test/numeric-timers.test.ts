import { afterEach, expect, it } from 'vitest';
import { useFakeTimers, type FakeTimersController } from '../src';
let active: FakeTimersController | undefined;
afterEach(() => { active?.restore(); active = undefined; });
it('retains numeric runtime handles, callback arguments, coercion, stable ordering and scheduler flush points', () => {
  const original = globalThis.setTimeout; active = useFakeTimers(100);
  const seen: unknown[] = [];
  const cancelled: unknown = Reflect.apply(globalThis.setTimeout, globalThis, [() => seen.push('cancelled'), 5]);
  Reflect.apply(globalThis.clearTimeout, globalThis, [{ valueOf: () => cancelled }]);
  const handle: unknown = Reflect.apply(globalThis.setTimeout, globalThis, [(value: unknown) => seen.push(value), '5', { exact: true }]);
  setTimeout(() => { seen.push('second'); setTimeout(() => seen.push('nested'), 1); }, 5);
  expect(typeof handle).toBe('number');
  active.advanceTimersByTime(4); expect(seen).toEqual([]); expect(active.now()).toBe(104);
  active.advanceTimersByTime(1); expect(seen).toEqual([{ exact: true }, 'second']);
  active.runAllTimers(); expect(seen).toEqual([{ exact: true }, 'second', 'nested']); expect(active.now()).toBe(106);
  expect(active.dispose).toBe(active.restore); active.restore(); active.restore(); expect(globalThis.setTimeout).toBe(original);
});
it('preserves negative-delay clamping and discards pending tasks on restore', () => {
  active = useFakeTimers(20); let calls = 0;
  setTimeout(() => calls++, -10); active.advanceTimersByTime(0); expect(calls).toBe(1);
  setTimeout(() => calls++, 5); active.restore(); active.runAllTimers(); expect(calls).toBe(1);
});
it('rolls back the first patch if the clearTimeout slot cannot be written', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'clearTimeout')!;
  const original = globalThis.setTimeout;
  try {
    Object.defineProperty(globalThis, 'clearTimeout', { ...descriptor, writable: false });
    expect(() => useFakeTimers()).toThrow(TypeError);
    expect(globalThis.setTimeout).toBe(original);
  } finally { Object.defineProperty(globalThis, 'clearTimeout', descriptor); }
});
it('also rolls back the first patch when the clearTimeout setter throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'clearTimeout')!;
  const original = globalThis.setTimeout, clear = globalThis.clearTimeout, failure = new Error('host timer setter');
  try {
    Object.defineProperty(globalThis, 'clearTimeout', { configurable: true, get: () => clear, set() { throw failure; } });
    expect(() => useFakeTimers()).toThrow(failure); expect(globalThis.setTimeout).toBe(original);
  } finally { Object.defineProperty(globalThis, 'clearTimeout', descriptor); }
});
