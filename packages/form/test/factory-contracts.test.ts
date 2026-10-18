import { afterEach, expect, it } from 'vitest';
import { clearScheduler } from '@zenith/scheduler';
import { createRoot, getOwner, signal, effect, setOwner } from '@zenith/state';
import { createForm, createReactiveForm, FormStore, createFormFromSchema } from '../src';
import { createForm as canonicalFactory } from '../src/form-factory';
import { createReactiveForm as canonicalReactive } from '../src/form-reactive';
import { dynamicFormFactoryOptions } from '../src/form-factory-options';

afterEach(() => { clearScheduler(); setOwner(null); });
it('keeps moved factory functions identical through both facades', async () => {
  const facade = await import('../src/form');
  expect(createForm).toBe(canonicalFactory); expect(facade.createForm).toBe(canonicalFactory);
  expect(createReactiveForm).toBe(canonicalReactive); expect(facade.createReactiveForm).toBe(canonicalReactive);
});
it('returns a wizard even when its explicit step list is empty', async () => {
  const form = createForm({ initialValues: { name: 'one' }, steps: [] });
  try {
    expect(form.currentStep.peek()).toBe(0); expect(form.canGoNext.peek()).toBe(false);
    await form.next(); expect(form.currentStep.peek()).toBe(0); form.reset();
    expect(form.isStepComplete(0)).toBe(false);
  } finally { form.dispose(); }
});
it('uses a real dynamic empty record for an uninitialized wizard or explicit advanced form', async () => {
  const wizard = createForm({ steps: [] }), advanced = createForm({ initialValues: undefined });
  try {
    expect(wizard.values.peek()).toEqual({}); expect(advanced.values.peek()).toEqual({});
    advanced.setFieldValue('runtimeName', 7); expect(advanced.values.peek().runtimeName).toBe(7);
    expect(await advanced.validate()).toBe(true); expect(wizard.next).toBeTypeOf('function');
  } finally { wizard.dispose(); advanced.dispose(); }
});
it('does not share the default empty record between instances', () => {
  const first = createReactiveForm({}), second = createReactiveForm({});
  try { expect(first.values.peek()).not.toBe(second.values.peek()); }
  finally { first.dispose(); second.dispose(); }
});
it('preserves supplied reactive payload identity and asynchronous submit-control methods', async () => {
  const initial = { name: 'one', payload: { opaque: signal(1) } };
  const form = createReactiveForm({ initialValues: initial });
  try {
    expect(form.values.peek()).toBe(initial); form.errors.set({ name: 'old' });
    const started = form.startSubmit(); expect(started).toBeInstanceOf(Promise); await started;
    expect(form.submitting.peek()).toBe(true); expect(form.errors.peek()).toEqual({});
    await form.endSubmit(); expect(form.submitting.peek()).toBe(false);
    form.dispose(); await form.startSubmit(); expect(form.submitting.peek()).toBe(false);
  } finally { form.dispose(); initial.payload.opaque.dispose(); }
});
it('owns reactive state through its parent without leaving an ambient owner behind', async () => {
  const owned = createRoot(dispose => {
    const owner = getOwner(), form = createReactiveForm({ initialValues: { name: 'one' } });
    expect(getOwner()).toBe(owner); return { form, dispose };
  });
  const stop = effect(() => owned.form.values.get()); expect(owned.form.values.subscriberCount).toBe(1);
  owned.dispose(); expect(owned.form.values.subscriberCount).toBe(0);
  await owned.form.startSubmit(); expect(owned.form.submitting.peek()).toBe(false); stop();
});
it('retains unambiguous literal field maps, while explicit Store construction accepts reserved names', () => {
  const literal = createForm({ name: { initial: 'one' } });
  const reserved = new FormStore({ initialValues: { initial: 'actual field' }, rules: { initial: 3 } });
  try { expect(literal).toBeInstanceOf(FormStore); expect(reserved.getValue('rules')).toBe(3); expect(reserved.getValue('initialValues')).toBe('actual field'); }
  finally { literal.dispose(); reserved.dispose(); }
});
it('schema-generated field maps never pass through ambiguous options dispatch', () => {
  const form = createFormFromSchema({ fields: { rules: { type: 'text', initial: 'value' } } });
  try { expect(form).toBeInstanceOf(FormStore); expect(form.getValue('rules')).toBe('value'); }
  finally { form.dispose(); }
});
it('checks missing-initial configuration without running or decoding callbacks', () => {
  const initialReceiver = { count: 0, validate() { this.count++; return true; } };
  const source = { validation: { name: initialReceiver }, autoSave: { enabled: true, handler: async () => {} } };
  const options = dynamicFormFactoryOptions.resolve(source);
  expect(options.validation?.name).toBe(initialReceiver); expect(options.autoSave).toBe(source.autoSave); expect(initialReceiver.count).toBe(0);
  expect(() => dynamicFormFactoryOptions.resolve({ rules: { name: 3 } })).toThrow();
  expect(() => dynamicFormFactoryOptions.resolve({ steps: [{ id: 'bad', title: 'Bad', fields: [3] }] })).toThrow();
  expect(() => dynamicFormFactoryOptions.resolve({ initialValues: { madeUp: 3 } })).toThrow();
});
