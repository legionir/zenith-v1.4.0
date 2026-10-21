import { afterEach, expect, it } from 'vitest';
import { setHostPrinter } from '@zenith/errors/internal';
import { resetDeprecationWarnings } from '@zenith/errors';
import { FormStore, defineRule, clearCustomRules } from '../src';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); clearCustomRules(); resetDeprecationWarnings(); });
it('uses unambiguous canonical field bags and preserves opaque initial-value identity through reset', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const form = new FormStore({ rows: { initial: ['one', 'two'] } }); cleanups.push(() => form.dispose());
  const payload = { initial: 'an actual payload property', rules: 'not configuration' };
  form.addField({ name: 'payload', initial: payload }); expect(form.getValue('payload')).toBe(payload);
  form.addField({ name: 'undefined', initial: undefined }); expect(form.signal.peek().fields).toHaveProperty('undefined'); expect(form.getValue('undefined')).toBeUndefined();
  const fn = () => 'callable data'; form.addField({ name: 'callback', initial: fn }); expect(form.getValue('callback')).toBe(fn);
  form.moveItem('rows', { from: 1, to: 0 }); expect(form.getValue('rows')).toEqual(['two', 'one']);
  form.reset(); expect(form.getValue('payload')).toBe(payload); expect(form.getValue('callback')).toBe(fn);
  expect(messages.some(message => /ZEN-DEPR-(099|100)/.test(message))).toBe(false);
});
it('retains positional object-valued initials, once-only warnings and the old fractional-index path', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const form = new FormStore({ rows: { initial: ['one', 'two', 'three'] } }); cleanups.push(() => form.dispose());
  const payload = { name: 'payload', initial: 1 }; form.addField('legacy', payload, undefined); form.addField('other', undefined, undefined);
  expect(form.getValue('legacy')).toBe(payload); expect(form.signal.peek().fields).toHaveProperty('other');
  form.moveItem('rows', 1.5, 0); expect(form.getValue('rows')).toEqual(['two', 'one', 'three']); form.moveItem('rows', 0, 1);
  expect(messages.filter(message => message.includes('ZEN-DEPR-099'))).toHaveLength(1); expect(messages.filter(message => message.includes('ZEN-DEPR-100'))).toHaveLength(1);
  expect(() => form.moveItem('rows', { from: 1.5, to: 0 })).toThrow(); expect(() => form.moveItem('rows', { from: -1, to: 0 })).toThrow();
  // @ts-expect-error Canonical field names must be strings.
  expect(() => form.addField({ name: 1, initial: null })).toThrow();
});
it('retains field-construction validation order and no-op touched/duplicate identity', () => {
  let calls = 0; defineRule('count-add', () => { calls++; return { valid: true, error: null }; });
  const form = new FormStore({}); cleanups.push(() => form.dispose());
  form.addField({ name: 'field', initial: 'one', rules: 'count-add' }); expect(calls).toBe(2);
  const original = form.signal.peek(); form.addField({ name: 'field', initial: 'ignored' }); expect(form.signal.peek()).toBe(original);
  form.touch('missing'); expect(form.signal.peek()).toBe(original);
  form.touch('field'); const touched = form.signal.peek(); expect(touched.fields.field?.touched).toBe(true);
  form.touch('field'); expect(form.signal.peek()).toBe(touched);
  form.removeField('field'); expect(form.signal.peek().fields).toEqual({}); expect(form.isValid()).toBe(true);
});
