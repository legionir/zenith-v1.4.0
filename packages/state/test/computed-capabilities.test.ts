import { expect, it } from 'vitest';
import { computed, signal, effect, createRoot, type ReadonlySignal } from '../src';
import { flushSync } from '@zenith/scheduler';
it('implements every declared readonly capability without synthetic setters or double casts', () => {
  createRoot(dispose => {
    const source = signal(2), value: ReadonlySignal<number> = computed(() => source.get() * 2);
    try {
      expect(value.peek()).toBe(4); expect(value.get()).toBe(4); expect(value.subscriberCount).toBe(0);
      expect(value.removeSubscriber).toBeTypeOf('function'); expect(value.dispose).toBeTypeOf('function');
      expect(Reflect.get(value, 'set')).toBeUndefined(); expect(Reflect.get(value, 'update')).toBeUndefined();
    } finally { source.dispose(); dispose(); }
  });
});
it('does not subscribe a peek-only consumer but keeps the computed value reactive', () => {
  createRoot(dispose => {
    const source = signal(2), trigger = signal(0), value = computed(() => source.get() * 3); let runs = 0;
    const stop = effect(() => { trigger.get(); value.peek(); runs++; });
    try {
      expect(runs).toBe(1); expect(value.subscriberCount).toBe(0); source.set(3); flushSync(); expect(runs).toBe(1); expect(value.peek()).toBe(9);
      trigger.set(1); flushSync(); expect(runs).toBe(2);
    } finally { stop(); source.dispose(); trigger.dispose(); dispose(); }
  });
});
it('reports actual derived subscribers and releases them through ordinary effect cleanup', () => {
  createRoot(dispose => {
    const source = signal(1), value = computed(() => source.get() + 1); value.peek();
    const stop = effect(() => { value.get(); });
    try { expect(value.subscriberCount).toBe(1); stop(); expect(value.subscriberCount).toBe(0); }
    finally { stop(); source.dispose(); dispose(); }
  });
});
