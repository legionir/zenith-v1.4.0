import { describe, expect, it } from 'vitest';
import { installTestBridge, TEST_BRIDGE_KEY, type TestBridge } from '../src/browser';

function bridge(target: object): TestBridge { return (target as Record<string, TestBridge>)[TEST_BRIDGE_KEY]!; }
describe('test-only application bridge ownership (#166)', () => {
  it('uses actual readiness and signal getter/setter without polling sleeps', () => {
    let ready = false, value = 0;
    const target = {};
    const owner = installTestBridge({ ready: () => ready, signals: { count: { get: () => value, set: (next: number) => { value = next; } } }, snapshot: () => ({ value }) }, target);
    expect(bridge(target).ready()).toBe(false); ready = true;
    expect(bridge(target).ready()).toBe(true); bridge(target).setSignal('count', 3);
    expect(bridge(target).getSignal('count')).toBe(3); expect(bridge(target).snapshot()).toEqual({ value: 3 });
    owner.dispose(); owner.dispose(); expect(TEST_BRIDGE_KEY in target).toBe(false);
  });
  it('restores the exact previous descriptor and never deletes a newer lease', () => {
    const target = {};
    Object.defineProperty(target, TEST_BRIDGE_KEY, { value: 'original', configurable: true, enumerable: false });
    const first = installTestBridge({ ready: () => true, signals: {} }, target);
    const second = installTestBridge({ ready: () => false, signals: {} }, target);
    first.dispose(); expect(bridge(target).ready()).toBe(false);
    second.dispose(); expect(Object.getOwnPropertyDescriptor(target, TEST_BRIDGE_KEY)).toEqual({ value: 'original', writable: false, configurable: true, enumerable: false });
  });
  it('does not overwrite a foreign property replacement at teardown', () => {
    const target = {};
    const owner = installTestBridge({ ready: () => true, signals: {} }, target);
    Object.defineProperty(target, TEST_BRIDGE_KEY, { value: 'foreign', configurable: true }); owner.dispose();
    expect((target as Record<string, unknown>)[TEST_BRIDGE_KEY]).toBe('foreign');
  });
  it('fails atomically on a sealed host rather than retaining a phantom bridge lease', () => {
    const target = Object.preventExtensions({});
    expect(() => installTestBridge({ ready: () => true, signals: {} }, target)).toThrow(/ZEN-1090/);
    expect(TEST_BRIDGE_KEY in target).toBe(false);
  });
  it('rejects unknown/prototype or readonly signals instead of silently succeeding', () => {
    const target = {};
    const owner = installTestBridge({ ready: () => true, signals: { readonly: { get: () => 1 } } }, target);
    expect(() => bridge(target).getSignal('__proto__')).toThrowError(expect.objectContaining({ code: 'ZEN-1090' }));
    expect(() => bridge(target).setSignal('readonly', 2)).toThrow();
    const stale = bridge(target); owner.dispose(); expect(stale.ready()).toBe(false);
    expect(() => stale.getSignal('readonly')).toThrow();
  });
});
