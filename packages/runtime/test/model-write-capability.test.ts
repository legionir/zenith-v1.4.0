// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { processModel } from '../src/directives/model';
import { callModelMethod } from '../src/directives/native-method';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); document.body.innerHTML = ''; });
it('preserves dynamic map/target receivers and raw payload identity at the explicit native boundary', () => {
  const payload = { raw: true }; let receiver: unknown, value: unknown, reads = 0;
  const target = { get set() { reads++; return function(this: unknown, input: unknown) { receiver = this; value = input; }; } };
  callModelMethod(target, 'set', [payload]); expect(receiver).toBe(target); expect(value).toBe(payload); expect(reads).toBe(1);
  expect(callModelMethod(new Map([['key', target]]), 'get', ['key'])).toBe(target);
  expect(() => callModelMethod(null, 'set', [])).toThrow(TypeError); expect(() => callModelMethod({ set: true }, 'set', [])).toThrow(TypeError);
});
it('preserves the legacy local-map simple path accepting a setter-only target', () => {
  let receiver: unknown, value: unknown;
  const local = { set(input: unknown) { receiver = this; value = input; } };
  const context = { $row: 'initial', __zenith_signals__: new Map<string, unknown>([['row', local]]) };
  const element = document.createElement('input'); const stop = processModel(element, '$row', context, {}); cleanups.push(stop);
  expect(element.value).toBe('initial'); element.value = 'edited'; element.dispatchEvent(new Event('input', { bubbles: true }));
  expect(receiver).toBe(local); expect(value).toBe('edited');
  stop(); element.value = 'late'; element.dispatchEvent(new Event('input')); expect(value).toBe('edited');
});
it('retains the state target receiver and array-shaped nested updates', () => {
  const original = [{ title: 'one' }]; let next: unknown, receiver: unknown;
  const target = { get: () => original, set(value: unknown) { next = value; receiver = this; } };
  const context = { $rows: original }, element = document.createElement('input'); cleanups.push(processModel(element, '$rows[0].title', context, { rows: target }));
  element.value = 'two'; element.dispatchEvent(new Event('input'));
  expect(receiver).toBe(target); expect(Array.isArray(next)).toBe(true); expect(next).toEqual([{ title: 'two' }]); expect(original).toEqual([{ title: 'one' }]);
});
