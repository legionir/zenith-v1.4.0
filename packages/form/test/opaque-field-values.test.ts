import { afterEach, expect, it, vi } from 'vitest';
import { clearScheduler, flushSync } from '@zenith/scheduler';
import { setSignalObserver } from '@zenith/state';
import { createAdvancedForm } from '../src';
import { equalFormValue } from '../src/form-value-equality';

afterEach(() => clearScheduler());
it('does not stringify function, bigint, cyclic, native or undefined field payloads', () => {
  const original = () => 'first', replacement = () => 'second';
  const cycle: { self?: unknown; value: number } = { value: 1 }; cycle.self = cycle;
  const form = createAdvancedForm({ initialValues: { fn: original, large: 1n, cycle, opaque: new Map([['one', 1]]), optional: undefined }, validateOnChange: false });
  const fn = form.field('fn'), large = form.field('large'), cyclic = form.field('cycle'), opaque = form.field('opaque');
  try {
    form.setFieldValue('fn', replacement); form.setFieldValue('large', 2n);
    const same: typeof cycle = { value: 1 }; same.self = same; form.setFieldValue('cycle', same);
    form.setFieldValue('opaque', new Map([['one', 1]])); flushSync();
    expect(fn.dirty.get()).toBe(true); expect(large.dirty.get()).toBe(true); expect(cyclic.dirty.get()).toBe(false); expect(opaque.dirty.get()).toBe(true);
    expect(form.values.peek().fn).toBe(replacement); expect(form.values.peek().cycle).toBe(same);
    form.setFieldValue('fn', original); flushSync(); expect(fn.dirty.get()).toBe(false);
  } finally { form.dispose(); }
});
it('compares plain data without calling accessors or toJSON', () => {
  const getter = vi.fn(() => 1), serialize = vi.fn(() => ({ unsafe: true }));
  const a = { get value() { return getter(); }, toJSON: serialize };
  const b = { get value() { return getter(); }, toJSON: serialize };
  expect(equalFormValue(a, b)).toBe(false); expect(equalFormValue(a, a)).toBe(true);
  expect(getter).not.toHaveBeenCalled(); expect(serialize).not.toHaveBeenCalled();
  expect(equalFormValue(0, -0)).toBe(false); expect(equalFormValue(NaN, NaN)).toBe(true);
  expect(equalFormValue(undefined, null)).toBe(false);
});
it('preserves enumerable symbol/undefined keys and array lengths during structural comparison', () => {
  const key = Symbol('field');
  expect(equalFormValue({ [key]: 1 }, { [key]: 1 })).toBe(true);
  expect(equalFormValue({ [key]: 1 }, {})).toBe(false);
  expect(equalFormValue({ value: undefined }, {})).toBe(false);
  expect(equalFormValue([], new Array(3))).toBe(false);
  expect(equalFormValue({ items: [undefined, 1n] }, { items: [undefined, 1n] })).toBe(true);
});
it('treats inspection failures as dirty instead of partially failing a field write', () => {
  const bad = new Proxy({}, { ownKeys() { throw new Error('opaque'); } });
  expect(equalFormValue(bad, {})).toBe(false);
  const form = createAdvancedForm({ initialValues: { value: {} }, validateOnChange: false });
  try { form.setFieldValue('value', bad); expect(form.values.peek().value).toBe(bad); expect(form.field('value').dirty.get()).toBe(true); }
  finally { form.dispose(); }
});
it('checks only array capability, preserves undefined entries, and clears dirty after restoring initial content', () => {
  const form = createAdvancedForm({ initialValues: { rows: [undefined, 'two'], invalid: 'not an array' }, validateOnChange: false });
  const rows = form.array<string | undefined>('rows'), field = form.field('rows');
  try {
    rows.swap(0, 1); expect(form.values.peek().rows).toEqual(['two', undefined]); expect(field.dirty.get()).toBe(true);
    rows.swap(0, 1); flushSync(); expect(form.values.peek().rows).toEqual([undefined, 'two']); expect(field.dirty.get()).toBe(false);
    expect(() => form.array('invalid').items.get()).toThrow(/requires an array/i);
  } finally { form.dispose(); }
});
it('lets an explicit field error supersede an older async validation decision', async () => {
  let resolve!: (value: boolean | string) => void;
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validate: { name: () => new Promise<boolean | string>(done => { resolve = done; }) } });
  try {
    const pending = form.validateField('name'); form.setFieldError('name', 'manual error'); resolve(true); await pending;
    expect(form.errors.peek().name).toBe('manual error');
  } finally { form.dispose(); }
});
it('bounds virtual object graphs rather than hanging on an endlessly expanding proxy', () => {
  const virtual = (): object => new Proxy({}, {
    ownKeys: () => ['next'],
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, writable: true, value: virtual() }),
  });
  expect(equalFormValue(virtual(), virtual())).toBe(false);
});

it('does not overwrite a reset or start old validation after a values observer re-enters the form', () => {
  const validator = vi.fn(() => true);
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validate: { name: validator } });
  const off = setSignalObserver({ onChange(source, _old, next) {
    if (Object.is(source, form.values) && next !== null && typeof next === 'object' && Reflect.get(next, 'name') === 'two') form.reset();
  } });
  try {
    form.setFieldValue('name', 'two');
    expect(form.values.peek().name).toBe('one'); expect(form.field('name').dirty.get()).toBe(false); expect(validator).not.toHaveBeenCalled();
  } finally { off(); form.dispose(); }
});
it('does not schedule blur validation after a touch observer resets the form', () => {
  const validator = vi.fn(() => true);
  const form = createAdvancedForm({ initialValues: { name: 'one' }, validateOnBlur: true, validate: { name: validator } });
  const off = setSignalObserver({ onChange(_source, _old, next) {
    if (next !== null && typeof next === 'object' && Reflect.get(next, 'name') === true) form.reset();
  } });
  try {
    form.setFieldTouched('name');
    expect(form.field('name').touched.get()).toBe(false); expect(validator).not.toHaveBeenCalled();
  } finally { off(); form.dispose(); }
});
