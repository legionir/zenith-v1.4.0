// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { signal } from '@zenith/state';
import { installDevtoolsCore, registerSignal, snapshot, restore, replay, clearDevtoolsRegistryInternal } from '../src';
const disposes: Array<() => void> = [];
afterEach(() => { for (const dispose of disposes.splice(0).reverse()) dispose(); clearDevtoolsRegistryInternal(); });
it('round-trips typed signals without exposing a writable unknown inspection view', async () => {
  clearDevtoolsRegistryInternal(); const core = installDevtoolsCore({ enabled: true }); disposes.push(() => core.dispose());
  const number = signal(1), text = signal('first'); disposes.push(() => number.dispose(), () => text.dispose());
  registerSignal(number, 'number'); registerSignal(text, 'text'); const initial = snapshot();
  number.set(2); text.set('second'); restore(initial); expect(number.get()).toBe(1); expect(text.get()).toBe('first');
  await replay(0, 1, { speed: 200 }); expect(number.get()).toBe(2); expect(text.get()).toBe('second');
});
it('keeps readonly failures local while restoring other compatible snapshot entries', () => {
  clearDevtoolsRegistryInternal(); const core = installDevtoolsCore({ enabled: true }); disposes.push(() => core.dispose());
  const readonly = signal('fixed', { readonly: true }), writable = signal(1); disposes.push(() => readonly.dispose(), () => writable.dispose());
  const readonlyId = registerSignal(readonly), writableId = registerSignal(writable), next = snapshot();
  next.signals[readonlyId]!.value = 'not allowed'; next.signals[writableId]!.value = 4;
  expect(() => restore(next)).not.toThrow(); expect(readonly.get()).toBe('fixed'); expect(writable.get()).toBe(4);
});
