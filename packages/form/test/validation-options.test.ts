import { afterEach, expect, it } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';
import { validateField, validateFieldAsync, validateFormAsync, validateWithLifecycle, defineRule, defineAsyncRule, clearCustomRules, FormStore, createForm, type FormValidationLifecycle } from '../src';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); clearCustomRules(); resetDeprecationWarnings(); });
function diagnostics(): string[] { const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title))); return messages; }
it('keeps cross-field values, callback arguments and abort-signal identity in canonical field validation', async () => {
  const messages = diagnostics(), values = { password: 'same' }, controller = new AbortController(); const seen: unknown[] = [];
  defineRule('inspect-sync', (value, all, param) => { seen.push(value, all, param); return { valid: true, error: null }; });
  defineAsyncRule('inspect-async', async (value, all, param, signal) => { seen.push(value, all, param, signal); return { valid: true, error: null }; });
  expect(validateField('same', { rules: 'inspect-sync:p', allValues: values }).valid).toBe(true);
  expect((await validateFieldAsync('same', { rules: 'inspect-async:q', allValues: values, signal: controller.signal })).valid).toBe(true);
  expect(seen).toEqual(['same', values, 'p', 'same', values, 'q', controller.signal]); expect(seen[1]).toBe(values); expect(seen[4]).toBe(values); expect(seen[6]).toBe(controller.signal);
  expect(messages.some(message => /ZEN-DEPR-09[5-8]/.test(message))).toBe(false);
});
it('retains serial async evaluation, short circuiting and the original abort points', async () => {
  const order: string[] = []; const controller = new AbortController();
  defineAsyncRule('one', async () => { order.push('one'); controller.abort(); return { valid: true, error: null }; });
  defineAsyncRule('two', async () => { order.push('two'); return { valid: true, error: null }; });
  expect((await validateFieldAsync('x', { rules: 'one,two', signal: controller.signal })).valid).toBe(true); expect(order).toEqual(['one']);
  order.length = 0;
  expect((await validateFieldAsync('', { rules: 'required,two' })).valid).toBe(false); expect(order).toEqual([]);
});
it('retains lifecycle receiver, original values, callback ordering and before-hook cancellation', async () => {
  const values = { name: '' }, events: string[] = []; let observed: unknown;
  const lifecycle: FormValidationLifecycle = {
    onBeforeValidate(input) { expect(this).toBe(lifecycle); observed = input; events.push('before'); return true; },
    onAfterValidate() { expect(this).toBe(lifecycle); events.push('after'); },
    onFieldError(name) { events.push(name); }, onFormInvalid() { events.push('invalid'); },
  };
  expect((await validateWithLifecycle(values, { rules: { name: 'required' }, lifecycle })).valid).toBe(false);
  expect(observed).toBe(values); expect(events).toEqual(['before', 'after', 'name', 'invalid']);
  expect(await validateWithLifecycle(values, { rules: { name: 'required' }, lifecycle: { onBeforeValidate: () => false, onAfterValidate: () => { throw new Error('must not run'); } } })).toEqual({ valid: true, fields: {} });
});
it('retains nested form values and accepts fields named like canonical options without ambiguity', async () => {
  const values = { values: '', rules: '', profile: { name: '' } }, rules = { values: 'required', rules: 'required', 'profile.name': 'required' };
  const canonical = await validateFormAsync({ values, rules });
  expect(canonical.valid).toBe(false); expect(Object.keys(canonical.fields)).toEqual(['values', 'rules', 'profile.name']);
  expect(await validateFormAsync(values, rules)).toEqual(canonical);
});
it('warns once per positional bridge and keeps historical empty/undefined rules', async () => {
  const messages = diagnostics();
  for (let i = 0; i < 2; i++) {
    expect(validateField('', undefined as unknown as string, undefined)).toEqual({ valid: true, error: null });
    expect(await validateFieldAsync('', undefined as unknown as string, undefined, undefined)).toEqual({ valid: true, error: null });
    await validateFormAsync({ name: '' }, { name: '' }, undefined);
    await validateWithLifecycle({ name: '' }, { name: '' }, {}, undefined);
  }
  for (const code of ['095', '096', '097', '098']) expect(messages.filter(message => message.includes(`ZEN-DEPR-${code}`))).toHaveLength(1);
});
it('rejects malformed canonical configuration through rejected Promises for async APIs', async () => {
  // @ts-expect-error Canonical rules must be strings.
  expect(() => validateField('', { rules: 1 })).toThrow();
  let pending: Promise<unknown> | undefined;
  // @ts-expect-error Invalid JavaScript caller, but async API must not throw synchronously.
  expect(() => { pending = validateFieldAsync('', { rules: true }); }).not.toThrow();
  await expect(pending).rejects.toBeDefined();
  // @ts-expect-error Form rule maps contain strings.
  await expect(validateFormAsync({ values: {}, rules: { name: 1 } })).rejects.toBeDefined();
  // @ts-expect-error Lifecycle callbacks must be callable.
  await expect(validateWithLifecycle({}, { rules: {}, lifecycle: { onBeforeValidate: true } })).rejects.toBeDefined();
});
it('keeps ordinary store/advanced validation on canonical internal calls without bridge diagnostics', async () => {
  const messages = diagnostics(); const store = new FormStore({ name: { initial: 'One', rules: 'required' } }); cleanups.push(() => store.dispose());
  store.setValue('name', 'Two'); store.validate(); await store.validateAsync();
  const advanced = createForm({ initialValues: { name: 'One' }, rules: { name: 'required' }, validateOnChange: false }); await advanced.validate();
  expect(messages.some(message => /ZEN-DEPR-09[5-8]/.test(message))).toBe(false);
});
