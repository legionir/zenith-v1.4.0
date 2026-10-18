// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createApp, hydrate, type App } from '../src';
const apps: App[] = [];
afterEach(() => { for (const app of apps.splice(0).reverse()) app.dispose(); document.body.innerHTML = ''; });
it('preserves native model/ref setter receivers without claiming arbitrary payload writes are type-safe', () => {
  const writes: unknown[] = []; const receivers: unknown[] = [];
  const model = { get: () => 'initial', set(value: unknown) { writes.push(value); receivers.push(this); } };
  const ref = { set(value: unknown) { writes.push(value); receivers.push(this); } };
  const app = createApp({ state: { model, ref } }); apps.push(app);
  const root = document.createElement('main'); root.innerHTML = '<input zen-model="model"><span zen-ref="ref"></span>'; document.body.append(root);
  const stop = app.mount(root); const input = root.querySelector('input')!, span = root.querySelector('span')!;
  expect(input.value).toBe('initial'); expect(writes).toEqual([span]); expect(receivers).toEqual([ref]);
  input.value = 'edited'; input.dispatchEvent(new Event('input', { bubbles: true })); expect(writes[1]).toBe('edited'); expect(receivers[1]).toBe(model);
  stop(); expect(writes[2]).toBeNull(); expect(receivers[2]).toBe(ref);
});
it('keeps checkbox and numeric input coercion on the runtime side of the unknown setter boundary', () => {
  const checked: unknown[] = [], numbers: unknown[] = [];
  const app = createApp({ state: { check: { get: () => false, set: (value: unknown) => checked.push(value) }, amount: { get: () => 1, set: (value: unknown) => numbers.push(value) } } }); apps.push(app);
  const root = document.createElement('main'); root.innerHTML = '<input type="checkbox" zen-model="check"><input zen-model.number="amount">'; document.body.append(root); app.mount(root);
  const inputs = root.querySelectorAll('input'); inputs[0]!.checked = true; inputs[0]!.dispatchEvent(new Event('change')); inputs[1]!.value = '42'; inputs[1]!.dispatchEvent(new Event('input'));
  expect(checked).toEqual([true]); expect(numbers).toEqual([42]);
});
it('passes decoded server data to the original setter receiver during hydration', async () => {
  const writes: unknown[] = []; let receiver: unknown;
  const value = { get: () => 'client', set(next: unknown) { writes.push(next); receiver = this; } };
  const state = document.createElement('script'); state.id = 'zenith-state'; state.type = 'application/json'; state.textContent = '{"value":{"server":true}}'; const root = document.createElement('main'); document.body.append(state, root);
  const result = await hydrate(root, { state: { value } }); apps.push(result.app);
  expect(writes).toEqual([{ server: true }]); expect(receiver).toBe(value); result.cleanup();
});
