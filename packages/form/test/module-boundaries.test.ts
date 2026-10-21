import { expect, it } from 'vitest';
import { FormStore, createForm, createAdvancedForm, createWizardForm } from '../src/form';
import { FormStore as CanonicalStore } from '../src/form-store';
import { createAdvancedForm as canonicalAdvanced } from '../src/form-advanced';
import { createWizardForm as canonicalWizard } from '../src/form-wizard';
it('preserves facade constructor/function identity rather than introducing wrappers', () => {
  expect(FormStore).toBe(CanonicalStore); expect(createAdvancedForm).toBe(canonicalAdvanced); expect(createWizardForm).toBe(canonicalWizard);
});
it('preserves legacy field arrays, touched state, reset values and disposal', () => {
  const form = createForm({ names: { initial: ['one'] }, email: { initial: '', rules: 'required' } });
  try {
    form.pushItem('names', 'two'); form.moveItem('names', { from: 1, to: 0 });
    expect(form.getValue('names')).toEqual(['two', 'one']);
    form.touchAll(); expect(form.signal.peek().fields.email?.touched).toBe(true);
    form.setValue('email', 'user@example.test'); form.reset();
    expect(form.getValues()).toEqual({ names: ['one'], email: '' });
    expect(form.signal.peek().fields.email?.touched).toBe(false);
  } finally { form.dispose(); form.dispose(); }
});
it('keeps generic validator values correlated with their field', async () => {
  const form = createForm({ initialValues: { name: '', age: 10 }, validation: {
    name: { validate: value => value.length > 0 || 'required' },
    age: { validate: value => value >= 18 || 'adult' },
  } });
  expect(await form.validate()).toBe(false);
  form.setFieldValue('name', 'Zenith'); form.setFieldValue('age', 20);
  expect(await form.validate()).toBe(true);
});
